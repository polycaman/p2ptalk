/**
 * Chat-only WebRTC connections for P2P messaging between friends.
 * Manages lightweight data-channel-only peer connections (no media).
 *
 * Connection rule: when both friends are online, the user with the
 * lexicographically smaller userId initiates the offer. This prevents
 * duplicate connections.
 */
import { get } from 'svelte/store';
import { socket, userData } from '$lib/stores/callState';
import {
    chatPeers, chatDataChannels, chatMessages,
    conversations, activeConversationId, unreadCounts,
    typingUsers, chatFileOffers, chatPendingTransfers,
    turnRelayChatPeers
} from '$lib/stores/chatStore';
import { detectRelay } from '$lib/webrtc';
import type { ChatMessage, MessageMetadata } from '$lib/types/chat';

const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
];

// TURN credentials fetched from server
let cachedChatTurn: RTCIceServer[] = [];
let chatTurnFetchedAt = 0;

async function getChatTurnServers(): Promise<RTCIceServer[]> {
    if (cachedChatTurn.length > 0 && Date.now() - chatTurnFetchedAt < 5 * 60 * 1000) {
        return cachedChatTurn;
    }
    try {
        const res = await fetch('/api/turn-credentials');
        if (res.ok) {
            const data = await res.json();
            cachedChatTurn = data.iceServers;
            chatTurnFetchedAt = Date.now();
            return cachedChatTurn;
        }
    } catch (e) {
        console.warn('[TURN] Failed to fetch chat credentials');
    }
    return [];
}

let CHAT_RTC_CONFIG: RTCConfiguration = {
    iceServers: [...STUN_SERVERS]
};

let turnReadyPromise: Promise<void> | null = null;

/** Call once on init to pre-fetch TURN credentials */
export function initChatTurn(): Promise<void> {
    if (!turnReadyPromise) {
        turnReadyPromise = getChatTurnServers().then(turn => {
            CHAT_RTC_CONFIG = { iceServers: [...STUN_SERVERS, ...turn] };
            console.log('[Chat TURN] Credentials ready,', turn.length, 'TURN servers');
        });
    }
    return turnReadyPromise;
}

// Reconnection tracking: per-peer retry count + timers
const chatReconnectAttempts = new Map<string, number>();
const chatReconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
const MAX_CHAT_RECONNECT = 5;

function scheduleChatReconnect(targetUserId: string) {
    const attempts = (chatReconnectAttempts.get(targetUserId) || 0) + 1;
    if (attempts > MAX_CHAT_RECONNECT) {
        console.warn(`[Chat] Max reconnect attempts reached for ${targetUserId}`);
        chatReconnectAttempts.delete(targetUserId);
        return;
    }
    chatReconnectAttempts.set(targetUserId, attempts);
    const delay = Math.min(2000 * Math.pow(1.5, attempts - 1), 15000);
    console.log(`[Chat] Scheduling reconnect #${attempts} to ${targetUserId} in ${delay}ms`);
    const timer = setTimeout(() => {
        chatReconnectTimers.delete(targetUserId);
        const user = get(userData);
        // Only the lower-ID user initiates to avoid duplicate connections
        if (user && user.id < targetUserId) {
            initiateChatConnection(targetUserId);
        }
    }, delay);
    chatReconnectTimers.set(targetUserId, timer);
}

function cancelChatReconnect(targetUserId: string) {
    const timer = chatReconnectTimers.get(targetUserId);
    if (timer) clearTimeout(timer);
    chatReconnectTimers.delete(targetUserId);
    chatReconnectAttempts.delete(targetUserId);
}

// ═══════════════════════════════════════════════════════════
// Connection Management
// ═══════════════════════════════════════════════════════════

