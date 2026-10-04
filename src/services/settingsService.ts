import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { UserSettings } from '../types/chat';
import { DEFAULT_SETTINGS } from '../utils/storage';

export function subscribeToUserSettings(
  userId: string,
  callback: (settings: UserSettings) => void,
  onError?: (err: any) => void
) {
  const path = `users/${userId}/settings/preferences`;
  return onSnapshot(
    doc(db, 'users', userId, 'settings', 'preferences'),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback({
          userId,
          model: data.model || DEFAULT_SETTINGS.model,
          temperature: data.temperature ?? DEFAULT_SETTINGS.temperature,
          systemPrompt: data.systemPrompt || DEFAULT_SETTINGS.systemPrompt,
          memoryEnabled: data.memoryEnabled ?? true,
          autoScroll: data.autoScroll ?? true,
          soundEffects: data.soundEffects ?? false,
          webSearchDefault: data.webSearchDefault ?? false,
          voiceSettings: {
            ...DEFAULT_SETTINGS.voiceSettings,
            ...(data.voiceSettings || {}),
          },
        });
      } else {
        callback({ ...DEFAULT_SETTINGS, userId });
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
      onError?.(err);
    }
  );
}

export async function saveCloudUserSettings(
  userId: string,
  settings: Partial<UserSettings>
): Promise<void> {
  const path = `users/${userId}/settings/preferences`;
  try {
    await setDoc(
      doc(db, 'users', userId, 'settings', 'preferences'),
      {
        ...settings,
        userId,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
