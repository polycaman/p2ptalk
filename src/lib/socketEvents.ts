/**
 * Socket event handler registration.
 * Call initSocketEvents(socket) from onMount to set up all listeners.
 */
import { get } from 'svelte/store';
import { t } from '$lib/i18n';
import {
    deriveSharedKey, decryptMessage,
    removePeerCrypto, getE2EEPeerCount
} from '$lib/crypto';
import {
    socket as socketStore, userData,
    localPublicKeyJwk, e2eePeerCount,
    friendsList, friendRequests, onlineFriends,
    activeGroups, inCall, incomingCall, roomId,
    remoteStreams, initialRemoteState,
    isAudioMuted, isVideoMuted, isScreenSharing,
    localScreenStream, peers, dataChannels, messages,
    peerUsernames
} from '$lib/stores/callState';
import { createPeerConnection, ensureTurnReady } from '$lib/webrtc';
import { joinRoom, hangUp } from '$lib/callActions';
import { initiateChatConnection, handleChatSignal, cleanupChatPeer } from '$lib/chatWebrtc';
import {
    conversations
} from '$lib/stores/chatStore';
import type { Socket } from 'socket.io-client';

export function initSocketEvents(sock: Socket, pageData: any) {
    // ─── Connection ──────────────────────────────────────
    sock.on('connect', () => {
        const user = get(userData);
        sock.emit('register-user', user.id);
        const friendIds = get(friendsList).map((f: any) => f.id);
        if (friendIds.length > 0) sock.emit('check-friends-status', friendIds);
    });

    // ─── Friends Status ──────────────────────────────────
    sock.on('friends-online-status', (statusMap) => {
        onlineFriends.update(of => ({ ...of, ...statusMap }));
        // Establish chat P2P connections to online friends
        const user = get(userData);
        if (user) {
            Object.entries(statusMap).forEach(([friendId, isOnline]) => {
                if (isOnline && user.id < friendId) {
                    initiateChatConnection(friendId);
                }
            });
        }
    });

    sock.on('friend-status-change', ({ userId, status }) => {
        onlineFriends.update(of => ({ ...of, [userId]: status === 'online' }));
        // Manage chat P2P connections
        const user = get(userData);
        if (status === 'online' && user && user.id < userId) {
            initiateChatConnection(userId); // async — awaits TURN internally
        } else if (status === 'offline') {
            cleanupChatPeer(userId);
        }
    });

    sock.on('friend-removed', (friendId: string) => {
        friendsList.update(fl => fl.filter((f: any) => f.id !== friendId));
        onlineFriends.update(of => { delete of[friendId]; return { ...of }; });
    });

    // ─── Real-time Friend Requests ───────────────────────
    sock.on('friend-request-received', (req: any) => {
        friendRequests.update(fr => {
            if (fr.find((r: any) => r.id === req.id)) return fr;
            return [...fr, req];
        });
    });

    sock.on('friend-request-accepted', (friend: any) => {
        friendsList.update(fl => {
            if (fl.find((f: any) => f.id === friend.id)) return fl;
            return [...fl, friend];
        });
        friendRequests.update(fr => fr.filter((r: any) => r.userId !== friend.id));
        if (sock.connected) {
            sock.emit('check-friends-status', [friend.id]);
        }
    });

    // ─── Periodic Friend Status Check ────────────────────
    setInterval(() => {
        const friendIds = get(friendsList).map((f: any) => f.id);
        if (friendIds.length > 0 && sock.connected) {
            sock.emit('check-friends-status', friendIds);
        }
    }, 30000);

    // ─── Active Calls ────────────────────────────────────
    sock.on('active-calls', (calls: any[]) => {
        const current = get(activeGroups);
        const localOnlyInvited = current.filter((g: any) => g.isInvited && !calls.find((c: any) => c.id === g.id));
        activeGroups.set([...calls, ...localOnlyInvited]);
    });

    sock.on('room-closed', () => {
        alert(get(t)('alert.roomClosed'));
        hangUp();
    });

    // ─── Incoming Call ───────────────────────────────────
    sock.on('incoming-call', (callData: any) => {
        activeGroups.update(ag => {
            const exists = ag.find((g: any) => g.id === callData.callId);
            if (!exists) {
                return [...ag, {
                    id: callData.callId,
                    name: callData.name,
                    initiatorId: callData.initiatorId,
                    scope: 'private',
                    isInvited: true,
                    allowTurn: !!callData.allowTurn
                }];
            }
            return ag.map(g => g.id === callData.callId ? { ...g, isInvited: true, allowTurn: !!callData.allowTurn } : g);
        });
        if (!get(inCall)) incomingCall.set(callData);
    });

    sock.on('call-created', ({ callId }: { callId: string }) => {
        joinRoom(callId);
    });

    // ─── Media Toggle ────────────────────────────────────
    sock.on('user-toggled-media', (evt: any) => {
        initialRemoteState.update(irs => {
            if (!irs[evt.userId]) irs[evt.userId] = {};
            if (evt.kind === 'video') irs[evt.userId].camMuted = evt.muted;
            if (evt.kind === 'audio') irs[evt.userId].micMuted = evt.muted;
            return { ...irs };
        });

        remoteStreams.update(rs => {
            if (rs[evt.userId]) {
                if (evt.kind === 'video') rs[evt.userId].camMuted = evt.muted;
                if (evt.kind === 'audio') rs[evt.userId].micMuted = evt.muted;
                if (evt.kind === 'screen' && evt.muted) {
                    delete rs[evt.userId].screen;
                }
            }
            return { ...rs };
        });
    });

    // ─── Room Participants (existing members' names sent to joiner) ──
    sock.on('room-participants', (nameMap: Record<string, string>) => {
        peerUsernames.update(m => ({ ...m, ...nameMap }));
    });

    // ─── User Connected (new peer joins) ─────────────────
    sock.on('user-connected', async (data: string | { userId: string; username: string }) => {
        // Support both old (string) and new ({ userId, username }) format
        const userId = typeof data === 'string' ? data : data.userId;
        const username = typeof data === 'string' ? null : data.username;

        const user = get(userData);
        if (userId === user.id) return;

        // Store peer username
        if (username) {
            peerUsernames.update(m => ({ ...m, [userId]: username }));
        }

        const rid = get(roomId);

        // Announce own state
        sock.emit('toggle-media', rid, { userId: user.id, kind: 'video', muted: get(isVideoMuted) });
        sock.emit('toggle-media', rid, { userId: user.id, kind: 'audio', muted: get(isAudioMuted) });
        if (get(isScreenSharing) && get(localScreenStream)) {
            sock.emit('toggle-media', rid, { userId: user.id, kind: 'screen', muted: false });
            sock.emit('screen-share-started', { to: userId, from: user.id, streamId: get(localScreenStream)!.id });
        }

        // Send E2EE public key
        const pubKey = get(localPublicKeyJwk);
        if (pubKey) {
            sock.emit('e2ee-key-exchange', { to: userId, from: user.id, publicKey: pubKey });
        }

        // Check for existing connection
        const currentPeers = get(peers);
        if (currentPeers[userId]) return;

        // TURN credentials MUST be ready before creating the peer connection
        await ensureTurnReady();

        // Re-check after async gap
        if (get(peers)[userId]) return;

        const peer = createPeerConnection(userId);
        try {
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            sock.emit('signal', { to: userId, from: user.id, signal: peer.localDescription });
        } catch (e) {
            console.error(e);
        }
    });

    // ─── E2EE Key Exchange ───────────────────────────────
    sock.on('e2ee-key-exchange', async ({ from, publicKey }: { from: string; publicKey: JsonWebKey }) => {
        try {
            await deriveSharedKey(from, publicKey);
            e2eePeerCount.set(getE2EEPeerCount());
            console.log(`[E2EE] Shared key derived with peer ${from}. Total: ${get(e2eePeerCount)}`);
            const pubKey = get(localPublicKeyJwk);
            if (pubKey) {
                const user = get(userData);
                sock.emit('e2ee-key-exchange', { to: from, from: user.id, publicKey: pubKey });
            }
        } catch (e) {
            console.error('[E2EE] Key exchange failed with', from, e);
        }
    });

    // ─── User Disconnected ───────────────────────────────
    sock.on('user-disconnected', (userId: string) => {
        const currentPeers = get(peers);
        if (currentPeers[userId]) {
            currentPeers[userId].close();
            peers.update(p => { delete p[userId]; return { ...p }; });
            remoteStreams.update(rs => { delete rs[userId]; return { ...rs }; });
            dataChannels.update(dc => { delete dc[userId]; return { ...dc }; });
            initialRemoteState.update(irs => { delete irs[userId]; return { ...irs }; });
            peerUsernames.update(m => { delete m[userId]; return { ...m }; });
            removePeerCrypto(userId);
            e2eePeerCount.set(getE2EEPeerCount());
        }
    });

    // ─── Screen Share ID ─────────────────────────────────
    sock.on('screen-share-started', ({ from, streamId }: { from: string; streamId: string }) => {
        initialRemoteState.update(irs => {
            if (!irs[from]) irs[from] = {};
            irs[from].screenStreamId = streamId;
            return { ...irs };
        });

        remoteStreams.update(rs => {
            if (!rs[from]) rs[from] = {};
            const currentCam = rs[from]?.cam;
            console.log(`[SOCKET] screen-share-started from=${from} streamId=${streamId} cam=${currentCam?.id || 'null'}`);

            if (currentCam && currentCam.id === streamId) {
                console.log('-> Moving misplaced screen stream from cam to screen slot');
                rs[from].screen = currentCam;
                rs[from].cam = null;
            }
            return { ...rs };
        });
    });

    // ─── WebRTC Signaling ────────────────────────────────
    sock.on('signal', async ({ signal, from }: { signal: any; from: string }) => {
        const user = get(userData);
        if (from === user.id) return;

        // Ensure TURN credentials are loaded before creating any peer
        if (!get(peers)[from]) {
            await ensureTurnReady();
            // Re-check after async gap
            if (!get(peers)[from]) {
                createPeerConnection(from);
            }
        }
        const peer = get(peers)[from];
        if (!peer) return;

        try {
            if (signal.type === 'offer') {
                await peer.setRemoteDescription(new RTCSessionDescription(signal));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                sock.emit('signal', { to: from, from: user.id, signal: peer.localDescription });
            } else if (signal.type === 'answer') {
                await peer.setRemoteDescription(new RTCSessionDescription(signal));
            } else if (signal.candidate) {
                await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
        } catch (e) {
            console.error('Signal error', e);
        }
    });

    // ─── Chat Messages ───────────────────────────────────
    sock.on('receive-message', async (msg: any) => {
        const stamped = { ...msg, timestamp: msg.timestamp || Date.now() };
        if (stamped.encrypted && stamped.senderId) {
            try {
                const decrypted = await decryptMessage(stamped.senderId, stamped.content);
                messages.update(m => [...m, { ...stamped, content: decrypted, encrypted: false }]);
            } catch {
                messages.update(m => [...m, { ...stamped, content: '🔒 [Encrypted message - decryption failed]' }]);
            }
        } else {
            messages.update(m => [...m, stamped]);
        }
    });

    // ─── Chat P2P Signaling ──────────────────────────────
    sock.on('chat-signal', ({ signal, from }: { signal: any; from: string }) => {
        handleChatSignal(signal, from);
    });

    sock.on('conversation-created', (conversation: any) => {
        conversations.update(c => {
            if (c.find(x => x.id === conversation.id)) return c;
            return [...c, conversation];
        });
    });

    sock.on('group-updated', ({ conversationId, name, description }: any) => {
        conversations.update(c => c.map(conv =>
            conv.id === conversationId
                ? { ...conv, name: name || conv.name, description: description ?? conv.description }
                : conv
        ));
    });

    sock.on('member-left', ({ conversationId, userId }: any) => {
        conversations.update(c => c.map(conv =>
            conv.id === conversationId
                ? { ...conv, members: conv.members.filter((m: any) => m.userId !== userId) }
                : conv
        ));
    });

    sock.on('member-added', ({ conversationId, members }: any) => {
        conversations.update(c => c.map(conv =>
            conv.id === conversationId
                ? { ...conv, members }
                : conv
        ));
    });
}
