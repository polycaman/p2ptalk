/**
 * Call lifecycle actions: join, leave, media toggles, screen share, settings.
 */
import { get } from 'svelte/store';
import { t } from '$lib/i18n';
import {
    generateKeyPair, isE2EEReady,
    encryptMessage, resetCrypto, getE2EEPeerCount
} from '$lib/crypto';
import {
    socket, userData,
    localPublicKeyJwk, e2eePeerCount,
    inCall, roomId, incomingCall,
    localStream, localScreenStream,
    remoteStreams, peers, dataChannels,
    isAudioMuted, isVideoMuted, isScreenSharing,
    audioInputs, audioOutputs, videoInputs,
    selectedAudioInput, selectedAudioOutput, selectedVideoInput,
    noiseCancellation, echoCancellation, autoGainControl,
    messages, messageInput,
    audioSource, showSettings, showCreateRoomModal,
    activeGroups
} from '$lib/stores/callState';
import { createPeerConnection, getTurnServers } from '$lib/webrtc';

// ─── Join Room ───────────────────────────────────────────

export async function joinRoom(id: string) {
    const sock = get(socket);
    const user = get(userData);
    try {
        // Fetch TURN credentials AND load devices in parallel
        // TURN MUST be resolved before sock.emit('join-room') triggers peer creation
        await Promise.all([
            getTurnServers().catch(() => console.warn('[TURN] Pre-fetch failed, will use STUN only')),
            loadDevices()
        ]);

        // Generate E2EE key pair for this session
        try {
            const keyExport = await generateKeyPair();
            localPublicKeyJwk.set(keyExport.jwk);
            console.log('[E2EE] Key pair generated for session');
        } catch (e) {
            console.warn('[E2EE] Key generation failed, continuing without E2EE', e);
        }

        const requestVideo = !get(isVideoMuted);

        const initialConstraints: MediaStreamConstraints = {
            audio: {
                deviceId: get(selectedAudioInput) ? { exact: get(selectedAudioInput) } : undefined,
                echoCancellation: get(echoCancellation),
                noiseSuppression: !get(noiseCancellation),
                autoGainControl: get(autoGainControl)
            },
            video: requestVideo
                ? (get(selectedVideoInput) ? { deviceId: { exact: get(selectedVideoInput) } } : true)
                : false
        };

        let stream: MediaStream | null = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia(initialConstraints);
        } catch {
            console.warn('Camera/Mic access failed initially. Trying fallback.');
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                isVideoMuted.set(true);
            } catch (e) {
                console.warn('Media access fully denied. Joining as observer.', e);
            }
        }

        if (stream) {
            if (get(isVideoMuted)) {
                stream.getVideoTracks().forEach(t => { t.enabled = false; t.stop(); });
            }
        }

        localStream.set(stream);
        roomId.set(id);
        sock.emit('join-room', id, user.id);
        sock.emit('toggle-media', id, { userId: user.id, kind: 'video', muted: get(isVideoMuted) });
        sock.emit('toggle-media', id, { userId: user.id, kind: 'audio', muted: get(isAudioMuted) });

        inCall.set(true);
        incomingCall.set(null);

        // Update browser URL so the room link is shareable
        try { window.history.replaceState({}, '', `/room/${id}`); } catch (_) {}
    } catch (e: any) {
        if (get(roomId) !== id) alert(get(t)('alert.joinFailed') + e.message);
    }
}

// ─── Hang Up ─────────────────────────────────────────────

export function hangUp() {
    resetCrypto();
    e2eePeerCount.set(0);
    localPublicKeyJwk.set(null);
    const sock = get(socket);
    if (sock) sock.disconnect();
    // Reset URL to dashboard before reload so we don't re-enter /room/[id] route
    try { window.history.replaceState({}, '', '/'); } catch (_) {}
    window.location.reload();
}

// ─── Answer / Reject Incoming Call ───────────────────────

