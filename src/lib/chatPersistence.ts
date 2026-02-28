/**
 * Chat persistence via IndexedDB.
 * Stores message metadata in one object store and media Blobs in another.
 * This removes the ~5 MB localStorage cap – large videos/images persist fine.
 */
import { writable } from 'svelte/store';
import { chatMessages } from '$lib/stores/chatStore';
import type { ChatMessage } from '$lib/types/chat';

/** Reactive store – updated automatically after every save / clear */
export const chatStorageSize = writable<number>(0);

/** IDs whose media blob is already in IndexedDB (skip re-fetch) */
const persistedMediaIds = new Set<string>();

const DB_NAME = 'p2p-chat-db';
const DB_VERSION = 1;
const MSG_STORE = 'chatMessages';
const MEDIA_STORE = 'chatMedia';
const OLD_LS_KEY = 'p2p-chat-messages'; // previous localStorage key

const MEDIA_REF = '__HAS_MEDIA__';
const DELETED_MARKER = '__MEDIA_DELETED__';

export { DELETED_MARKER };

// ─── Size helpers ────────────────────────────────────────

export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ─── IndexedDB helpers ──────────────────────────────────

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
    if (dbInstance) return Promise.resolve(dbInstance);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(MSG_STORE)) db.createObjectStore(MSG_STORE);
            if (!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE);
        };
        req.onsuccess = () => {
            dbInstance = req.result;
            dbInstance.onclose = () => { dbInstance = null; };
            resolve(dbInstance);
        };
        req.onerror = () => reject(req.error);
    });
}

// ─── Blob conversion helpers ────────────────────────────

async function fetchAsBlob(url: string): Promise<Blob | null> {
    try {
        const res = await fetch(url);
        return await res.blob();
    } catch {
        return null;
    }
}

function dataUrlToBlob(dataUrl: string): Blob | null {
    try {
        const [header, base64] = dataUrl.split(',');
        const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    } catch {
        return null;
    }
}

// ─── Storage size (async) ───────────────────────────────

export async function getChatStorageSize(): Promise<number> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            let total = 0;
            const t = db.transaction([MSG_STORE, MEDIA_STORE], 'readonly');

            const msgReq = t.objectStore(MSG_STORE).get('all');
            msgReq.onsuccess = () => {
                if (msgReq.result) {
                    total += new Blob([JSON.stringify(msgReq.result)]).size;
                }
            };

            const cursorReq = t.objectStore(MEDIA_STORE).openCursor();
            cursorReq.onsuccess = () => {
                const cursor = cursorReq.result;
                if (cursor) {
                    const val = cursor.value;
                    if (val instanceof Blob) total += val.size;
                    else if (typeof val === 'string') total += new Blob([val]).size;
                    cursor.continue();
                }
            };

            t.oncomplete = () => resolve(total);
            t.onerror = () => resolve(0);
        });
    } catch {
        return 0;
    }
}

// ─── Save messages ──────────────────────────────────────