export async function initiateChatConnection(targetUserId: string) {
    const existing = get(chatPeers);
    if (existing[targetUserId]) return;

    // Ensure TURN credentials are loaded before creating the peer
    await initChatTurn();

    // Re-check after await (another connection may have started)
    if (get(chatPeers)[targetUserId]) return;

    const peer = createChatPeer(targetUserId, true);
    try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        get(socket).emit('chat-signal', {
            to: targetUserId,
            signal: peer.localDescription
        });
    } catch (e) {
        console.error('[Chat] Offer creation failed:', e);
    }
}

export async function handleChatSignal(signal: any, fromUserId: string) {
    // Ensure TURN is ready before creating any peer
    await initChatTurn();

    let peer = get(chatPeers)[fromUserId];

    if (signal.type === 'offer') {
        if (peer) {
            try { peer.close(); } catch { /* ignore */ }
            chatPeers.update(p => { delete p[fromUserId]; return { ...p }; });
            chatDataChannels.update(dc => { delete dc[fromUserId]; return { ...dc }; });
        }
        peer = createChatPeer(fromUserId, false);
        peer.setRemoteDescription(new RTCSessionDescription(signal))
            .then(() => peer.createAnswer())
            .then(answer => peer.setLocalDescription(answer))
            .then(() => {
                get(socket).emit('chat-signal', {
                    to: fromUserId,
                    signal: peer.localDescription
                });
            })
            .catch(e => console.error('[Chat] Answer failed:', e));
    } else if (signal.type === 'answer') {
        if (peer) {
            peer.setRemoteDescription(new RTCSessionDescription(signal))
                .catch(e => console.error('[Chat] Set answer failed:', e));
        }
    } else if (signal.candidate) {
        if (peer) {
            peer.addIceCandidate(new RTCIceCandidate(signal.candidate))
                .catch(e => console.error('[Chat] ICE candidate failed:', e));
        }
    }
}

function createChatPeer(targetUserId: string, isInitiator: boolean): RTCPeerConnection {
    const peer = new RTCPeerConnection(CHAT_RTC_CONFIG);
    chatPeers.update(p => ({ ...p, [targetUserId]: peer }));

    if (isInitiator) {
        const dc = peer.createDataChannel('p2p-chat');
        setupChatDataChannel(dc, targetUserId);
    }

    peer.ondatachannel = (e) => {
        setupChatDataChannel(e.channel, targetUserId);
    };

    peer.onicecandidate = (e) => {
        if (e.candidate) {
            get(socket).emit('chat-signal', {
                to: targetUserId,
                signal: { candidate: e.candidate }
            });
        }
    };

    let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

    peer.oniceconnectionstatechange = () => {
        const state = peer.iceConnectionState;
        console.log(`[Chat ICE] ${targetUserId}: ${state}`);

        if (state === 'connected' || state === 'completed') {
            // Connection recovered — clear any pending timers and reset reconnect counter
            if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null; }
            cancelChatReconnect(targetUserId);
            detectRelay(peer, targetUserId, 'chat');
        }

        if (state === 'disconnected') {
            // Grace period: wait 4s then try ICE restart, don't destroy immediately
            if (!disconnectTimer) {
                disconnectTimer = setTimeout(() => {
                    disconnectTimer = null;
                    if (peer.iceConnectionState === 'disconnected') {
                        console.log(`[Chat ICE] Attempting ICE restart for ${targetUserId}`);
                        try {
                            peer.restartIce();
                            const user = get(userData);
                            // Re-negotiate if we are the initiator
                            if (user && user.id < targetUserId) {
                                peer.createOffer({ iceRestart: true })
                                    .then(offer => peer.setLocalDescription(offer))
                                    .then(() => {
                                        get(socket).emit('chat-signal', {
                                            to: targetUserId,
                                            signal: peer.localDescription
                                        });
                                    })
                                    .catch(() => {});
                            }
                        } catch { /* restartIce not supported, will fall through to failed */ }
                    }
                }, 4000);
            }
        }

        if (state === 'failed') {
            if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null; }
            turnRelayChatPeers.update(s => { s.delete(targetUserId); return new Set(s); });
            cleanupChatPeer(targetUserId);
            scheduleChatReconnect(targetUserId);
        }

        if (state === 'closed') {
            if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null; }
            turnRelayChatPeers.update(s => { s.delete(targetUserId); return new Set(s); });
        }
    };

    return peer;
}

