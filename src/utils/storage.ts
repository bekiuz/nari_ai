import { Conversation, UserSettings, UploadedMediaItem } from '../types/chat';

const CHATS_STORAGE_KEY = 'nari_ai_chats_v1';
const ACTIVE_CHAT_KEY = 'nari_ai_active_chat_id_v1';
const SETTINGS_STORAGE_KEY = 'nari_ai_settings_v1';
const MEDIA_STORAGE_KEY = 'nari_ai_media_items_v1';

export const DEFAULT_SETTINGS: UserSettings = {
  model: 'gemini-3.8-flash',
  temperature: 0.7,
  systemPrompt:
    'You are Nari AI, an advanced, highly intelligent futuristic AI assistant equipped with real-time bidirectional Voice Mode (Google Gemini Live gemini-3.8-live) and Read Aloud (Gemini TTS gemini-3.8-flash-tts). ' +
    'Provide articulate, accurate, elegant responses. Format code with language specifiers. ' +
    'Be observant and insightful with images and uploaded files. Real-time voice mode IS active and can be launched using the microphone button in the composer.',
  memoryEnabled: true,
  autoScroll: true,
  soundEffects: false,
  webSearchDefault: false,
  voiceSettings: {
    voiceChatEnabled: true,
    readAloudEnabled: true,
    voiceName: 'Zephyr',
    voiceSpeed: 1.0,
    outputVolume: 1.0,
    autoPlayResponses: false,
  },
};

export const INITIAL_CONVERSATION: Conversation = {
  id: 'conv-initial-welcome',
  userId: 'system',
  title: 'Welcome to Nari AI',
  createdAt: Date.now() - 1000 * 60 * 5,
  updatedAt: Date.now() - 1000 * 60 * 5,
  pinned: true,
  model: 'gemini-3.8-flash',
  messages: [
    {
      id: 'msg-welcome-intro',
      chatId: 'conv-initial-welcome',
      userId: 'system',
      role: 'model',
      content:
        `# Welcome to Nari AI ✨\n\n` +
        `I am **Nari AI**, your futuristic multimodal AI assistant powered directly by **Google Gemini**.\n\n` +
        `### Key Capabilities:\n` +
        `- **Real-Time Voice Mode**: Click the **Voice Mode** microphone button in the chat composer to start a real-time bidirectional conversation powered by **Google Gemini Live (gemini-3.8-live)**.\n` +
        `- **Gemini Read Aloud**: Click the speaker icon on any message to listen to natural speech powered by **Gemini TTS (gemini-3.8-flash-tts)**.\n` +
        `- **Google Web Search Grounding**: Toggle **Web Search** on for real-time web citations.\n` +
        `- **Multimodal Vision & Documents**: Attach images, diagrams, PDF, DOCX, CSV, or code files for in-depth analysis.\n` +
        `- **Persistent Workspaces**: Your chats, memories, and files are securely preserved in the cloud.\n\n` +
        `> Start by speaking via Voice Mode or typing a prompt below!`,
      timestamp: Date.now() - 1000 * 60 * 5,
      status: 'complete',
    },
  ],
};

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CHATS_STORAGE_KEY);
    if (!raw) {
      saveConversations([INITIAL_CONVERSATION]);
      return [INITIAL_CONVERSATION];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [INITIAL_CONVERSATION];
  } catch (err) {
    console.error('Failed to load conversations:', err);
    return [INITIAL_CONVERSATION];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(conversations));
  } catch (err) {
    console.error('Failed to save conversations:', err);
  }
}

export function loadActiveChatId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CHAT_KEY);
  } catch {
    return null;
  }
}

export function saveActiveChatId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_CHAT_KEY, id);
  } catch (err) {
    console.error('Failed to save active chat ID:', err);
  }
}

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

export function loadMediaItems(): UploadedMediaItem[] {
  try {
    const raw = localStorage.getItem(MEDIA_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMediaItem(item: UploadedMediaItem): void {
  try {
    const items = loadMediaItems();
    // Prepend new item
    const updated = [item, ...items.filter((i) => i.id !== item.id)].slice(0, 100);
    localStorage.setItem(MEDIA_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save media item:', err);
  }
}

export function deleteMediaItem(id: string): void {
  try {
    const items = loadMediaItems();
    const updated = items.filter((i) => i.id !== id);
    localStorage.setItem(MEDIA_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to delete media item:', err);
  }
}
