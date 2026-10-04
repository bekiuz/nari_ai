import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { Conversation, Message } from '../types/chat';

export function subscribeToUserChats(
  userId: string,
  callback: (chats: Conversation[]) => void,
  onError?: (err: any) => void
) {
  if (!userId || !userId.trim()) {
    callback([]);
    return () => {};
  }

  const path = 'chats';
  // Query filtered by authenticated user's UID to satisfy security rules
  const q = query(
    collection(db, path),
    where('userId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const chats: Conversation[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId || userId,
          title: data.title || 'Untitled Chat',
          model: data.model || 'gemini-3.8-flash',
          pinned: !!data.pinned,
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
          messages: [],
        };
      });
      // Sort client-side by updatedAt descending
      chats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      callback(chats);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
      onError?.(err);
    }
  );
}

export function subscribeToChatMessages(
  chatId: string,
  callback: (messages: Message[]) => void,
  onError?: (err: any) => void
) {
  if (!chatId || !chatId.trim()) {
    callback([]);
    return () => {};
  }

  const path = `chats/${chatId}/messages`;
  const messagesRef = collection(db, 'chats', chatId, 'messages');

  return onSnapshot(
    messagesRef,
    (snapshot) => {
      const messages: Message[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          chatId: data.chatId || chatId,
          userId: data.userId,
          role: data.role,
          content: data.content || '',
          timestamp: data.timestamp || Date.now(),
          attachments: data.attachments || undefined,
          status: data.status || 'complete',
          error: data.error || undefined,
          webSearchUsed: !!data.webSearchUsed,
          groundingMetadata: data.groundingMetadata || undefined,
        };
      });
      // Sort client-side by timestamp ascending
      messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      callback(messages);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
      onError?.(err);
    }
  );
}

/**
 * Fetch messages strictly belonging to a specific chatId.
 * Ensures Gemini requests only ever use messages from the active chat context.
 */
export async function getCloudChatMessages(chatId: string): Promise<Message[]> {
  if (!chatId || !chatId.trim()) return [];
  const path = `chats/${chatId}/messages`;
  try {
    const snap = await getDocs(collection(db, 'chats', chatId, 'messages'));
    const messages: Message[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        chatId: data.chatId || chatId,
        userId: data.userId,
        role: data.role,
        content: data.content || '',
        timestamp: data.timestamp || Date.now(),
        attachments: data.attachments || undefined,
        status: data.status || 'complete',
        error: data.error || undefined,
        webSearchUsed: !!data.webSearchUsed,
        groundingMetadata: data.groundingMetadata || undefined,
      };
    });
    messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    return messages;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return [];
  }
}

export async function createCloudChat(
  userId: string,
  title: string,
  model: string = 'gemini-3.8-flash'
): Promise<Conversation> {
  const chatId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `chats/${chatId}`;
  const now = Date.now();

  const chatData: Omit<Conversation, 'messages'> = {
    id: chatId,
    userId, // Newly created chat always stores authenticated user's UID
    title,
    model,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'chats', chatId), chatData);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }

  return { ...chatData, messages: [] };
}

export async function updateCloudChatTitle(chatId: string, title: string): Promise<void> {
  const path = `chats/${chatId}`;
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      title,
      updatedAt: Date.now(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function toggleCloudChatPin(chatId: string, pinned: boolean): Promise<void> {
  const path = `chats/${chatId}`;
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      pinned,
      updatedAt: Date.now(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteCloudChat(chatId: string): Promise<void> {
  const path = `chats/${chatId}`;
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const msgsSnap = await getDocs(messagesRef);
    const batch = writeBatch(db);
    msgsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, 'chats', chatId));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveCloudMessage(
  chatId: string,
  userId: string,
  message: Message
): Promise<void> {
  const path = `chats/${chatId}/messages/${message.id}`;
  try {
    await setDoc(doc(db, 'chats', chatId, 'messages', message.id), {
      id: message.id,
      chatId,
      userId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      attachments: message.attachments || null,
      status: message.status || 'complete',
      error: message.error || null,
    });

    // Touch chat updatedAt
    await updateDoc(doc(db, 'chats', chatId), {
      updatedAt: Date.now(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateCloudMessage(
  chatId: string,
  messageId: string,
  updates: Partial<Message>
): Promise<void> {
  const path = `chats/${chatId}/messages/${messageId}`;
  try {
    await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), updates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function clearCloudChatMessages(chatId: string): Promise<void> {
  const path = `chats/${chatId}/messages`;
  try {
    const msgsSnap = await getDocs(collection(db, 'chats', chatId, 'messages'));
    const batch = writeBatch(db);
    msgsSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