export function cleanupChatPeer(userId: string) {
    const peer = get(chatPeers)[userId];
    if (peer) {
        try { peer.close(); } catch { /* ignore */ }
    }
    chatPeers.update(p => { delete p[userId]; return { ...p }; });
    chatDataChannels.update(dc => { delete dc[userId]; return { ...dc }; });
}

export function cleanupAllChatPeers() {
    const allPeers = get(chatPeers);
    Object.values(allPeers).forEach(p => { try { p.close(); } catch { /* ignore */ } });
    chatPeers.set({});
    chatDataChannels.set({});
    // Clear all reconnect timers
    chatReconnectTimers.forEach(t => clearTimeout(t));
    chatReconnectTimers.clear();
    chatReconnectAttempts.clear();
}

// ═══════════════════════════════════════════════════════════
// Data Channel
// ═══════════════════════════════════════════════════════════

function setupChatDataChannel(dc: RTCDataChannel, userId: string) {
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
        console.log(`[Chat DC] Connected to ${userId}`);
        chatDataChannels.update(dcs => ({ ...dcs, [userId]: dc }));
    };

    dc.onmessage = async (e) => {
        if (typeof e.data === 'string') {
            try {
                const data = JSON.parse(e.data);
                handleDataChannelMessage(data, userId);
            } catch (err) {
                console.warn('[Chat DC] Parse error:', err);
            }
        } else {
            handleFileChunk(e.data as ArrayBuffer, userId);
        }
    };

    dc.onclose = () => {
        chatDataChannels.update(dcs => { delete dcs[userId]; return { ...dcs }; });
    };

    dc.onerror = (e) => {
        console.error('[Chat DC] Error:', e);
    };
}

function handleDataChannelMessage(data: any, fromUserId: string) {
    switch (data.action) {
        case 'chat-message':
            onIncomingMessage(data.message);
            break;
        case 'typing':
            onTyping(data.conversationId, fromUserId, data.username, data.isTyping);
            break;
        case 'file-offer':
            onFileOffer(data, fromUserId);
            break;
        case 'file-accept':
            onFileAccept(data.fileId, fromUserId);
            break;
        case 'file-reject':
            onFileReject(data.fileId);
            break;
    }
}

// ═══════════════════════════════════════════════════════════
// Incoming Messages
// ═══════════════════════════════════════════════════════════

function onIncomingMessage(msg: ChatMessage) {
    const conversationId = msg.conversationId;

    chatMessages.update(msgs => {
        const convMsgs = msgs[conversationId] || [];
        if (convMsgs.find(m => m.id === msg.id)) return msgs;
        return { ...msgs, [conversationId]: [...convMsgs, msg] };
    });

    conversations.update(convs => convs.map(c =>
        c.id === conversationId
            ? { ...c, lastMessage: msg, lastActivity: msg.timestamp }
            : c
    ));

    const activeId = get(activeConversationId);
    if (activeId !== conversationId) {
        unreadCounts.update(uc => ({
            ...uc,
            [conversationId]: (uc[conversationId] || 0) + 1
        }));
    }
}

function onTyping(conversationId: string, userId: string, username: string, isTyping: boolean) {
    typingUsers.update(tu => {
        const current = tu[conversationId] || [];
        if (isTyping) {
            if (!current.find(u => u.userId === userId)) {
                return { ...tu, [conversationId]: [...current, { userId, username }] };
            }
        } else {
            return { ...tu, [conversationId]: current.filter(u => u.userId !== userId) };
        }
        return tu;
    });
}

// ═══════════════════════════════════════════════════════════
// Send Message
// ═══════════════════════════════════════════════════════════

