/**
 * WebRTC peer connection factory and data channel management.
 *
 * All functions read/write from the central Svelte stores so that
 * the reactive UI stays in sync automatically.
 */
import { get } from 'svelte/store';
import {
    isE2EEReady,
    encryptMessage, decryptMessage,
    encryptChunk, decryptChunk,
    removePeerCrypto, resetCrypto, getE2EEPeerCount
} from '$lib/crypto';
import {
    socket, userData,
    peers, dataChannels, localStream, localScreenStream,
    remoteStreams, initialRemoteState,
    messages, pendingTransfers, offeredFiles,
    roomId, turnRelayCallPeers
} from '$lib/stores/callState';

// ─── RTC Configuration ───────────────────────────────────

const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
];

// TURN credentials are fetched from the server (time-limited HMAC)
let cachedTurnServers: RTCIceServer[] = [];
let turnFetchedAt = 0;
let turnFetchPromise: Promise<RTCIceServer[]> | null = null;

export async function getTurnServers(): Promise<RTCIceServer[]> {
    // Cache for 5 minutes (credentials are valid for 24h)
    if (cachedTurnServers.length > 0 && Date.now() - turnFetchedAt < 5 * 60 * 1000) {
        return cachedTurnServers;
    }
    try {
        const res = await fetch('/api/turn-credentials');
        if (res.ok) {
            const data = await res.json();
            cachedTurnServers = data.iceServers;
            turnFetchedAt = Date.now();
            return cachedTurnServers;
        }
    } catch (e) {
        console.warn('[TURN] Failed to fetch credentials, using STUN only');
    }
    return [];
}

/**
 * Ensure TURN credentials are loaded. Deduplicates concurrent calls.
 * Safe to call from any handler — resolves quickly if already cached.
 */
export function ensureTurnReady(): Promise<RTCIceServer[]> {
    if (cachedTurnServers.length > 0 && Date.now() - turnFetchedAt < 5 * 60 * 1000) {
        return Promise.resolve(cachedTurnServers);
    }
    if (!turnFetchPromise) {
        turnFetchPromise = getTurnServers().finally(() => { turnFetchPromise = null; });
    }
    return turnFetchPromise;
}

export const rtcConfig: any = {
    iceServers: [...STUN_SERVERS]
};

/** Build ICE config — always includes TURN */
export async function getRtcConfigAsync(): Promise<RTCConfiguration> {
    const turnServers = await getTurnServers();
    return {
        iceServers: [...STUN_SERVERS, ...turnServers]
    };
}

/** Sync version — always includes cached TURN servers */
export function getRtcConfig(): RTCConfiguration {
    return {
        iceServers: [...STUN_SERVERS, ...cachedTurnServers]
    };
}

// ─── Peer Connection Factory ─────────────────────────────

