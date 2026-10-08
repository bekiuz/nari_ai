import { GeminiVoiceName } from '../types/chat';
import { apiUrl } from '../utils/api';

export type TTSState = 'idle' | 'loading' | 'playing' | 'paused';

export interface TTSStatus {
  messageId: string | null;
  state: TTSState;
}

class TTSService {
  private currentAudio: HTMLAudioElement | null = null;
  private currentMessageId: string | null = null;
  private state: TTSState = 'idle';
  private statusListeners: Array<(status: TTSStatus) => void> = [];

  // Browser speech fallback reference
  private isUsingSpeechSynthesis = false;

  public subscribeStatus(listener: (status: TTSStatus) => void): () => void {
    this.statusListeners.push(listener);
    listener({ messageId: this.currentMessageId, state: this.state });
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    const status: TTSStatus = {
      messageId: this.currentMessageId,
      state: this.state,
    };
    this.statusListeners.forEach((listener) => listener(status));
  }

  public getStatus(): TTSStatus {
    return {
      messageId: this.currentMessageId,
      state: this.state,
    };
  }

  /**
   * Speak message text using Gemini 3.8 Flash TTS with fallback to browser SpeechSynthesis.
   */
  public async speakMessage(options: {
    messageId: string;
    text: string;
    voiceName?: GeminiVoiceName;
    token?: string | null;
    rate?: number;
    volume?: number;
  }): Promise<void> {
    const { messageId, text, voiceName = 'Zephyr', token, rate = 1.0, volume = 1.0 } = options;

    // If clicking on the same message that's currently playing, toggle pause/play
    if (this.currentMessageId === messageId && this.currentAudio) {
      if (this.state === 'playing') {
        this.currentAudio.pause();
        this.state = 'paused';
        this.notify();
        return;
      } else if (this.state === 'paused') {
        this.currentAudio.play().catch(() => {});
        this.state = 'playing';
        this.notify();
        return;
      }
    }

    // Stop previous playback
    this.stop();

    this.currentMessageId = messageId;
    this.state = 'loading';
    this.notify();

    // 1. Try Gemini Official TTS (/api/voice/tts) if authenticated
    if (token) {
      try {
        const response = await fetch(apiUrl('/api/voice/tts'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            text,
            voiceName,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.audioBase64) {
            const audioDataUri = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
            const audio = new Audio(audioDataUri);
            audio.playbackRate = Math.max(0.5, Math.min(2.0, rate));
            audio.volume = Math.max(0, Math.min(1.0, volume));

            this.currentAudio = audio;
            this.isUsingSpeechSynthesis = false;

            audio.onplay = () => {
              this.state = 'playing';
              this.notify();
            };

            audio.onpause = () => {
              if (this.state === 'playing') {
                this.state = 'paused';
                this.notify();
              }
            };

            audio.onended = () => {
              this.cleanup();
            };

            audio.onerror = () => {
              console.warn('Audio playback error, falling back to browser SpeechSynthesis');
              this.speakWithSpeechSynthesis(messageId, text, rate, volume);
            };

            await audio.play();
            return;
          }
        }
      } catch (err) {
        console.warn('Gemini TTS request failed, fallback to SpeechSynthesis:', err);
      }
    }

    // 2. Fallback to Browser SpeechSynthesis
    this.speakWithSpeechSynthesis(messageId, text, rate, volume);
  }

  private speakWithSpeechSynthesis(
    messageId: string,
    text: string,
    rate: number = 1.0,
    volume: number = 1.0
  ) {
    if (!('speechSynthesis' in window)) {
      this.cleanup();
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#`_~\[\]()]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = rate;
    utterance.volume = volume;

    this.isUsingSpeechSynthesis = true;
    this.currentMessageId = messageId;
    this.state = 'playing';
    this.notify();

    utterance.onend = () => {
      this.cleanup();
    };

    utterance.onerror = () => {
      this.cleanup();
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Preview a Gemini voice sample in Settings.
   */
  public async previewVoice(voiceName: GeminiVoiceName, token?: string | null): Promise<void> {
    this.stop();

    if (!token) return;

    try {
      const response = await fetch('/api/voice/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ voiceName }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.audioBase64) {
          const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
          this.currentAudio = audio;
          audio.onended = () => this.cleanup();
          await audio.play();
        }
      }
    } catch (err) {
      console.error('Error previewing voice:', err);
    }
  }

  /**
   * Stop any current speech playback.
   */
  public stop() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {
        // ignore
      }
      this.currentAudio = null;
    }

    if (this.isUsingSpeechSynthesis && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
      this.isUsingSpeechSynthesis = false;
    }

    this.cleanup();
  }

  private cleanup() {
    this.currentAudio = null;
    this.currentMessageId = null;
    this.state = 'idle';
    this.isUsingSpeechSynthesis = false;
    this.notify();
  }
}

export const ttsService = new TTSService();
