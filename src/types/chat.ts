export type MessageRole = 'user' | 'model';

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'file';
  mimeType: string;
  size: number;
  dataUrl?: string; // base64 representation
  downloadUrl?: string; // Firebase storage URL
  textPreview?: string; // text content for documents/code
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface GroundingSupport {
  groundingChunkIndices?: number[];
  confidenceScores?: number[];
  segment?: {
    startIndex?: number;
    endIndex?: number;
    text?: string;
  };
}

export interface GroundingMetadata {
  webSearchQueries?: string[];
  sources?: GroundingSource[];
  groundingChunks?: Array<{
    web?: {
      uri?: string;
      title?: string;
    };
  }>;
  groundingSupports?: GroundingSupport[];
  searchEntryPoint?: {
    renderedContent?: string;
  };
}

export interface Message {
  id: string;
  chatId: string;
  userId: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  status?: 'sending' | 'streaming' | 'complete' | 'error';
  error?: string;
  webSearchUsed?: boolean;
  groundingMetadata?: GroundingMetadata;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  model: string;
  messages: Message[];
}

export interface Memory {
  id: string;
  userId: string;
  content: string;
  category: 'preference' | 'tech_stack' | 'personal' | 'project' | 'general';
  importance: number; // 1 to 5
  source?: string;
  createdAt: number;
  updatedAt: number;
}

export type GeminiVoiceName = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';

export interface VoiceSettings {
  voiceChatEnabled: boolean;
  readAloudEnabled: boolean;
  voiceName: GeminiVoiceName;
  voiceSpeed: number; // 0.75 - 1.5
  outputVolume: number; // 0 - 1
  autoPlayResponses: boolean;
  selectedMicDeviceId?: string;
}

export interface UserSettings {
  userId?: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  memoryEnabled: boolean;
  autoScroll: boolean;
  soundEffects: boolean;
  webSearchDefault?: boolean;
  voiceSettings?: VoiceSettings;
}

export interface UploadedMediaItem {
  id: string;
  userId: string;
  name: string;
  type: 'image' | 'file';
  mimeType: string;
  size: number;
  dataUrl?: string;
  downloadUrl?: string;
  textPreview?: string;
  chatId: string;
  timestamp: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