export function sendChatMessage(
    conversationId: string,
    content: string,
    type: ChatMessage['type'] = 'text',
    metadata?: MessageMetadata
) {
    const user = get(userData);
    const conv = get(conversations).find(c => c.id === conversationId);
    if (!conv) return;

    const msg: ChatMessage = {
        id: crypto.randomUUID(),
        conversationId,
        senderId: user.id,
        senderName: user.displayName || user.username,
        type,
        content,
        metadata,
        timestamp: Date.now()
    };

    chatMessages.update(msgs => {
        const convMsgs = msgs[conversationId] || [];
        return { ...msgs, [conversationId]: [...convMsgs, msg] };
    });

    conversations.update(convs => convs.map(c =>
        c.id === conversationId
            ? { ...c, lastMessage: msg, lastActivity: msg.timestamp }
            : c
    ));

    const dcs = get(chatDataChannels);
    const myId = user.id;

    for (const member of conv.members) {
        if (member.userId === myId) continue;
        const dc = dcs[member.userId];
        if (dc && dc.readyState === 'open') {
            dc.send(JSON.stringify({
                action: 'chat-message',
                conversationId,
                message: msg
            }));
        }
    }
}

// ═══════════════════════════════════════════════════════════
// Typing Indicator
// ═══════════════════════════════════════════════════════════

let typingTimeout: ReturnType<typeof setTimeout> | null = null;

export function setTyping(conversationId: string, isTyping: boolean) {
    const user = get(userData);
    const conv = get(conversations).find(c => c.id === conversationId);
    if (!conv) return;

    const dcs = get(chatDataChannels);
    const payload = JSON.stringify({
        action: 'typing',
        conversationId,
        username: user.displayName || user.username,
        isTyping
    });

    for (const member of conv.members) {
        if (member.userId === user.id) continue;
        const dc = dcs[member.userId];
        if (dc && dc.readyState === 'open') {
            dc.send(payload);
        }
    }

    if (isTyping) {
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => setTyping(conversationId, false), 3000);
    }
}

// ═══════════════════════════════════════════════════════════
// File Transfer
// ═══════════════════════════════════════════════════════════

export function offerFile(conversationId: string, file: File) {
    const user = get(userData);
    const conv = get(conversations).find(c => c.id === conversationId);
    if (!conv) return;

    const fileId = crypto.randomUUID();
    chatFileOffers.update(fo => ({ ...fo, [fileId]: { file, conversationId } }));

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    const msg: ChatMessage = {
        id: fileId,
        conversationId,
        senderId: user.id,
        senderName: user.displayName || user.username,
        type: isImage ? 'image' : isVideo ? 'video' : 'file',
        content: file.name,
        metadata: {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            fileData: URL.createObjectURL(file),
            progress: 100
        },
        timestamp: Date.now()
    };

    chatMessages.update(msgs => {
        const convMsgs = msgs[conversationId] || [];
        return { ...msgs, [conversationId]: [...convMsgs, msg] };
    });
    conversations.update(convs => convs.map(c =>
        c.id === conversationId
            ? { ...c, lastMessage: msg, lastActivity: msg.timestamp }
            : c
    ));

    const offer = {
        action: 'file-offer',
        conversationId,
        fileId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        senderId: user.id,
        senderName: user.displayName || user.username
    };

    const dcs = get(chatDataChannels);
    for (const member of conv.members) {
        if (member.userId === user.id) continue;
        const dc = dcs[member.userId];
        if (dc && dc.readyState === 'open') {
            dc.send(JSON.stringify(offer));
        }
    }
}

