/**
 * Chat-specific reactive stores.
 * Messages live only in memory (P2P, not persisted).
 */
import { writable, derived } from 'svelte/store';
import type { ChatMessage, Conversation } from '$lib/types/chat';

// ─── Conversations (from DB) ─────────────────────────────
export const conversations = writable<Conversation[]>([]);

// ─── Active Conversation ─────────────────────────────────
export const activeConversationId = writable<string | null>(null);

// ─── Messages per conversation (in-memory, ephemeral) ────
export const chatMessages = writable<Record<string, ChatMessage[]>>({});

// ─── Chat-only WebRTC connections (keyed by userId) ──────
export const chatPeers = writable<Record<string, RTCPeerConnection>>({});
export const chatDataChannels = writable<Record<string, RTCDataChannel>>({});

/** Set of userId whose chat connection is relayed through a TURN server */
export const turnRelayChatPeers = writable<Set<string>>(new Set());

// ─── Unread counts per conversation ──────────────────────
export const unreadCounts = writable<Record<string, number>>({});

// ─── Global transcription language index (shared across all voice players) ──
export const transcribeLangIndex = writable<number>(0);

// ─── Typing indicators per conversation ──────────────────
export const typingUsers = writable<Record<string, { userId: string; username: string }[]>>({});

// ─── File transfer state ─────────────────────────────────
export const chatFileOffers = writable<Record<string, { file: File; conversationId: string }>>({});
export const chatPendingTransfers = writable<Record<string, {
    fileId: string;
    totalBytes: number;
    receivedBytes: number;
    chunks: ArrayBuffer[];
    mimeType: string;
}>>({});

// ─── UI state ────────────────────────────────────────────
export const showCreateGroupModal = writable(false);
export const chatSearchQuery = writable('');

// ─── Derived stores ──────────────────────────────────────
export const activeConversation = derived(
    [conversations, activeConversationId],
    ([$convs, $id]) => $id ? $convs.find(c => c.id === $id) || null : null
);

export const activeMessages = derived(
    [chatMessages, activeConversationId],
    ([$msgs, $id]) => $id ? ($msgs[$id] || []) : []
);

export const sortedConversations = derived(
    [conversations, chatSearchQuery],
    ([$convs, $q]) => {
        let filtered = $convs;
        if ($q) {
            const q = $q.toLowerCase();
            filtered = $convs.filter(c => {
                if (c.name?.toLowerCase().includes(q)) return true;
                return c.members.some(m =>
                    m.username.toLowerCase().includes(q) ||
                    m.displayName?.toLowerCase().includes(q)
                );
            });
        }
        return filtered.sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));
    }
);
