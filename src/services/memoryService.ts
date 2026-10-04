import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { Memory } from '../types/chat';

export function subscribeToUserMemories(
  userId: string,
  callback: (memories: Memory[]) => void,
  onError?: (err: any) => void
) {
  const path = `users/${userId}/memories`;
  const q = collection(db, path);

  return onSnapshot(
    q,
    (snapshot) => {
      const memories: Memory[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId,
          content: data.content || '',
          category: data.category || 'general',
          importance: data.importance || 3,
          source: data.source || 'conversation',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
        };
      });
      memories.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(memories);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
      onError?.(err);
    }
  );
}

export async function addCloudMemory(
  userId: string,
  content: string,
  category: Memory['category'] = 'general',
  importance: number = 3,
  source: string = 'manual'
): Promise<Memory> {
  const memoryId = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const path = `users/${userId}/memories/${memoryId}`;
  const now = Date.now();

  const newMemory: Memory = {
    id: memoryId,
    userId,
    content: content.trim(),
    category,
    importance,
    source,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, `users/${userId}/memories`, memoryId), newMemory);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }

  return newMemory;
}

export async function updateCloudMemory(
  userId: string,
  memoryId: string,
  updates: Partial<Memory>
): Promise<void> {
  const path = `users/${userId}/memories/${memoryId}`;
  try {
    await updateDoc(doc(db, `users/${userId}/memories`, memoryId), {
      ...updates,
      updatedAt: Date.now(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteCloudMemory(
  userId: string,
  memoryId: string
): Promise<void> {
  const path = `users/${userId}/memories/${memoryId}`;
  try {
    await deleteDoc(doc(db, `users/${userId}/memories`, memoryId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Parses user input for explicit memory instructions:
 * "remember this: ...", "remember that ...", "forget that ...", "forget my ..."
 */
export async function processMemoryCommands(
  userId: string,
  text: string,
  existingMemories: Memory[]
): Promise<{ handled: boolean; message?: string; memory?: Memory }> {
  const rememberMatch = text.match(/^(?:please\s+)?remember\s+(?:this[:\s]+|that\s+|me[:\s]+)?(.*)$/i);
  if (rememberMatch && rememberMatch[1]?.trim().length > 3) {
    const memoryContent = rememberMatch[1].trim();
    let category: Memory['category'] = 'general';
    if (/prefer|like|dislike|always|never|favorite/i.test(memoryContent)) {
      category = 'preference';
    } else if (/typescript|react|python|code|git|stack|framework|library/i.test(memoryContent)) {
      category = 'tech_stack';
    } else if (/name|live|city|work|job|role|age/i.test(memoryContent)) {
      category = 'personal';
    } else if (/project|app|build|working on/i.test(memoryContent)) {
      category = 'project';
    }

    const memory = await addCloudMemory(userId, memoryContent, category, 4, 'user_command');
    return {
      handled: true,
      message: `I've stored this in my long-term memory: "${memoryContent}".`,
      memory,
    };
  }

  const forgetMatch = text.match(/^(?:please\s+)?forget\s+(?:this[:\s]+|that\s+|about\s+|my\s+)?(.*)$/i);
  if (forgetMatch && forgetMatch[1]?.trim().length > 2) {
    const targetQuery = forgetMatch[1].trim().toLowerCase();
    const matching = existingMemories.find((m) =>
      m.content.toLowerCase().includes(targetQuery)
    );

    if (matching) {
      await deleteCloudMemory(userId, matching.id);
      return {
        handled: true,
        message: `I have forgotten that: "${matching.content}".`,
      };
    }
  }

  return { handled: false };
}

/**
 * Format memories into context string for Gemini prompt.
 * Only injects memories relevant to the current conversation query.
 */
export function formatMemoriesForPrompt(memories: Memory[], queryText?: string): string {
  if (!memories || memories.length === 0) return '';

  let selectedMemories = memories;
  if (queryText && queryText.trim()) {
    const tokens = new Set(
      queryText
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2)
    );

    selectedMemories = [...memories].sort((a, b) => {
      let scoreA = a.importance || 3;
      let scoreB = b.importance || 3;

      const wordsA = a.content.toLowerCase().split(/\s+/);
      const wordsB = b.content.toLowerCase().split(/\s+/);

      wordsA.forEach((w) => {
        if (tokens.has(w)) scoreA += 5;
      });
      wordsB.forEach((w) => {
        if (tokens.has(w)) scoreB += 5;
      });

      if (tokens.has(a.category.toLowerCase())) scoreA += 3;
      if (tokens.has(b.category.toLowerCase())) scoreB += 3;

      return scoreB - scoreA;
    });
  }

  // Inject only the top relevant memories (up to 8) to prevent token bloat
  const relevantList = selectedMemories.slice(0, 8);
  const memoryLines = relevantList
    .map((m) => `- [${m.category.toUpperCase()}] ${m.content}`)
    .join('\n');

  return `\n\n### Relevant User Preferences & Context:\n${memoryLines}\nApply these user preferences naturally to the response.`;
}