export async function saveMessages(allMessages: Record<string, ChatMessage[]>): Promise<void> {
    try {
        const stripped: Record<string, ChatMessage[]> = {};
        const mediaToStore = new Map<string, Blob>();

        // Phase 1 – extract media blobs (async work before opening IDB tx)
        for (const [convId, msgs] of Object.entries(allMessages)) {
            const persistable = msgs.filter(m =>
                m.type === 'text' || m.type === 'system' ||
                (m.metadata?.progress === 100 && m.metadata?.fileData) ||
                m.metadata?.fileData === DELETED_MARKER ||
                m.metadata?.fileData === MEDIA_REF ||
                m.metadata?.accepted === false
            );

            const processed: ChatMessage[] = [];
            for (const m of persistable) {
                const fd = m.metadata?.fileData;

                if (!fd || fd === DELETED_MARKER || fd === MEDIA_REF) {
                    processed.push(m);
                    continue;
                }

                // Already persisted in a previous save – just mark as ref
                if (persistedMediaIds.has(m.id)) {
                    processed.push({
                        ...m,
                        metadata: { ...m.metadata, fileData: MEDIA_REF }
                    });
                    continue;
                }

                // Sender's own media (accepted is undefined) — save message but skip blob
                // The sender already has the file locally, no need to waste storage
                if (m.metadata?.accepted === undefined) {
                    processed.push({
                        ...m,
                        metadata: { ...m.metadata, fileData: undefined }
                    });
                    continue;
                }

                let blob: Blob | null = null;
                if (fd.startsWith('blob:')) {
                    blob = await fetchAsBlob(fd);
                } else if (fd.startsWith('data:')) {
                    blob = dataUrlToBlob(fd);
                }

                if (blob) {
                    mediaToStore.set(m.id, blob);
                    processed.push({
                        ...m,
                        metadata: { ...m.metadata, fileData: MEDIA_REF }
                    });
                } else {
                    processed.push({
                        ...m,
                        metadata: { ...m.metadata, fileData: undefined }
                    });
                }
            }

            if (processed.length > 0) stripped[convId] = processed;
        }

        // Phase 2 – single synchronous IDB transaction
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const t = db.transaction([MSG_STORE, MEDIA_STORE], 'readwrite');
            t.objectStore(MSG_STORE).put(stripped, 'all');

            for (const [msgId, blob] of mediaToStore.entries()) {
                t.objectStore(MEDIA_STORE).put(blob, msgId);
            }

            t.oncomplete = () => resolve();
            t.onerror = () => reject(t.error);
        });

        // Remember which IDs are now persisted so we don't re-fetch them
        for (const id of mediaToStore.keys()) persistedMediaIds.add(id);

        // Refresh the reactive size store
        refreshStorageSize();
    } catch (e) {
        console.warn('[ChatPersistence] Failed to save:', e);
    }
}

// ─── Load messages ──────────────────────────────────────

export async function loadMessages(): Promise<Record<string, ChatMessage[]>> {
    try {
        const db = await openDB();

        const messages: Record<string, ChatMessage[]> = await new Promise((resolve) => {
            const t = db.transaction(MSG_STORE, 'readonly');
            const req = t.objectStore(MSG_STORE).get('all');
            req.onsuccess = () => resolve(req.result || {});
            req.onerror = () => resolve({});
        });

        // Collect IDs that reference media
        const mediaIds: string[] = [];
        for (const msgs of Object.values(messages)) {
            for (const m of msgs) {
                if (m.metadata?.fileData === MEDIA_REF) mediaIds.push(m.id);
            }
        }

        if (mediaIds.length === 0) return messages;

        // Load blobs & create object URLs
        const mediaMap = new Map<string, string>();
        await new Promise<void>((resolve) => {
            const t = db.transaction(MEDIA_STORE, 'readonly');
            let pending = mediaIds.length;

            for (const id of mediaIds) {
                const req = t.objectStore(MEDIA_STORE).get(id);
                req.onsuccess = () => {
                    const blob = req.result;
                    if (blob instanceof Blob) {
                        mediaMap.set(id, URL.createObjectURL(blob));
                    }
                    if (--pending === 0) resolve();
                };
                req.onerror = () => {
                    if (--pending === 0) resolve();
                };
            }

            if (pending === 0) resolve();
        });

        // Re-attach media URLs to messages
        for (const msgs of Object.values(messages)) {
            for (const m of msgs) {
                if (m.metadata?.fileData === MEDIA_REF) {
                    const url = mediaMap.get(m.id);
                    m.metadata.fileData = url || DELETED_MARKER;
                }
            }
        }

        return messages;
    } catch {
        return {};
    }
}

// ─── Cleanup functions ──────────────────────────────────