function onFileOffer(data: any, fromUserId: string) {
    const isImage = data.mimeType?.startsWith('image/');
    const isVideo = data.mimeType?.startsWith('video/');
    const isVoice = data.mimeType?.startsWith('audio/');
    const autoAccept = !!data.autoAccept;

    const msg: ChatMessage = {
        id: data.fileId,
        conversationId: data.conversationId,
        senderId: data.senderId,
        senderName: data.senderName,
        type: isVoice ? 'voice' : isImage ? 'image' : isVideo ? 'video' : 'file',
        content: isVoice ? 'Voice message' : data.fileName,
        metadata: {
            fileName: data.fileName,
            fileSize: data.fileSize,
            mimeType: data.mimeType,
            progress: autoAccept ? 1 : 0,
            accepted: autoAccept ? true : null,
            duration: data.duration
        },
        timestamp: Date.now()
    };

    chatMessages.update(msgs => {
        const convMsgs = msgs[data.conversationId] || [];
        return { ...msgs, [data.conversationId]: [...convMsgs, msg] };
    });

    conversations.update(convs => convs.map(c =>
        c.id === data.conversationId
            ? { ...c, lastMessage: msg, lastActivity: msg.timestamp }
            : c
    ));

    const activeId = get(activeConversationId);
    if (activeId !== data.conversationId) {
        unreadCounts.update(uc => ({
            ...uc,
            [data.conversationId]: (uc[data.conversationId] || 0) + 1
        }));
    }

    // Auto-accept voice messages
    if (autoAccept) {
        chatPendingTransfers.update(pt => ({
            ...pt,
            [fromUserId]: {
                fileId: data.fileId,
                totalBytes: data.fileSize || 0,
                receivedBytes: 0,
                chunks: [],
                mimeType: data.mimeType || 'audio/webm'
            }
        }));
        const dc = get(chatDataChannels)[fromUserId];
        if (dc && dc.readyState === 'open') {
            dc.send(JSON.stringify({ action: 'file-accept', fileId: data.fileId }));
        }
    }
}

export function acceptFileTransfer(fileId: string, senderId: string) {
    const dc = get(chatDataChannels)[senderId];
    if (!dc || dc.readyState !== 'open') return;

    const allMsgs = get(chatMessages);
    let targetMsg: ChatMessage | null = null;
    let convId = '';
    for (const [cid, msgs] of Object.entries(allMsgs)) {
        const found = msgs.find(m => m.id === fileId);
        if (found) { targetMsg = found; convId = cid; break; }
    }
    if (!targetMsg || !targetMsg.metadata) return;

    chatPendingTransfers.update(pt => ({
        ...pt,
        [senderId]: {
            fileId,
            totalBytes: targetMsg!.metadata!.fileSize || 0,
            receivedBytes: 0,
            chunks: [],
            mimeType: targetMsg!.metadata!.mimeType || 'application/octet-stream'
        }
    }));

    chatMessages.update(msgs => ({
        ...msgs,
        [convId]: (msgs[convId] || []).map(m =>
            m.id === fileId
                ? { ...m, metadata: { ...m.metadata!, accepted: true, progress: 1 } }
                : m
        )
    }));

    dc.send(JSON.stringify({ action: 'file-accept', fileId }));
}

export function rejectFileTransfer(fileId: string, senderId: string) {
    const dc = get(chatDataChannels)[senderId];
    if (dc && dc.readyState === 'open') {
        dc.send(JSON.stringify({ action: 'file-reject', fileId }));
    }

    const allMsgs = get(chatMessages);
    for (const [cid] of Object.entries(allMsgs)) {
        const found = allMsgs[cid]?.find(m => m.id === fileId);
        if (found) {
            chatMessages.update(am => ({
                ...am,
                [cid]: am[cid].map(m =>
                    m.id === fileId
                        ? { ...m, metadata: { ...m.metadata!, accepted: false } }
                        : m
                )
            }));
            break;
        }
    }
}