export function createPeerConnection(targetUserId: string): RTCPeerConnection {
    const currentPeers = get(peers);
    if (currentPeers[targetUserId]) return currentPeers[targetUserId];

    const config = getRtcConfig();
    const peer = new RTCPeerConnection(config);
    peers.update(p => ({ ...p, [targetUserId]: peer }));

    const sock = get(socket);
    const user = get(userData);

    // Add Local Tracks
    const ls = get(localStream);
    const lss = get(localScreenStream);
    if (ls) {
        ls.getTracks().forEach(track => peer.addTrack(track, ls));
    }
    if (lss) {
        lss.getTracks().forEach(track => peer.addTrack(track, lss));
    }

    const dc = peer.createDataChannel('file-transfer');
    setupDataChannel(dc, targetUserId);

    peer.ondatachannel = (e) => {
        setupDataChannel(e.channel, targetUserId);
    };

    peer.onicecandidate = (event) => {
        if (event.candidate) {
            sock.emit('signal', {
                to: targetUserId,
                from: user.id,
                signal: { candidate: event.candidate }
            });
        }
    };

    peer.ontrack = (event) => {
        const stream = event.streams[0];
        const track = event.track;

        remoteStreams.update(rs => {
            if (!rs[targetUserId]) {
                rs[targetUserId] = { cam: null, screen: null };
            }

            const knownScreenId = get(initialRemoteState)[targetUserId]?.screenStreamId;

            console.log(`[ONTRACK] User: ${targetUserId}, Kind: ${track.kind}, StreamID: ${stream.id}, KnownScreenID: ${knownScreenId}`);

            if (track.kind === 'video') {
                if (knownScreenId && stream.id === knownScreenId) {
                    console.log('-> [STRICT] ID match. Assigning to SCREEN.');
                    rs[targetUserId].screen = stream;
                    if (rs[targetUserId].cam && rs[targetUserId].cam!.id === stream.id) {
                        rs[targetUserId].cam = null;
                    }
                } else {
                    if (rs[targetUserId].cam && rs[targetUserId].cam!.active) {
                        if (rs[targetUserId].cam!.id === stream.id) {
                            rs[targetUserId].cam = stream;
                        } else {
                            console.log('-> [DEDUCTION] Cam slot full. Assigning new stream to SCREEN.');
                            rs[targetUserId].screen = stream;
                        }
                    } else {
                        console.log('-> [DEFAULT] Assigning to CAM.');
                        rs[targetUserId].cam = stream;
                    }
                }
            } else if (track.kind === 'audio') {
                const storedMute = get(initialRemoteState)[targetUserId]?.micMuted;
                rs[targetUserId].micMuted = (storedMute !== undefined) ? storedMute : !track.enabled;
                console.log(`-> [AUDIO] Assigning audio stream for User ${targetUserId}`);
                rs[targetUserId].audio = stream;
            }

            return { ...rs };
        });

        // Clean up listeners when track ends
        track.onended = () => {
            console.log(`[TRACK ENDED] ${track.kind} ${stream.id}`);
            remoteStreams.update(rs => {
                if (rs[targetUserId]?.cam && rs[targetUserId].cam!.id === stream.id) {
                    rs[targetUserId].cam = null;
                    console.log('-> Removed from CAM');
                }
                if (rs[targetUserId]?.screen && rs[targetUserId].screen!.id === stream.id) {
                    rs[targetUserId].screen = null;
                    console.log('-> Removed from SCREEN');
                }
                return { ...rs };
            });
        };

        track.onmute = () => {
            console.log(`[TRACK MUTED] ${track.kind} ${stream.id}`);
        };
    };

    let iceDisconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let iceRestartAttempts = 0;
    const MAX_ICE_RESTARTS = 3;

    peer.oniceconnectionstatechange = () => {
        const state = peer.iceConnectionState;
        console.log(`[Call ICE] ${targetUserId}: ${state}`);

        if (state === 'connected' || state === 'completed') {
            // Connection (re-)established — reset timers
            if (iceDisconnectTimer) { clearTimeout(iceDisconnectTimer); iceDisconnectTimer = null; }
            iceRestartAttempts = 0;
            detectRelay(peer, targetUserId, 'call');
        }

        if (state === 'disconnected') {
            // Grace period: wait 3s then attempt ICE restart
            if (!iceDisconnectTimer) {
                iceDisconnectTimer = setTimeout(() => {
                    iceDisconnectTimer = null;
                    if (peer.iceConnectionState === 'disconnected' && iceRestartAttempts < MAX_ICE_RESTARTS) {
                        iceRestartAttempts++;
                        console.log(`[Call ICE] Attempting ICE restart #${iceRestartAttempts} for ${targetUserId}`);
                        try {
                            peer.restartIce();
                            peer.createOffer({ iceRestart: true })
                                .then(offer => peer.setLocalDescription(offer))
                                .then(() => {
                                    const s = get(socket);
                                    const u = get(userData);
                                    s.emit('signal', { to: targetUserId, from: u.id, signal: peer.localDescription });
                                })
                                .catch(err => console.error('[Call ICE] Restart offer failed:', err));
                        } catch (e) {
                            console.error('[Call ICE] restartIce failed:', e);
                        }
                    }
                }, 3000);
            }
        }

        if (state === 'failed') {
            if (iceDisconnectTimer) { clearTimeout(iceDisconnectTimer); iceDisconnectTimer = null; }
            // One last attempt via ICE restart before giving up
            if (iceRestartAttempts < MAX_ICE_RESTARTS) {
                iceRestartAttempts++;
                console.log(`[Call ICE] Failed — attempting restart #${iceRestartAttempts} for ${targetUserId}`);
                try {
                    peer.restartIce();
                    peer.createOffer({ iceRestart: true })
                        .then(offer => peer.setLocalDescription(offer))
                        .then(() => {
                            const s = get(socket);
                            const u = get(userData);
                            s.emit('signal', { to: targetUserId, from: u.id, signal: peer.localDescription });
                        })
                        .catch(() => {});
                } catch { /* not supported */ }
            } else {
                console.error(`[Call ICE] All restart attempts exhausted for ${targetUserId}`);
                turnRelayCallPeers.update(s => { s.delete(targetUserId); return new Set(s); });
                remoteStreams.update(rs => { delete rs[targetUserId]; return { ...rs }; });
                peers.update(p => { delete p[targetUserId]; return { ...p }; });
                dataChannels.update(dc => { delete dc[targetUserId]; return { ...dc }; });
            }
        }

        if (state === 'closed') {
            if (iceDisconnectTimer) { clearTimeout(iceDisconnectTimer); iceDisconnectTimer = null; }
            turnRelayCallPeers.update(s => { s.delete(targetUserId); return new Set(s); });
            remoteStreams.update(rs => { delete rs[targetUserId]; return { ...rs }; });
            peers.update(p => { delete p[targetUserId]; return { ...p }; });
            dataChannels.update(dc => { delete dc[targetUserId]; return { ...dc }; });
        }
    };

    return peer;
}

