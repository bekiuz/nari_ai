import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase/config';
import { UploadedMediaItem } from '../types/chat';
import { getAuthToken } from './authService';

export function subscribeToUserMedia(
  userId: string,
  callback: (items: UploadedMediaItem[]) => void,
  onError?: (err: any) => void
) {
  const filesPath = `users/${userId}/files`;
  const imagesPath = `users/${userId}/images`;

  let filesList: UploadedMediaItem[] = [];
  let imagesList: UploadedMediaItem[] = [];

  const unsubFiles = onSnapshot(
    collection(db, filesPath),
    (snapshot) => {
      filesList = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId,
          name: data.name || 'Untitled File',
          type: 'file',
          mimeType: data.mimeType || 'text/plain',
          size: data.size || 0,
          dataUrl: data.dataUrl,
          downloadUrl: data.downloadUrl,
          textPreview: data.textPreview,
          chatId: data.chatId || '',
          timestamp: data.createdAt || Date.now(),
        };
      });
      const combined = [...filesList, ...imagesList];
      combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      callback(combined);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, filesPath);
      onError?.(err);
    }
  );

  const unsubImages = onSnapshot(
    collection(db, imagesPath),
    (snapshot) => {
      imagesList = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId,
          name: data.name || 'Untitled Image',
          type: 'image',
          mimeType: data.mimeType || 'image/png',
          size: data.size || 0,
          dataUrl: data.dataUrl,
          downloadUrl: data.downloadUrl,
          chatId: data.chatId || '',
          timestamp: data.createdAt || Date.now(),
        };
      });
      const combined = [...filesList, ...imagesList];
      combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      callback(combined);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, imagesPath);
      onError?.(err);
    }
  );

  return () => {
    unsubFiles();
    unsubImages();
  };
}

export async function saveCloudMediaItem(
  userId: string,
  item: UploadedMediaItem
): Promise<void> {
  const collectionName = item.type === 'image' ? 'images' : 'files';
  const path = `users/${userId}/${collectionName}/${item.id}`;

  try {
    await setDoc(doc(db, `users/${userId}/${collectionName}`, item.id), {
      id: item.id,
      userId,
      name: item.name,
      type: item.type,
      mimeType: item.mimeType,
      size: item.size,
      dataUrl: item.dataUrl || null,
      downloadUrl: item.downloadUrl || null,
      textPreview: item.textPreview || null,
      chatId: item.chatId,
      createdAt: item.timestamp,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

/**
 * Uploads a file to Firebase Storage and extracts its readable text contents for Gemini analysis.
 */
export async function uploadFileWithStorage(
  userId: string,
  file: File,
  chatId: string = '',
  onProgress?: (progress: number) => void
): Promise<UploadedMediaItem> {
  const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let downloadUrl = '';
  let textPreview = '';
  let dataUrl = '';

  // 1. Read file as base64 and extract readable text
  const fileDataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      dataUrl = result;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Extract readable text via server endpoint
  try {
    const token = await getAuthToken();
    const extractRes = await fetch('/api/files/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || 'text/plain',
        fileDataBase64,
      }),
    });

    if (extractRes.ok) {
      const extractData = await extractRes.json();
      textPreview = extractData.text || '';
    }
  } catch (extractErr) {
    console.warn('Text extraction fallback:', extractErr);
  }

  // 2. Upload to Firebase Storage with progress tracking
  try {
    const storageRef = ref(storage, `users/${userId}/files/${fileId}/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress?.(Math.round(progress));
        },
        (error) => {
          console.warn('Storage upload notice (falling back to database metadata):', error);
          resolve(); // Resolve to allow metadata saving even if storage has rules restriction
        },
        async () => {
          try {
            downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          } catch (_) {}
          resolve();
        }
      );
    });
  } catch (storageErr) {
    console.warn('Storage upload error notice:', storageErr);
  }

  const mediaItem: UploadedMediaItem = {
    id: fileId,
    userId,
    name: file.name,
    type: 'file',
    mimeType: file.type || 'text/plain',
    size: file.size,
    dataUrl,
    downloadUrl: downloadUrl || undefined,
    textPreview: textPreview || undefined,
    chatId,
    timestamp: Date.now(),
  };

  await saveCloudMediaItem(userId, mediaItem);
  return mediaItem;
}

export async function deleteCloudMediaItem(
  userId: string,
  id: string,
  type: 'image' | 'file',
  fileName?: string
): Promise<void> {
  const collectionName = type === 'image' ? 'images' : 'files';
  const path = `users/${userId}/${collectionName}/${id}`;

  try {
    await deleteDoc(doc(db, `users/${userId}/${collectionName}`, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }

  // Also remove from storage if present
  if (fileName) {
    try {
      const storageRef = ref(storage, `users/${userId}/${collectionName}/${id}/${fileName}`);
      await deleteObject(storageRef);
    } catch (_) {}
  }
}