async function onFileAccept(fileId: string, fromUserId: string) {
    const offers = get(chatFileOffers);
    const offer = offers[fileId];
    if (!offer) return;

    const dc = get(chatDataChannels)[fromUserId];
    if (!dc || dc.readyState !== 'open') return;

    const buffer = await offer.file.arrayBuffer();
    const chunkSize = 16384;

    for (let i = 0; i < buffer.byteLength; i += chunkSize) {
        const chunk = buffer.slice(i, i + chunkSize);
        if (dc.bufferedAmount > 16000000) {
            await new Promise(r => setTimeout(r, 100));
        }
        dc.send(chunk);
    }

    chatFileOffers.update(fo => { delete fo[fileId]; return { ...fo }; });
}

function onFileReject(fileId: string) {
    chatFileOffers.update(fo => { delete fo[fileId]; return { ...fo }; });
}

function handleFileChunk(data: ArrayBuffer, fromUserId: string) {
    const currentPending = get(chatPendingTransfers);
    const transfer = currentPending[fromUserId];
    if (!transfer) return;

    transfer.chunks.push(data);
    transfer.receivedBytes += data.byteLength;

    const progress = Math.min(100, Math.round((transfer.receivedBytes / transfer.totalBytes) * 100));
    const complete = transfer.receivedBytes >= transfer.totalBytes;

    const allMsgs = get(chatMessages);
    for (const [cid] of Object.entries(allMsgs)) {
        const found = allMsgs[cid]?.find(m => m.id === transfer.fileId);
        if (found) {
            chatMessages.update(am => ({
                ...am,
                [cid]: am[cid].map(m => {
                    if (m.id !== transfer.fileId) return m;
                    const updated = { ...m, metadata: { ...m.metadata!, progress } };
                    if (complete) {
                        const blob = new Blob(transfer.chunks, { type: transfer.mimeType });
                        updated.metadata!.fileData = URL.createObjectURL(blob);
                        updated.metadata!.progress = 100;
                        chatPendingTransfers.update(pt => { delete pt[fromUserId]; return { ...pt }; });
                    }
                    return updated;
                })
            }));
            break;
        }
    }
}

// ═══════════════════════════════════════════════════════════
// Voice Messages
// ═══════════════════════════════════════════════════════════

export function sendVoiceMessage(conversationId: string, blob: Blob, duration: number) {
    const user = get(userData);
    const conv = get(conversations).find(c => c.id === conversationId);
    if (!conv) return;

    const fileId = crypto.randomUUID();
    const file = new File([blob], `voice-${fileId}.webm`, { type: 'audio/webm' });

    chatFileOffers.update(fo => ({ ...fo, [fileId]: { file, conversationId } }));

    const msg: ChatMessage = {
        id: fileId,
        conversationId,
        senderId: user.id,
        senderName: user.displayName || user.username,
        type: 'voice',
        content: 'Voice message',
        metadata: {
            fileName: file.name,
            fileSize: file.size,
            mimeType: 'audio/webm',
            fileData: URL.createObjectURL(blob),
            duration,
            progress: 100
        },
        timestamp: Date.now()
    };

    chatMessages.update(msgs => {
        const convMsgs = msgs[conversationId] || [];
        return { ...msgs, [conversationId]: [...convMsgs, msg] };
    });
    conversations.update(convs => convs.map(c =>
        c.id === conversationId
            ? { ...c, lastMessage: msg, lastActivity: msg.timestamp }
            : c
    ));

    // Voice messages are auto-accepted by receivers
    const offer = {
        action: 'file-offer',
        conversationId,
        fileId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: 'audio/webm',
        senderId: user.id,
        senderName: user.displayName || user.username,
        autoAccept: true,
        duration
    };

    const dcs = get(chatDataChannels);
    for (const member of conv.members) {
        if (member.userId === user.id) continue;
        const dc = dcs[member.userId];
        if (dc && dc.readyState === 'open') {
            dc.send(JSON.stringify(offer));
        }
    }
}

// ═══════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════

export function isChatConnected(userId: string): boolean {
    const dc = get(chatDataChannels)[userId];
    return !!dc && dc.readyState === 'open';
}

export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