// ─── Relay Detection ─────────────────────────────────────

import { turnRelayChatPeers } from '$lib/stores/chatStore';

/**
 * Check the active ICE candidate pair to determine if the connection
 * is going through a TURN relay server. Updates the appropriate store.
 */
export async function detectRelay(
    peer: RTCPeerConnection,
    targetUserId: string,
    kind: 'call' | 'chat'
): Promise<void> {
    try {
        const stats = await peer.getStats();
        let isRelay = false;
        stats.forEach((report: any) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                // Check local candidate type
                const localCandidate = stats.get(report.localCandidateId);
                if (localCandidate?.candidateType === 'relay') {
                    isRelay = true;
                }
            }
        });

        const store = kind === 'call' ? turnRelayCallPeers : turnRelayChatPeers;
        store.update(s => {
            if (isRelay) s.add(targetUserId);
            else s.delete(targetUserId);
            return new Set(s);
        });

        if (isRelay) {
            console.log(`[TURN] ${kind} peer ${targetUserId} is using RELAY (TURN server)`);
        }
    } catch (e) {
        console.warn('[TURN] detectRelay failed:', e);
    }
}

// ─── Data Channel Setup ──────────────────────────────────

export function setupDataChannel(dc: RTCDataChannel, userId: string) {
    dataChannels.update(dcs => ({ ...dcs, [userId]: dc }));

    dc.onmessage = async (e) => {
        const rawData = e.data;
        if (typeof rawData === 'string') {
            try {
                let parsed;
                const outer = JSON.parse(rawData);
                if (outer.e2ee && outer.payload) {
                    try {
                        const decryptedStr = await decryptMessage(userId, outer.payload);
                        parsed = JSON.parse(decryptedStr);
                    } catch {
                        console.warn('[E2EE] DataChannel text decrypt failed');
                        return;
                    }
                } else {
                    parsed = outer;
                }

                if (parsed.type === 'chat') {
                    // P2P chat message received via data channel
                    const stamped = { ...parsed, timestamp: parsed.timestamp || Date.now(), type: 'text' as const };
                    messages.update(m => [...m, stamped]);
                } else if (parsed.type === 'file-offer') {
                    const cleanFileName = parsed.fileName.replace(/\s*\(\d+(\.\d+)?\s*[KMGTP]?B\).*$/, '').trim();
                    messages.update(msgs => [...msgs, {
                        sender: 'Peer',
                        content: `Shared file: ${cleanFileName} (${formatBytes(parsed.fileSize)})`,
                        fileName: cleanFileName,
                        type: 'file',
                        fileId: parsed.fileId,
                        fileData: null,
                        progress: 0,
                        mimeType: parsed.mimeType,
                        fileSize: parsed.fileSize,
                        senderId: userId
                    }]);
                } else if (parsed.type === 'file-request') {
                    startFileTransfer(parsed.fileId, userId, parsed.startByte || 0);
                }
            } catch (e) { /* ignore parse errors */ }
        } else {
            // Binary Chunk Logic — may be E2EE encrypted
            let chunkData = rawData;
            if (isE2EEReady(userId)) {
                try {
                    chunkData = await decryptChunk(userId, rawData);
                } catch {
                    chunkData = rawData;
                }
            }

            const currentPending = get(pendingTransfers);
            let transfer = currentPending[userId];
            if (!transfer) {
                const currentMsgs = get(messages);
                const msg = currentMsgs.find(m => m.senderId === userId && m.type === 'file' && m.progress === 0 && !m.fileData);
                if (msg) {
                    transfer = {
                        fileId: msg.fileId!,
                        totalBytes: msg.fileSize!,
                        receivedBytes: 0,
                        chunks: [] as any[],
                        mimeType: msg.mimeType || 'application/octet-stream'
                    };
                    pendingTransfers.update(pt => ({ ...pt, [userId]: transfer }));
                }
            }

            if (transfer) {
                transfer.chunks.push(chunkData);
                transfer.receivedBytes += chunkData.byteLength;

                messages.update(msgs => {
                    const msgIndex = msgs.findIndex(m => m.fileId === transfer.fileId);
                    if (msgIndex !== -1) {
                        const progress = Math.min(100, Math.round((transfer.receivedBytes / transfer.totalBytes) * 100));
                        msgs[msgIndex].progress = progress;
                        if (transfer.receivedBytes >= transfer.totalBytes) {
                            const blob = new Blob(transfer.chunks, { type: transfer.mimeType });
                            msgs[msgIndex].fileData = URL.createObjectURL(blob);
                            msgs[msgIndex].progress = 100;
                            pendingTransfers.update(pt => { delete pt[userId]; return { ...pt }; });
                        }
                    }
                    return [...msgs];
                });
            }
        }
    };
}

