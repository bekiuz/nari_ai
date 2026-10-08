import { GeminiVoiceName, Memory } from '../types/chat';

export type LiveVoiceState =
  | 'idle'
  | 'requesting_mic'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export interface LiveVoiceCallbacks {
  onStateChange: (state: LiveVoiceState) => void;
  onTranscriptUpdate: (transcripts: { user: string; model: string }) => void;
  onTurnComplete: (turn: { user: string; model: string }) => void;
  onError: (error: string) => void;
  onVolumeChange: (volume: number) => void;
}

export interface LiveSessionOptions {
  token: string;
  chatId: string;
  voiceName?: GeminiVoiceName;
  systemInstruction?: string;
  memories?: Memory[];
  recentMessages?: Array<{ role: 'user' | 'model'; content: string }>;
  webSearch?: boolean;
}

class LiveVoiceService {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private wakeLock: any = null;
  private inputSampleRate = 16000;
  private resumeHandler: (() => void) | null = null;

  private state: LiveVoiceState = 'idle';
  private callbacks: Partial<LiveVoiceCallbacks> = {};

  private currentTurnUserText = '';
  private currentTurnModelText = '';
  private isMuted = false;

  // Audio playback scheduling
  private nextPlayTime = 0;
  private activeSourceNodes: AudioBufferSourceNode[] = [];

  public getState(): LiveVoiceState {
    return this.state;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setCallbacks(cbs: Partial<LiveVoiceCallbacks>) {
    this.callbacks = cbs;
  }

  private setState(newState: LiveVoiceState) {
    if (this.state !== newState) {
      this.state = newState;
      this.callbacks.onStateChange?.(newState);
    }
  }

  public async startSession(options: LiveSessionOptions): Promise<void> {
    this.stopSession();
    this.currentTurnUserText = '';
    this.currentTurnModelText = '';
    this.isMuted = false;
    this.activeSourceNodes = [];
    this.nextPlayTime = 0;

    // Request Screen WakeLock on mobile devices if supported
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
      }
    } catch {
      // ignore
    }

    // Check browser audio capture compatibility
    if (!navigator?.mediaDevices?.getUserMedia || (!window.AudioContext && !(window as any).webkitAudioContext)) {
      this.setState('error');
      this.callbacks.onError?.('Your browser does not support real-time audio capture. Please use a modern browser such as Chrome, Edge, Safari, or Firefox.');
      return;
    }

    // 1. Request microphone access
    this.setState('requesting_mic');
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (micErr: any) {
      const isPermissionDenied =
        micErr.name === 'NotAllowedError' ||
        micErr.name === 'PermissionDeniedError' ||
        micErr.message?.includes('Permission denied');
      const isDeviceNotFound =
        micErr.name === 'NotFoundError' ||
        micErr.name === 'DevicesNotFoundError';

      const msg = isPermissionDenied
        ? 'Microphone permission was denied. Please allow microphone access in your browser settings to speak with Zuxrash.'
        : isDeviceNotFound
        ? 'No microphone detected. Please connect an audio input device.'
        : 'Unable to access microphone. Please check your audio input device permissions.';

      this.setState('error');
      this.callbacks.onError?.(msg);
      return;
    }

    // 2. Initialize 16kHz input AudioContext & ScriptProcessor
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      // Do not force a hardware sample rate. Mobile WebViews commonly expose
      // 48kHz or 44.1kHz input. Gemini Live accepts other rates when the
      // actual rate is declared in the PCM MIME type sent to the server.
      this.inputAudioCtx = new AudioCtxClass();
      this.inputSampleRate = this.inputAudioCtx.sampleRate || 16000;
      if (this.inputAudioCtx.state === 'suspended') {
        try {
          await this.inputAudioCtx.resume();
        } catch {
          // Some mobile WebViews require a direct user gesture to resume audio.
        }
      }