export function answerCall() {
    const ic = get(incomingCall);
    if (ic) {
        joinRoom(ic.callId);
    }
}

export function rejectCall() {
    incomingCall.set(null);
}

// ─── Send Chat Message ───────────────────────────────────

export async function sendMessage() {
    const input = get(messageInput);
    if (!input) return;
    const user = get(userData);
    const sock = get(socket);
    const currentPeers = get(peers);
    const currentDCs = get(dataChannels);
    const rid = get(roomId);

    const msg = { sender: user.username, content: input, type: 'text' as const, senderId: user.id, timestamp: Date.now() };
    messages.update(m => [...m, msg]);

    const peerIds = Object.keys(currentPeers);
    for (const peerId of peerIds) {
        const dc = currentDCs[peerId];
        const dcOpen = dc && dc.readyState === 'open';

        if (isE2EEReady(peerId)) {
            try {
                const encrypted = await encryptMessage(peerId, JSON.stringify({ ...msg, type: 'chat' }));
                const payload = JSON.stringify({ e2ee: true, payload: encrypted });
                // Prefer data channel (P2P) over server relay
                if (dcOpen) {
                    dc.send(payload);
                } else {
                    sock.emit('send-message', rid, { ...msg, content: await encryptMessage(peerId, input), encrypted: true, targetPeer: peerId });
                }
            } catch (err) {
                console.error('[E2EE] Message encryption failed:', err);
            }
        } else {
            // No E2EE — try data channel unencrypted first, fallback to server
            if (dcOpen) {
                dc.send(JSON.stringify({ ...msg, type: 'chat' }));
            } else {
                sock.emit('send-message', rid, msg);
            }
        }
    }
    if (peerIds.length === 0) {
        sock.emit('send-message', rid, msg);
    }
    messageInput.set('');
}

// ─── Audio Toggle ────────────────────────────────────────

export function toggleAudio() {
    const ls = get(localStream);
    if (ls) {
        const track = ls.getAudioTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            isAudioMuted.set(!track.enabled);
            const sock = get(socket);
            const user = get(userData);
            sock.emit('toggle-media', get(roomId), { userId: user.id, kind: 'audio', muted: !track.enabled });
        }
    }
}

// ─── Video Toggle ────────────────────────────────────────

export function toggleVideo() {
    const ls = get(localStream);
    const sock = get(socket);
    const user = get(userData);
    const rid = get(roomId);

    if (ls) {
        const track = ls.getVideoTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            isVideoMuted.set(!track.enabled);
            sock.emit('toggle-media', rid, { userId: user.id, kind: 'video', muted: !track.enabled });
            localStream.set(ls); // trigger reactivity
        } else {
            // Try to add video if it was missing (joined audio-only)
            const vidInput = get(selectedVideoInput);
            navigator.mediaDevices.getUserMedia({
                video: vidInput ? { deviceId: { exact: vidInput } } : true,
                audio: false
            }).then(vidStream => {
                const vidTrack = vidStream.getVideoTracks()[0];
                if (vidTrack) {
                    ls.addTrack(vidTrack);
                    isVideoMuted.set(false);
                    sock.emit('toggle-media', rid, { userId: user.id, kind: 'video', muted: false });

                    const currentPeers = get(peers);
                    Object.values(currentPeers).forEach(p => {
                        p.addTrack(vidTrack, ls);
                        p.createOffer().then(o => p.setLocalDescription(o)).then(() => {
                            const pid = Object.keys(currentPeers).find(k => currentPeers[k] === p);
                            if (pid) sock.emit('signal', { to: pid, from: user.id, signal: p.localDescription });
                        });
                    });
                    localStream.set(ls);
                }
            }).catch(e => {
                console.error('Could not add video track', e);
                alert(get(t)('alert.cameraFailed') + e.message);
            });
        }
    } else {
        // No local stream at all — create one
        const vidInput = get(selectedVideoInput);
        navigator.mediaDevices.getUserMedia({
            video: vidInput ? { deviceId: { exact: vidInput } } : true,
            audio: true
        }).then(newStream => {
            localStream.set(newStream);
            isVideoMuted.set(false);
            isAudioMuted.set(false);

            sock.emit('toggle-media', rid, { userId: user.id, kind: 'video', muted: false });
            sock.emit('toggle-media', rid, { userId: user.id, kind: 'audio', muted: false });

            const currentPeers = get(peers);
            Object.values(currentPeers).forEach(p => {
                newStream.getTracks().forEach(track => p.addTrack(track, newStream));
                p.createOffer().then(o => p.setLocalDescription(o)).then(() => {
                    const pid = Object.keys(currentPeers).find(k => currentPeers[k] === p);
                    if (pid) sock.emit('signal', { to: pid, from: user.id, signal: p.localDescription });
                });
            });
        }).catch(e => {
            console.error('Could not start media', e);
            alert(get(t)('alert.mediaFailed') + e.message);
        });
    }
}