// ─── File Transfer ───────────────────────────────────────

export async function startFileTransfer(fileId: string, targetPeerId: string, startByte = 0) {
    const file = get(offeredFiles)[fileId];
    if (!file) return;
    const dc = get(dataChannels)[targetPeerId];
    if (!dc || dc.readyState !== 'open') return;
    const buffer = await file.arrayBuffer();
    const chunkSize = 16384;
    const useE2EE = isE2EEReady(targetPeerId);
    for (let i = startByte; i < buffer.byteLength; i += chunkSize) {
        const chunk = buffer.slice(i, i + chunkSize);
        if (dc.bufferedAmount > 16000000) await new Promise(r => setTimeout(r, 100));
        if (useE2EE) {
            try {
                const encrypted = await encryptChunk(targetPeerId, chunk);
                dc.send(encrypted);
            } catch (err) {
                console.error('[E2EE] Chunk encryption failed, aborting transfer:', err);
                return;
            }
        } else {
            dc.send(chunk);
        }
    }
}

export async function handleFileSelect(file: File) {
    if (!file) return;
    const fileId = Math.random().toString(36).substr(7);
    const user = get(userData);

    const metadata = {
        type: 'file-offer',
        fileId,
        fileName: file.name,
        fileSize: file.size,
        sender: user.id,
        mimeType: file.type || 'application/octet-stream'
    };

    offeredFiles.update(of => ({ ...of, [fileId]: file }));

    const dcs = get(dataChannels);
    for (const peerId of Object.keys(dcs)) {
        const dc = dcs[peerId];
        if (dc.readyState === 'open') {
            if (isE2EEReady(peerId)) {
                try {
                    const encrypted = await encryptMessage(peerId, JSON.stringify(metadata));
                    dc.send(JSON.stringify({ e2ee: true, payload: encrypted }));
                } catch (err) {
                    console.error('[E2EE] File offer encryption failed, not sending unencrypted:', err);
                }
            } else {
                dc.send(JSON.stringify(metadata));
            }
        }
    }

    const cleanFileName = file.name.replace(/\s*\(\d+(\.\d+)?\s*[KMGTP]?B\).*$/, '').trim();
    messages.update(msgs => [...msgs, {
        sender: 'You',
        content: `Shared file: ${cleanFileName}`,
        fileName: cleanFileName,
        type: 'file',
        fileId,
        progress: 100,
        fileData: URL.createObjectURL(file),
        mimeType: file.type
    }]);
}

export async function requestFile(msg: any) {
    if (!msg.senderId) return;
    const peerId = msg.senderId;
    const dc = get(dataChannels)[peerId];
    if (dc && dc.readyState === 'open') {
        pendingTransfers.update(pt => ({
            ...pt,
            [peerId]: {
                fileId: msg.fileId!,
                totalBytes: msg.fileSize,
                receivedBytes: 0,
                chunks: [],
                mimeType: msg.mimeType || 'application/octet-stream'
            }
        }));
        const requestData = { type: 'file-request', fileId: msg.fileId };
        if (isE2EEReady(peerId)) {
            try {
                const encrypted = await encryptMessage(peerId, JSON.stringify(requestData));
                dc.send(JSON.stringify({ e2ee: true, payload: encrypted }));
            } catch (err) {
                console.error('[E2EE] File request encryption failed:', err);
            }
        } else {
            dc.send(JSON.stringify(requestData));
        }
        msg.progress = 1;
        messages.update(m => [...m]);
    }
}

// ─── Utilities ───────────────────────────────────────────

export function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


