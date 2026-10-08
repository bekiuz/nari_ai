/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsPanel } from './components/SettingsModal';
import { FilesPanel } from './components/FilesPanel';
import { ImagesGallery } from './components/ImagesGallery';
import { MemoryManager } from './components/MemoryManager';
import { AuthModal } from './components/AuthModal';
import { VoiceModeModal } from './components/VoiceModeModal';
import {
  Conversation,
  Message,
  Attachment,
  UserSettings,
  UploadedMediaItem,
  Memory,
  UserProfile,
} from './types/chat';
import {
  subscribeToAuthChanges,
  logoutUser,
  getAuthToken,
} from './services/authService';
import {
  subscribeToUserChats,
  subscribeToChatMessages,
  getCloudChatMessages,
  createCloudChat,
  updateCloudChatTitle,
  toggleCloudChatPin,
  deleteCloudChat,
  saveCloudMessage,
  updateCloudMessage,
  clearCloudChatMessages,
} from './services/chatService';
import {
  subscribeToUserMemories,
  addCloudMemory,
  updateCloudMemory,
  deleteCloudMemory,
  processMemoryCommands,
  formatMemoriesForPrompt,
} from './services/memoryService';
import {
  subscribeToUserMedia,
  saveCloudMediaItem,
  deleteCloudMediaItem,
  uploadFileWithStorage,
} from './services/mediaService';
import {
  subscribeToUserSettings,
  saveCloudUserSettings,
} from './services/settingsService';
import { DEFAULT_SETTINGS } from './utils/storage';
import { apiUrl } from './utils/api';
import { ZuxrashLogo } from './components/ZuxrashLogo';
import { liveVoiceService } from './services/liveVoiceService';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatMessages, setActiveChatMessages] = useState<Message[]>([]);

  const [memories, setMemories] = useState<Memory[]>([]);
  const [mediaItems, setMediaItems] = useState<UploadedMediaItem[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  const [activeView, setActiveView] = useState<'chats' | 'files' | 'images' | 'memories' | 'settings'>('chats');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState<boolean>(false);
  const [stagedAttachments, setStagedAttachments] = useState<Attachment[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isInitialLoadRef = useRef<boolean>(true);

  // 1. Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      if (user) {
        setCurrentUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        });
        getAuthToken().then((tok) => setAuthToken(tok));
      } else {
        setCurrentUser(null);
        setAuthToken(null);
        setConversations([]);
        setActiveChatId(null);
        setActiveChatMessages([]);
        setMemories([]);
        setMediaItems([]);
        setIsVoiceModalOpen(false);
        isInitialLoadRef.current = true;
      }
      setAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time subscriptions when user is authenticated
  useEffect(() => {
    if (!currentUser) return;

    // A. Subscribe to user's chats
    const unsubChats = subscribeToUserChats(
      currentUser.uid,
      (chats) => {
        setConversations(chats);
        // On initial load, restore previously active chat from localStorage if available
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
          let savedId: string | null = null;
          try {
            savedId = localStorage.getItem('zuxrash_active_chat_id');
          } catch (_) {}

          if (savedId && chats.some((c) => c.id === savedId)) {
            setActiveChatId(savedId);
          } else if (chats.length > 0) {
            setActiveChatId(chats[0].id);
            try {
              localStorage.setItem('zuxrash_active_chat_id', chats[0].id);
            } catch (_) {}
          } else {
            setActiveChatId(null);
          }
        }
      },
      (err) => {
        console.warn('Chats subscription notice:', err?.message || err);
      }
    );

    // B. Subscribe to user's memories
    const unsubMemories = subscribeToUserMemories(
      currentUser.uid,
      (mems) => {
        setMemories(mems);
      },
      (err) => {
        console.warn('Memories subscription notice:', err?.message || err);
      }
    );

    // C. Subscribe to user's media items (files and images)
    const unsubMedia = subscribeToUserMedia(
      currentUser.uid,
      (items) => {
        setMediaItems(items);
      },
      (err) => {
        console.warn('Media subscription notice:', err?.message || err);
      }
    );

    // D. Subscribe to user settings
    const unsubSettings = subscribeToUserSettings(
      currentUser.uid,
      (s) => {
        setSettings(s);
        if (s.webSearchDefault !== undefined && isInitialLoadRef.current) {
          setWebSearchEnabled(!!s.webSearchDefault);
        }
      },
      (err) => {
        console.warn('Settings subscription notice:', err?.message || err);
      }
    );

    return () => {
      unsubChats();
      unsubMemories();
      unsubMedia();
      unsubSettings();
    };
  }, [currentUser]);

  // 3. Real-time subscription to active chat's messages
  useEffect(() => {
    // Immediately clear messages in memory when switching chats or opening New Chat
    setActiveChatMessages([]);

    if (!currentUser || !activeChatId) {
      return;
    }

    const unsubMessages = subscribeToChatMessages(
      activeChatId,
      (msgs) => {
        setActiveChatMessages(msgs);
      },
      (err) => {
        console.warn('Messages subscription notice:', err?.message || err);
      }
    );

    return () => unsubMessages();
  }, [currentUser, activeChatId]);

  // Active chat object with real-time messages
  const activeChat: Conversation | null = activeChatId
    ? {
        ...(conversations.find((c) => c.id === activeChatId) || {
          id: activeChatId,
          userId: currentUser?.uid || '',
          title: 'Chat',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: settings.model,
          messages: [],
        }),
        messages: activeChatMessages,
      }
    : null;

  // Select Chat action - safely switches conversation context and clears previous messages
  const handleSelectChat = (id: string) => {
    if (id === activeChatId) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setActiveChatId(id);
    setActiveChatMessages([]);
    setStagedAttachments([]);
    setActiveView('chats');
    try {
      localStorage.setItem('zuxrash_active_chat_id', id);
    } catch (_) {}
  };

  // New Chat action - opens a fresh draft in local state without writing to Firestore
  const handleNewChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setActiveChatId(null);
    setActiveChatMessages([]);
    setStagedAttachments([]);
    setActiveView('chats');
    try {
      localStorage.removeItem('zuxrash_active_chat_id');
    } catch (_) {}
  };

  // Delete Chat action
  const handleDeleteChat = async (id: string) => {
    try {
      await deleteCloudChat(id);
      if (activeChatId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        if (remaining.length > 0) {
          handleSelectChat(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };

  // Rename Chat action
  const handleRenameChat = async (id: string, newTitle: string) => {
    if (!id || id === 'draft') return;
    try {
      await updateCloudChatTitle(id, newTitle);
    } catch (err) {
      console.error('Failed to rename chat:', err);
    }
  };

  // Toggle Pin action
  const handleTogglePin = async (id: string) => {
    if (!id) return;
    const chat = conversations.find((c) => c.id === id);
    if (!chat) return;
    try {
      await toggleCloudChatPin(id, !chat.pinned);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  // Clear Messages action
  const handleClearMessages = async () => {
    if (!activeChatId) {
      setActiveChatMessages([]);
      return;
    }
    try {
      await clearCloudChatMessages(activeChatId);
      setActiveChatMessages([]);
    } catch (err) {
      console.error('Failed to clear messages:', err);
    }
  };

  // Stop generation action
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  // Send Message with Memory Retrieval & Processing
  const handleSendMessage = async (
    text: string,
    attachments: Attachment[] = [],
    webSearch: boolean = webSearchEnabled
  ) => {
    if ((!text.trim() && attachments.length === 0) || isLoading || !currentUser) return;

    let targetChatId = activeChatId;
    const isNewChat = !targetChatId;

    // Create chat in Firestore only when the first message is actually sent
    if (!targetChatId) {
      const smartTitle = text.trim()
        ? text.trim().slice(0, 35) + (text.trim().length > 35 ? '...' : '')
        : (attachments.length > 0 ? (attachments[0].name || 'Media Analysis') : 'New Chat');

      try {
        const created = await createCloudChat(
          currentUser.uid,
          smartTitle,
          settings.model
        );
        targetChatId = created.id;
        setActiveChatId(created.id);
        try {
          localStorage.setItem('zuxrash_active_chat_id', created.id);
        } catch (_) {}
      } catch (err) {
        console.error('Failed to create chat in Firestore:', err);
        return;
      }
    }

    // Save attachments to Firestore media repository
    for (const att of attachments) {
      const mediaItem: UploadedMediaItem = {
        id: att.id,
        userId: currentUser.uid,
        name: att.name,
        type: att.type,
        mimeType: att.mimeType,
        size: att.size,
        dataUrl: att.dataUrl,
        downloadUrl: att.downloadUrl,
        textPreview: att.textPreview,
        chatId: targetChatId,
        timestamp: Date.now(),
      };
      await saveCloudMediaItem(currentUser.uid, mediaItem);
    }

    // Save user message to Firestore
    const userMessageId = `msg-${Date.now()}-user`;
    const userMessage: Message = {
      id: userMessageId,
      chatId: targetChatId,
      userId: currentUser.uid,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
      webSearchUsed: webSearch,
    };

    await saveCloudMessage(targetChatId, currentUser.uid, userMessage);

    // Fetch prior messages belonging STRICTLY to this chatId from Firestore
    // This guarantees no cross-chat context contamination!
    let priorMessages: Message[] = [];
    if (!isNewChat) {
      const dbMsgs = await getCloudChatMessages(targetChatId);
      priorMessages = dbMsgs.filter(
        (m) => m.id !== userMessageId && m.status !== 'streaming'
      );
    }
    const conversationHistory = [...priorMessages, userMessage];

    // Check for direct memory commands ("remember this: ...", "forget this: ...")
    const memoryCommandResult = await processMemoryCommands(currentUser.uid, text, memories);
    if (memoryCommandResult.handled && memoryCommandResult.message) {
      const modelMessageId = `msg-${Date.now() + 1}-model`;
      const confirmationMessage: Message = {
        id: modelMessageId,
        chatId: targetChatId,
        userId: currentUser.uid,
        role: 'model',
        content: `🧠 **Memory Updated**\n\n${memoryCommandResult.message}`,
        timestamp: Date.now() + 1,
        status: 'complete',
      };
      await saveCloudMessage(targetChatId, currentUser.uid, confirmationMessage);
      return;
    }

    // Prepare placeholder model message in Firestore
    const modelMessageId = `msg-${Date.now() + 1}-model`;
    const placeholderModelMessage: Message = {
      id: modelMessageId,
      chatId: targetChatId,
      userId: currentUser.uid,
      role: 'model',
      content: '',
      timestamp: Date.now() + 1,
      status: 'streaming',
      webSearchUsed: webSearch,
    };

    await saveCloudMessage(targetChatId, currentUser.uid, placeholderModelMessage);

    setIsLoading(true);
    setStagedAttachments([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication session expired. Please sign in again.');

      // Format previous conversation messages for Gemini API
      const apiMessages = conversationHistory.map((m) => {
        const parts: any[] = [];

        if (m.attachments && m.attachments.length > 0) {
          m.attachments.forEach((att) => {
            if (att.type === 'image' && att.dataUrl) {
              const base64Data = att.dataUrl.split(',')[1] || att.dataUrl;
              parts.push({
                inlineData: {
                  mimeType: att.mimeType || 'image/png',
                  data: base64Data,
                },
              });
            } else if (att.type === 'file') {
              if (att.mimeType === 'application/pdf' && att.dataUrl) {
                const base64Data = att.dataUrl.split(',')[1] || att.dataUrl;
                parts.push({
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: base64Data,
                  },
                });
              }
              if (att.textPreview) {
                const ext = att.name.split('.').pop() || '';
                parts.push({
                  text: `[Attached File: ${att.name} (${att.mimeType || 'document'}, ${att.size} bytes)]:\n\`\`\`${ext}\n${att.textPreview}\n\`\`\``,
                });
              }
            }
          });
        }

        if (m.content) {
          parts.push({ text: m.content });
        }

        return {
          role: m.role,
          parts,
        };
      });

      // Inject long-term memory context if enabled (relevance filtered)
      let enhancedSystemPrompt = settings.systemPrompt;
      if (settings.memoryEnabled && memories.length > 0) {
        enhancedSystemPrompt += formatMemoriesForPrompt(memories, text);
      }

      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          messages: apiMessages,
          model: settings.model,
          systemInstruction: enhancedSystemPrompt,
          temperature: settings.temperature,
          stream: true,
          webSearch,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned error ${response.status}`);
      }

      if (!response.body) throw new Error('Streaming response body is unavailable.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let accumulatedGrounding: any = null;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const dataPayload = trimmed.slice(6);
          if (dataPayload === '[DONE]') break;

          try {
            const parsed = JSON.parse(dataPayload);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.groundingMetadata) {
              const existingSources = (accumulatedGrounding && accumulatedGrounding.sources) || [];
              const incomingSources = parsed.groundingMetadata.sources || [];
              const mergedSources = [...existingSources];
              for (const s of incomingSources) {
                if (s.url && !mergedSources.some((item: any) => item.url === s.url)) {
                  mergedSources.push(s);
                }
              }

              const existingQueries = (accumulatedGrounding && accumulatedGrounding.webSearchQueries) || [];
              const incomingQueries = parsed.groundingMetadata.webSearchQueries || [];
              const mergedQueries = Array.from(new Set([...existingQueries, ...incomingQueries]));

              accumulatedGrounding = {
                ...(accumulatedGrounding || {}),
                ...parsed.groundingMetadata,
                sources: mergedSources,
                webSearchQueries: mergedQueries,
                groundingChunks: parsed.groundingMetadata.groundingChunks || accumulatedGrounding?.groundingChunks || [],
                groundingSupports: parsed.groundingMetadata.groundingSupports || accumulatedGrounding?.groundingSupports || [],
              };
            }
            if (parsed.text) {
              accumulatedText += parsed.text;
              const hasGroundingNow = Boolean(
                accumulatedGrounding &&
                ((accumulatedGrounding.sources && accumulatedGrounding.sources.length > 0) ||
                 (accumulatedGrounding.webSearchQueries && accumulatedGrounding.webSearchQueries.length > 0) ||
                 (accumulatedGrounding.groundingChunks && accumulatedGrounding.groundingChunks.length > 0))
              );
              // Update state locally for real-time smoothness
              setActiveChatMessages((prev) =>
                prev.map((m) =>
                  m.id === modelMessageId
                    ? {
                        ...m,
                        content: accumulatedText,
                        status: 'streaming',
                        webSearchUsed: webSearch && hasGroundingNow,
                        groundingMetadata: accumulatedGrounding || undefined,
                      }
                    : m
                )
              );
            }
          } catch {
            // chunk parse
          }
        }
      }

      // Compute if actual search grounding was returned
      const hasActualGrounding = Boolean(
        accumulatedGrounding &&
        ((accumulatedGrounding.sources && accumulatedGrounding.sources.length > 0) ||
         (accumulatedGrounding.webSearchQueries && accumulatedGrounding.webSearchQueries.length > 0) ||
         (accumulatedGrounding.groundingChunks && accumulatedGrounding.groundingChunks.length > 0))
      );
      const finalWebSearchUsed = webSearch && hasActualGrounding;

      // Update local state to complete
      setActiveChatMessages((prev) =>
        prev.map((m) =>
          m.id === modelMessageId
            ? {
                ...m,
                content: accumulatedText || 'I processed your request.',
                status: 'complete',
                webSearchUsed: finalWebSearchUsed,
                groundingMetadata: accumulatedGrounding || undefined,
              }
            : m
        )
      );

      // Persist final completed text and grounding metadata in Firestore
      await updateCloudMessage(targetChatId, modelMessageId, {
        content: accumulatedText || 'I processed your request.',
        status: 'complete',
        webSearchUsed: finalWebSearchUsed,
        groundingMetadata: accumulatedGrounding || null,
      });

      // Background: Extract long-term user memories if enabled
      if (settings.memoryEnabled && text.trim().length > 10 && accumulatedText) {
        fetch('/api/memory/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userText: text,
            assistantReply: accumulatedText.slice(0, 300),
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data?.hasMemory && data?.content) {
              addCloudMemory(
                currentUser.uid,
                data.content,
                data.category || 'general',
                data.importance || 3,
                'conversation_analysis'
              ).catch((err) => console.error('Failed to save extracted memory:', err));
            }
          })
          .catch((err) => console.error('Memory extraction error:', err));
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        await updateCloudMessage(targetChatId, modelMessageId, { status: 'complete' });
      } else {
        console.error('Chat error:', error);
        await updateCloudMessage(targetChatId, modelMessageId, {
          content: 'An error occurred while generating a response. Please try again.',
          status: 'error',
          error: error.message || 'Network request failed',
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Regenerate Response
  const handleRegenerateMessage = (modelMessageId: string, overrideWebSearch?: boolean) => {
    if (!activeChat) return;
    const messageIndex = activeChat.messages.findIndex((m) => m.id === modelMessageId);
    if (messageIndex === -1) return;

    const previousUserMsg = activeChat.messages
      .slice(0, messageIndex)
      .reverse()
      .find((m) => m.role === 'user');

    if (!previousUserMsg) return;

    const targetSearch = overrideWebSearch !== undefined ? overrideWebSearch : webSearchEnabled;
    if (overrideWebSearch !== undefined) {
      setWebSearchEnabled(overrideWebSearch);
    }

    handleSendMessage(previousUserMsg.content, previousUserMsg.attachments || [], targetSearch);
  };

  // Upload File handler
  const handleUploadFile = async (file: File) => {
    if (!currentUser) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const content = reader.result as string;
      const item: UploadedMediaItem = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: currentUser.uid,
        name: file.name,
        type: 'file',
        mimeType: file.type || 'text/plain',
        size: file.size,
        textPreview: content,
        chatId: activeChatId || '',
        timestamp: Date.now(),
      };
      await saveCloudMediaItem(currentUser.uid, item);
    };
    reader.readAsText(file);
  };

  // Upload Image handler
  const handleUploadImage = async (file: File) => {
    if (!currentUser) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const item: UploadedMediaItem = {
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: currentUser.uid,
        name: file.name,
        type: 'image',
        mimeType: file.type || 'image/png',
        size: file.size,
        dataUrl,
        chatId: activeChatId || '',
        timestamp: Date.now(),
      };
      await saveCloudMediaItem(currentUser.uid, item);
    };
    reader.readAsDataURL(file);
  };

  // Delete Media handler
  const handleDeleteMedia = async (id: string) => {
    if (!currentUser) return;
    const item = mediaItems.find((m) => m.id === id);
    if (!item) return;
    await deleteCloudMediaItem(currentUser.uid, id, item.type);
  };

  // Stage media to prompt
  const handleSendMediaToChat = (item: UploadedMediaItem) => {
    const att: Attachment = {
      id: item.id,
      name: item.name,
      type: item.type,
      mimeType: item.mimeType,
      size: item.size,
      dataUrl: item.dataUrl,
      textPreview: item.textPreview,
    };
    setStagedAttachments([att]);
    setActiveView('chats');
  };

  // Memory handlers
  const handleAddMemory = async (
    content: string,
    category: Memory['category'],
    importance: number
  ) => {
    if (!currentUser) return;
    await addCloudMemory(currentUser.uid, content, category, importance, 'manual');
  };

  const handleUpdateMemory = async (id: string, updates: Partial<Memory>) => {
    if (!currentUser) return;
    await updateCloudMemory(currentUser.uid, id, updates);
  };

  const handleDeleteMemory = async (id: string) => {
    if (!currentUser) return;
    await deleteCloudMemory(currentUser.uid, id);
  };

  // Settings update
  const handleUpdateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!currentUser) return;
    await saveCloudUserSettings(currentUser.uid, newSettings);
  };

  // Reset settings
  const handleResetSettings = async () => {
    if (!currentUser) return;
    await saveCloudUserSettings(currentUser.uid, DEFAULT_SETTINGS);
  };

  // Clear all chats
  const handleClearAllChats = async () => {
    if (!currentUser) return;
    for (const c of conversations) {
      await deleteCloudChat(c.id);
    }
    handleNewChat();
  };

  // Persist completed real-time voice turns to active Firestore chat
  const handlePersistVoiceTurn = async (userText: string, modelText: string) => {
    if (!currentUser || !activeChatId) return;

    const now = Date.now();
    if (userText.trim()) {
      const userMsg: Message = {
        id: `msg-${now}-voice-user`,
        chatId: activeChatId,
        userId: currentUser.uid,
        role: 'user',
        content: userText.trim(),
        timestamp: now,
      };
      await saveCloudMessage(activeChatId, currentUser.uid, userMsg);
    }

    if (modelText.trim()) {
      const modelMsg: Message = {
        id: `msg-${now + 1}-voice-model`,
        chatId: activeChatId,
        userId: currentUser.uid,
        role: 'model',
        content: modelText.trim(),
        timestamp: now + 1,
        status: 'complete',
      };
      await saveCloudMessage(activeChatId, currentUser.uid, modelMsg);
    }
  };

  // Open Voice Mode ensuring activeChat exists and token is fresh
  const handleOpenVoiceMode = async () => {
    if (!currentUser) return;
    let targetChatId = activeChatId;
    if (!targetChatId) {
      const newChat = await createCloudChat(currentUser.uid, 'Voice Conversation', settings.model);
      targetChatId = newChat.id;
      setActiveChatId(targetChatId);
    }
    try {
      const freshToken = await getAuthToken();
      if (freshToken) setAuthToken(freshToken);
    } catch {
      // ignore
    }
    setIsVoiceModalOpen(true);
  };

  const handleStopVoiceMode = () => {
    liveVoiceService.stopSession();
    setIsVoiceModalOpen(false);
  };

  // Loading state while checking auth
  if (authChecking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#06040b] text-white">
        <div className="flex flex-col items-center gap-4">
          <ZuxrashLogo size={64} withGlow />
          <span className="text-xs font-mono text-pink-300 tracking-wider">Connecting to Zuxrash Cloud...</span>
        </div>
      </div>
    );
  }

  // If not logged in, show AuthModal
  if (!currentUser) {
    return <AuthModal />;
  }

  return (
    <div className="zuxrash-shell flex h-screen w-screen overflow-hidden text-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        conversations={conversations}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onTogglePin={handleTogglePin}
        activeView={activeView}
        onChangeView={setActiveView}
        isOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        isCollapsed={desktopSidebarCollapsed}
        onToggleCollapse={() => setDesktopSidebarCollapsed((prev) => !prev)}
        currentUser={currentUser}
        onLogout={logoutUser}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {activeView === 'chats' && (
          <ChatArea
            chat={activeChat}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onStopGeneration={handleStopGeneration}
            onRegenerateMessage={handleRegenerateMessage}
            onToggleMobileMenu={() => setMobileSidebarOpen(true)}
            onRenameChat={(newTitle) => {
              if (activeChatId) handleRenameChat(activeChatId, newTitle);
            }}
            onClearMessages={handleClearMessages}
            onNewChat={handleNewChat}
            currentModel={settings.model}
            initialAttachments={stagedAttachments}
            webSearchEnabled={webSearchEnabled}
            onToggleWebSearch={() => setWebSearchEnabled((prev) => !prev)}
            onOpenVoiceMode={handleOpenVoiceMode}
            isVoiceSessionActive={isVoiceModalOpen}
            onStopVoiceMode={handleStopVoiceMode}
            authToken={authToken}
            voiceName={settings.voiceSettings?.voiceName || 'Zephyr'}
            voiceSpeed={settings.voiceSettings?.voiceSpeed ?? 1.0}
            outputVolume={settings.voiceSettings?.outputVolume ?? 1.0}
          />
        )}

        {activeView === 'memories' && (
          <MemoryManager
            memories={memories}
            onAddMemory={handleAddMemory}
            onUpdateMemory={handleUpdateMemory}
            onDeleteMemory={handleDeleteMemory}
          />
        )}

        {activeView === 'files' && (
          <FilesPanel
            files={mediaItems}
            onUploadFile={async (file, onProgress) => {
              if (!currentUser) return;
              await uploadFileWithStorage(currentUser.uid, file, activeChatId || '', onProgress);
            }}
            onDeleteFile={handleDeleteMedia}
            onSendToChat={handleSendMediaToChat}
          />
        )}

        {activeView === 'images' && (
          <ImagesGallery
            images={mediaItems}
            onUploadImage={handleUploadImage}
            onDeleteImage={handleDeleteMedia}
            onSendToChat={handleSendMediaToChat}
          />
        )}

        {activeView === 'settings' && (
          <SettingsPanel
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onResetSettings={handleResetSettings}
            onClearAllChats={handleClearAllChats}
            conversations={conversations}
            currentUser={currentUser}
            onNavigateToMemories={() => setActiveView('memories')}
            onLogout={logoutUser}
            authToken={authToken}
          />
        )}
      </main>

      {/* Real-time Voice Chat Modal (Gemini Live) */}
      <VoiceModeModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        activeChat={activeChat}
        authToken={authToken}
        defaultVoice={settings.voiceSettings?.voiceName || 'Zephyr'}
        webSearchEnabled={webSearchEnabled}
        systemInstruction={settings.systemPrompt}
        memories={memories}
        onPersistVoiceTurn={handlePersistVoiceTurn}
      />
    </div>
  );
}