// ─── Screen Sharing ──────────────────────────────────────

export async function shareScreen() {
    if (get(isScreenSharing)) return;
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        localScreenStream.set(stream);
        isScreenSharing.set(true);

        const track = stream.getVideoTracks()[0];
        const sock = get(socket);
        const user = get(userData);
        const rid = get(roomId);

        sock.emit('toggle-media', rid, { userId: user.id, kind: 'screen', muted: false });

        const currentPeers = get(peers);
        for (const [userId, peer] of Object.entries(currentPeers)) {
            peer.addTrack(track, stream);
            sock.emit('screen-share-started', { to: userId, from: user.id, streamId: stream.id });

            try {
                const offer = await peer.createOffer();
                await peer.setLocalDescription(offer);
                sock.emit('signal', { to: userId, from: user.id, signal: peer.localDescription });
            } catch (err) {
                console.error('Renegotiation failed', err);
            }
        }

        track.onended = () => stopScreenShare();
    } catch (e) {
        console.error('Error starting screen share', e);
    }
}

export function stopScreenShare() {
    const lss = get(localScreenStream);
    if (!get(isScreenSharing) || !lss) return;

    const track = lss.getVideoTracks()[0];
    track.stop();

    const sock = get(socket);
    const user = get(userData);
    const rid = get(roomId);
    const currentPeers = get(peers);

    for (const [userId, peer] of Object.entries(currentPeers)) {
        const senders = peer.getSenders();
        const sender = senders.find(s => s.track === track);
        if (sender) {
            peer.removeTrack(sender);
            peer.createOffer().then(offer => peer.setLocalDescription(offer)).then(() => {
                sock.emit('signal', { to: userId, from: user.id, signal: peer.localDescription });
            }).catch(e => console.error('Stop screen share negotiation error', e));
        }
    }

    localScreenStream.set(null);
    isScreenSharing.set(false);
    sock.emit('toggle-media', rid, { userId: user.id, kind: 'screen', muted: true });
}

// ─── Load Devices ────────────────────────────────────────

export async function loadDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        audioInputs.set(devices.filter(d => d.kind === 'audioinput'));
        audioOutputs.set(devices.filter(d => d.kind === 'audiooutput'));
        videoInputs.set(devices.filter(d => d.kind === 'videoinput'));

        const ls = get(localStream);
        if (ls) {
            const audioTrack = ls.getAudioTracks()[0];
            if (audioTrack) {
                const setting = audioTrack.getSettings();
                if (setting.deviceId) selectedAudioInput.set(setting.deviceId);
            }
            const videoTrack = ls.getVideoTracks()[0];
            if (videoTrack) {
                const setting = videoTrack.getSettings();
                if (setting.deviceId) selectedVideoInput.set(setting.deviceId);
            }
        }

        if (!get(selectedAudioInput) && get(audioInputs).length > 0) {
            const def = get(audioInputs).find(d => d.deviceId === 'default');
            if (def) selectedAudioInput.set(def.deviceId);
        }
        if (!get(selectedVideoInput) && get(videoInputs).length > 0) {
            const def = get(videoInputs).find(d => d.deviceId === 'default');
            if (def) selectedVideoInput.set(def.deviceId);
        }
        if (!get(selectedAudioOutput) && get(audioOutputs).length > 0) {
            const def = get(audioOutputs).find(d => d.deviceId === 'default');
            if (def) selectedAudioOutput.set(def.deviceId);
        }
    } catch (e) {
        console.error('Error loading devices:', e);
    }
}