      const source = this.inputAudioCtx.createMediaStreamSource(this.micStream);
      // 2048 buffer size gives ~128ms packets at 16kHz for responsive speech
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);

      this.scriptProcessor.onaudioprocess = (e) => {
        if (this.isMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputChannel = e.inputBuffer.getChannelData(0);

        // Calculate simple volume RMS for visualizer
        let sum = 0;
        for (let i = 0; i < inputChannel.length; i++) {
          sum += inputChannel[i] * inputChannel[i];
        }
        const rms = Math.sqrt(sum / inputChannel.length);
        const normalizedVol = Math.min(Math.max((rms - 0.01) * 5, 0), 1);
        this.callbacks.onVolumeChange?.(normalizedVol);

        // Gemini Live input: mono 16-bit PCM at 16kHz.
        // Mobile microphones are often 44.1/48kHz, so resample in the WebView
        // before sending rather than relying on device-specific sample-rate behavior.
        const targetRate = 16000;
        const ratio = this.inputSampleRate / targetRate;
        const targetLength = Math.max(1, Math.round(inputChannel.length / ratio));
        const pcmBuffer = new ArrayBuffer(targetLength * 2);
        const pcmView = new DataView(pcmBuffer);

        for (let i = 0; i < targetLength; i++) {
          const sourceIndex = i * ratio;
          const index0 = Math.min(Math.floor(sourceIndex), inputChannel.length - 1);
          const index1 = Math.min(index0 + 1, inputChannel.length - 1);
          const fraction = sourceIndex - index0;
          const sample =
            inputChannel[index0] + (inputChannel[index1] - inputChannel[index0]) * fraction;
          const s = Math.max(-1, Math.min(1, sample));
          const val = s < 0 ? s * 0x8000 : s * 0x7fff;
          pcmView.setInt16(i * 2, val, true);
        }

        // Convert to base64
        const bytes = new Uint8Array(pcmBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Audio = btoa(binary);

        this.ws.send(
          JSON.stringify({
            type: 'audio',
            data: base64Audio,
            sampleRate: 16000,
          })
        );
      };

      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputAudioCtx.destination);
    } catch (audioInitErr: any) {
      console.error('AudioContext initialization error:', audioInitErr);
      this.setState('error');
      this.callbacks.onError?.('Failed to initialize audio capture.');
      this.stopSession();
      return;
    }

    // 3. Initialize 24kHz output AudioContext for Gemini Live response playback
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });
      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }
    } catch (outputErr: any) {
      console.warn('Could not initialize 24kHz playback AudioContext, fallback to default rate:', outputErr);
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioCtx = new AudioCtxClass();
    }

    // 4. Connect WebSocket
    this.setState('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/live`;

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (wsErr: any) {
      this.setState('error');
      this.callbacks.onError?.('Could not open WebSocket connection to server.');
      this.stopSession();
      return;
    }

    this.ws.onopen = () => {
      // Send handshake initialization message
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'init',
            token: options.token,
            chatId: options.chatId,
            voiceName: options.voiceName || 'Zephyr',
            systemInstruction: options.systemInstruction,
            memories: options.memories,
            recentMessages: options.recentMessages,
            webSearch: options.webSearch,
          })
        );
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'ready':
            this.setState('listening');
            break;

          case 'audio':
            // Model returned 24kHz PCM audio chunk
            this.setState('speaking');
            this.playPcmChunk(msg.data);
            break;

          case 'output_transcription':
            if (msg.text) {
              this.currentTurnModelText += msg.text;
              this.callbacks.onTranscriptUpdate?.({
                user: this.currentTurnUserText,
                model: this.currentTurnModelText,
              });
            }
            break;

          case 'input_transcription':
            if (msg.text) {
              this.currentTurnUserText += msg.text;
              this.setState('thinking');
              this.callbacks.onTranscriptUpdate?.({
                user: this.currentTurnUserText,
                model: this.currentTurnModelText,
              });
            }
            break;

          case 'interrupted':
            // User spoke while model was answering: immediately cut off audio
            this.stopCurrentAudioPlayback();
            this.setState('listening');
            break;

          case 'turn_complete':
            // Turn completed: notify callback to persist conversation
            if (this.currentTurnUserText.trim() || this.currentTurnModelText.trim()) {
              this.callbacks.onTurnComplete?.({
                user: this.currentTurnUserText.trim(),
                model: this.currentTurnModelText.trim(),
              });
            }
            // Reset for next turn
            this.currentTurnUserText = '';
            this.currentTurnModelText = '';
            this.setState('listening');
            break;

          case 'error':
            this.setState('error');
            this.callbacks.onError?.(msg.error || 'Voice session error.');
            break;
        }
      } catch (parseErr) {
        console.error('Error handling WebSocket message:', parseErr);
      }
    };

    this.ws.onerror = (err) => {
      console.error('Live WebSocket error:', err);
      this.setState('error');
      this.callbacks.onError?.('Connection to voice service was lost. Please reconnect.');
    };

    this.ws.onclose = () => {
      if (this.state !== 'idle' && this.state !== 'error') {
        this.setState('idle');
      }
    };

    // Mobile WebViews can keep Web Audio suspended until a user gesture.
    this.resumeHandler = () => {
      void this.resumeAudioContexts();
    };
    window.addEventListener('pointerdown', this.resumeHandler, { passive: true });
    window.addEventListener('touchstart', this.resumeHandler, { passive: true });
  }

  /**
   * Plays a 24kHz raw PCM little-endian audio chunk gaplessly using output AudioContext.
   */
  private playPcmChunk(base64Data: string) {
    if (!this.outputAudioCtx || !base64Data) return;

    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const sourceNode = this.outputAudioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.outputAudioCtx.destination);

      const currentTime = this.outputAudioCtx.currentTime;
      const scheduledTime = Math.max(currentTime, this.nextPlayTime);
      sourceNode.start(scheduledTime);
      this.nextPlayTime = scheduledTime + audioBuffer.duration;

      this.activeSourceNodes.push(sourceNode);
      sourceNode.onended = () => {
        const index = this.activeSourceNodes.indexOf(sourceNode);
        if (index > -1) {
          this.activeSourceNodes.splice(index, 1);
        }
        if (this.activeSourceNodes.length === 0 && this.state === 'speaking') {
          this.setState('listening');
        }
      };
    } catch (playErr) {
      console.error('Error playing PCM audio chunk:', playErr);
    }
  }

  /**
   * Instantly stops audio playback when user interrupts model.
   */
  public stopCurrentAudioPlayback() {
    for (const source of this.activeSourceNodes) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // ignore
      }
    }
    this.activeSourceNodes = [];
    if (this.outputAudioCtx) {
      this.nextPlayTime = this.outputAudioCtx.currentTime;
    }
  }

  /**
   * Interrupts Zuxrash speaking and tells server.
   */
  public interrupt() {
    this.stopCurrentAudioPlayback();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'interrupt' }));
    }
    this.setState('listening');
  }

  /** Resume Web Audio contexts, especially inside mobile WebViews. */
  public async resumeAudioContexts(): Promise<void> {
    const contexts = [this.inputAudioCtx, this.outputAudioCtx];
    for (const ctx of contexts) {
      if (ctx && ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          // Wait for another direct user gesture.
        }
      }
    }
  }

  /**
   * Mute / unmute microphone input.
   */
  public toggleMute(): boolean {
    void this.resumeAudioContexts();
    this.isMuted = !this.isMuted;
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    return this.isMuted;
  }

  /**
   * Cleanly stop entire voice session and release hardware.
   */
  public stopSession() {
    this.stopCurrentAudioPlayback();

    if (this.resumeHandler) {
      window.removeEventListener('pointerdown', this.resumeHandler);
      window.removeEventListener('touchstart', this.resumeHandler);
      this.resumeHandler = null;
    }

    // Release microphone tracks
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    // Disconnect script processor
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {
        // ignore
      }
      this.scriptProcessor = null;
    }

    // Close AudioContexts
    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch {
        // ignore
      }
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx) {
      try {
        this.outputAudioCtx.close();
      } catch {
        // ignore
      }
      this.outputAudioCtx = null;
    }

    // Close WebSocket
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    // Release WakeLock
    if (this.wakeLock) {
      try {
        this.wakeLock.release().catch(() => {});
      } catch {
        // ignore
      }
      this.wakeLock = null;
    }

    this.isMuted = false;
    this.setState('idle');
    this.callbacks.onVolumeChange?.(0);
  }
}

export const liveVoiceService = new LiveVoiceService();
