/**
 * Centralized reactive state for the call/app session.
 * All shared state lives here as Svelte writable stores.
 */
import { writable, derived, get } from 'svelte/store';
import type { Socket } from 'socket.io-client';

// ─── Socket ──────────────────────────────────────────────
export const socket = writable<Socket>(null as any);

// ─── User Data (set once from page load) ─────────────────
export const userData = writable<any>(null);

// ─── E2EE State ──────────────────────────────────────────
export const localPublicKeyJwk = writable<JsonWebKey | null>(null);
export const e2eePeerCount = writable(0);
export const e2eeActive = derived(e2eePeerCount, ($cnt) => $cnt > 0);

// ─── UI State ────────────────────────────────────────────
export const activeTab = writable<'rooms' | 'chats'>('chats');
export const showCreateRoomModal = writable(false);
export const showSettings = writable(false);
export const showInviteModal = writable(false);
export const showMobileMenu = writable(false);

// ─── Friends State ───────────────────────────────────────
export const friendsList = writable<any[]>([]);
export const friendRequests = writable<any[]>([]);
export const onlineFriends = writable<Record<string, boolean>>({});
export const addFriendUsername = writable('');
export const friendSearch = writable('');

// ─── Call State ──────────────────────────────────────────
export const inCall = writable(false);
export const roomId = writable('');
export const incomingCall = writable<any>(null);
export const activeGroups = writable<any[]>([]);
export const currentRoomAllowTurn = writable(false);

/** Map of userId → display name for peers currently in the call */
export const peerUsernames = writable<Record<string, string>>({});

// ─── Media State ─────────────────────────────────────────
export const localStream = writable<MediaStream | null>(null);
export const localScreenStream = writable<MediaStream | null>(null);
export const remoteStreams = writable<Record<string, {
    cam?: MediaStream | null;
    screen?: MediaStream | null;
    audio?: MediaStream | null;
    camMuted?: boolean;
    micMuted?: boolean;
}>>({}); 
export const initialRemoteState = writable<Record<string, {
    camMuted?: boolean;
    micMuted?: boolean;
    screenStreamId?: string;
}>>({}); 
export const activeSpeakerId = writable<string | null>(null);

// ─── Device Settings ─────────────────────────────────────
export const audioInputs = writable<MediaDeviceInfo[]>([]);
export const audioOutputs = writable<MediaDeviceInfo[]>([]);
export const videoInputs = writable<MediaDeviceInfo[]>([]);
export const selectedAudioInput = writable('');
export const selectedAudioOutput = writable('');
export const selectedVideoInput = writable('');
export const noiseCancellation = writable(true);
export const echoCancellation = writable(true);
export const autoGainControl = writable(true);

export const isAudioMuted = writable(false);
export const isVideoMuted = writable(true); // Default: audio only
export const isScreenSharing = writable(false);

// ─── WebRTC Connections ──────────────────────────────────
export const peers = writable<Record<string, RTCPeerConnection>>({});
export const dataChannels = writable<Record<string, RTCDataChannel>>({});

/** Set of userId whose call connection is relayed through a TURN server */
export const turnRelayCallPeers = writable<Set<string>>(new Set());

// ─── Chat & File Transfer ────────────────────────────────
export const messages = writable<any[]>([]);
export const messageInput = writable('');
export const pendingTransfers = writable<Record<string, any>>({});
export const offeredFiles = writable<Record<string, File>>({});

// ─── Audio Processing (future) ───────────────────────────
export const audioContext = writable<AudioContext | null>(null);
export const audioSource = writable<MediaStreamAudioSourceNode | null>(null);