// ─── Apply Settings ──────────────────────────────────────

export async function applySettings() {
    if (get(inCall) && get(localStream)) {
        const src = get(audioSource);
        if (src) { src.disconnect(); audioSource.set(null); }
        const ls = get(localStream);
        if (ls) ls.getTracks().forEach(t => t.stop());

        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: get(selectedAudioInput) ? { exact: get(selectedAudioInput) } : undefined,
                    echoCancellation: get(echoCancellation),
                    noiseSuppression: !get(noiseCancellation),
                    autoGainControl: get(autoGainControl)
                },
                video: { deviceId: get(selectedVideoInput) ? { exact: get(selectedVideoInput) } : undefined }
            });

            localStream.set(newStream);

            const currentPeers = get(peers);
            Object.values(currentPeers).forEach(peer => {
                const senders = peer.getSenders();
                senders.forEach(sender => {
                    if (sender.track?.kind === 'audio') {
                        const newTrack = newStream.getAudioTracks()[0];
                        if (newTrack) sender.replaceTrack(newTrack);
                    }
                    if (sender.track?.kind === 'video') {
                        const newTrack = newStream.getVideoTracks()[0];
                        if (newTrack) sender.replaceTrack(newTrack);
                    }
                });
            });
        } catch (e) {
            console.error('Error applying settings', e);
        }
    }
    showSettings.set(false);
}

// ─── Room Helpers ────────────────────────────────────────

export function deleteRoom(roomIdToDelete: string) {
    if (!confirm(get(t)('alert.deleteConfirm'))) return;
    const sock = get(socket);
    const user = get(userData);
    sock.emit('delete-room', roomIdToDelete, user.id);
}

export function removeFriend(friendId: string, friendName: string) {
    if (!confirm(get(t)('alert.removeFriend', { name: friendName }))) return;
    const sock = get(socket);
    const user = get(userData);
    sock.emit('remove-friend', { userId: user.id, friendId });
}

export function startCall(targetId?: string, isGroup = false) {
    let name = '';
    if (isGroup) name = prompt(get(t)('alert.groupName')) || get(t)('alert.newGroup');
    const sock = get(socket);
    const user = get(userData);
    sock.emit('create-call', {
        initiatorId: user.id,
        targetIds: targetId ? [targetId] : [],
        isGroup,
        name
    });
}

export function handleCreateRoom(name: string, scope: string, allowTurn: boolean = false) {
    const sock = get(socket);
    const user = get(userData);
    sock.emit('create-call', {
        initiatorId: user.id,
        isGroup: true,
        name,
        scope,
        allowTurn
    });
    showCreateRoomModal.set(false);
}

export function handleInvite(friendId: string) {
    const rid = get(roomId);
    if (!rid) return;
    const sock = get(socket);
    const user = get(userData);
    sock.emit('invite-to-room', {
        roomId: rid,
        targetUserId: friendId,
        senderId: user.id
    });
}

export function isVisible(group: any, friends: any[]): boolean {
    const user = get(userData);
    if (group.isInvited) return true;
    if (!group.scope || group.scope === 'public') return true;
    if (group.initiatorId === user.id) return true;
    if (group.scope === 'friends') {
        if (friends && Array.isArray(friends)) {
            return friends.some((f: any) => f.id === group.initiatorId);
        }
    }
    return false;
}