export async function clearAllChatData(): Promise<void> {
    try {
        const db = await openDB();
        await new Promise<void>((resolve) => {
            const t = db.transaction([MSG_STORE, MEDIA_STORE], 'readwrite');
            t.objectStore(MSG_STORE).clear();
            t.objectStore(MEDIA_STORE).clear();
            t.oncomplete = () => resolve();
            t.onerror = () => resolve();
        });
    } catch { /* ignore */ }
    persistedMediaIds.clear();
    chatMessages.set({});
    chatStorageSize.set(0);
}

export async function clearMediaOnly(): Promise<void> {
    try {
        const db = await openDB();

        const messages: Record<string, ChatMessage[]> = await new Promise((resolve) => {
            const t = db.transaction(MSG_STORE, 'readonly');
            const req = t.objectStore(MSG_STORE).get('all');
            req.onsuccess = () => resolve(req.result || {});
            req.onerror = () => resolve({});
        });

        for (const msgs of Object.values(messages)) {
            for (const m of msgs) {
                if (m.metadata?.fileData === MEDIA_REF) {
                    m.metadata.fileData = DELETED_MARKER;
                }
            }
        }

        await new Promise<void>((resolve) => {
            const t = db.transaction([MSG_STORE, MEDIA_STORE], 'readwrite');
            t.objectStore(MEDIA_STORE).clear();
            t.objectStore(MSG_STORE).put(messages, 'all');
            t.oncomplete = () => resolve();
            t.onerror = () => resolve();
        });

        chatMessages.update(current => {
            const updated: Record<string, ChatMessage[]> = {};
            for (const [convId, msgs] of Object.entries(current)) {
                updated[convId] = msgs.map(msg => {
                    if (msg.type === 'text' || msg.type === 'system') return msg;
                    if (msg.metadata?.fileData && msg.metadata.fileData !== DELETED_MARKER) {
                        return { ...msg, metadata: { ...msg.metadata, fileData: DELETED_MARKER } };
                    }
                    return msg;
                });
            }
            return updated;
        });
        persistedMediaIds.clear();
        refreshStorageSize();
    } catch (e) {
        console.warn('[ChatPersistence] Failed to clear media:', e);
    }
}

/** Re-read total size from IndexedDB and push into the reactive store */
async function refreshStorageSize(): Promise<void> {
    const size = await getChatStorageSize();
    chatStorageSize.set(size);
}

// ─── Migrate old localStorage data ──────────────────────

async function migrateFromLocalStorage(): Promise<void> {
    try {
        const raw = localStorage.getItem(OLD_LS_KEY);
        if (!raw) return;

        const oldData = JSON.parse(raw) as Record<string, ChatMessage[]>;
        await saveMessages(oldData);
        localStorage.removeItem(OLD_LS_KEY);
        console.log('[ChatPersistence] Migrated from localStorage → IndexedDB');
    } catch (e) {
        console.warn('[ChatPersistence] Migration failed:', e);
    }
}

// ─── Auto-persist subscription ──────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let isLoaded = false;

function startAutoPersist(): () => void {
    const unsub = chatMessages.subscribe(msgs => {
        if (!isLoaded) return;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveMessages(msgs), 2000);
    });
    return unsub;
}

// ─── Initialize ─────────────────────────────────────────

export function initChatPersistence(): () => void {
    const unsub = startAutoPersist();

    (async () => {
        await migrateFromLocalStorage();
        const stored = await loadMessages();

        if (Object.keys(stored).length > 0) {
            chatMessages.update(current => {
                const merged: Record<string, ChatMessage[]> = { ...stored };
                for (const [convId, msgs] of Object.entries(current)) {
                    const storedMsgs = merged[convId] || [];
                    const storedIds = new Set(storedMsgs.map(m => m.id));
                    const newMsgs = msgs.filter(m => !storedIds.has(m.id));
                    merged[convId] = [...storedMsgs, ...newMsgs];
                }
                return merged;
            });
        }

        isLoaded = true;
        refreshStorageSize();
    })();

    return unsub;
}
