/**
 * End-to-End Encryption (E2EE) module using Web Crypto API
 * 
 * Uses ECDH (P-256) for key exchange and AES-256-GCM for encryption.
 * Each peer generates an ephemeral ECDH key pair per session.
 * Public keys are exchanged during signaling.
 * A shared secret is derived and used to encrypt/decrypt all messages and file chunks.
 */

export interface E2EEKeyPair {
    publicKey: CryptoKey;
    privateKey: CryptoKey;
}

export interface ExportedPublicKey {
    // JWK format for easy JSON serialization over signaling
    jwk: JsonWebKey;
}

// Per-peer encryption state
export interface PeerCryptoState {
    sharedKey: CryptoKey;  // AES-256-GCM derived key
    ready: boolean;
}

// Our session keypair (generated once per session)
let localKeyPair: E2EEKeyPair | null = null;

// Derived shared keys per peer
const peerKeys = new Map<string, PeerCryptoState>();

/**
 * Generate our ECDH key pair for this session
 */
export async function generateKeyPair(): Promise<ExportedPublicKey> {
    localKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,  // private key not extractable
        ['deriveKey']
    ) as CryptoKeyPair;

    // Export public key as JWK for sending over signaling
    const jwk = await crypto.subtle.exportKey('jwk', localKeyPair.publicKey);
    return { jwk };
}

/**
 * Derive a shared AES-256-GCM key from our private key + peer's public key
 */
export async function deriveSharedKey(peerId: string, peerPublicKeyJwk: JsonWebKey): Promise<void> {
    if (!localKeyPair) {
        throw new Error('Local key pair not generated. Call generateKeyPair() first.');
    }

    // Import peer's public key
    const peerPublicKey = await crypto.subtle.importKey(
        'jwk',
        peerPublicKeyJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
    );

    // Derive shared secret → AES-256-GCM key
    const sharedKey = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: peerPublicKey },
        localKeyPair.privateKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );

    peerKeys.set(peerId, { sharedKey, ready: true });
}

/**
 * Check if E2EE is established with a peer
 */
export function isE2EEReady(peerId: string): boolean {
    return peerKeys.get(peerId)?.ready ?? false;
}

/**
 * Get the raw shared AES-GCM key for a peer (used by media frame encryption)
 */
export function getPeerSharedKey(peerId: string): CryptoKey | null {
    return peerKeys.get(peerId)?.sharedKey ?? null;
}

/**
 * Encrypt a string message for a specific peer
 * Returns a base64-encoded string containing IV + ciphertext
 */
export async function encryptMessage(peerId: string, plaintext: string): Promise<string> {
    const state = peerKeys.get(peerId);
    if (!state?.ready) {
        throw new Error(`E2EE not established with peer ${peerId}`);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Generate a random 12-byte IV for each message (AES-GCM standard)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        state.sharedKey,
        data
    );

    // Pack IV + ciphertext into one ArrayBuffer
    const packed = new Uint8Array(iv.length + ciphertext.byteLength);
    packed.set(iv, 0);
    packed.set(new Uint8Array(ciphertext), iv.length);

    // Return as base64 for easy JSON transport
    return arrayBufferToBase64(packed.buffer);
}

/**
 * Decrypt a string message from a specific peer
 */
export async function decryptMessage(peerId: string, encryptedBase64: string): Promise<string> {
    const state = peerKeys.get(peerId);
    if (!state?.ready) {
        throw new Error(`E2EE not established with peer ${peerId}`);
    }

    const packed = base64ToArrayBuffer(encryptedBase64);
    const iv = packed.slice(0, 12);
    const ciphertext = packed.slice(12);

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        state.sharedKey,
        ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}

/**
 * Encrypt a binary chunk (for file transfers)
 * Returns ArrayBuffer containing IV (12 bytes) + ciphertext
 */
export async function encryptChunk(peerId: string, chunk: ArrayBuffer): Promise<ArrayBuffer> {
    const state = peerKeys.get(peerId);
    if (!state?.ready) {
        throw new Error(`E2EE not established with peer ${peerId}`);
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        state.sharedKey,
        chunk
    );

    // Pack: [IV (12 bytes)] [ciphertext]
    const packed = new Uint8Array(12 + ciphertext.byteLength);
    packed.set(iv, 0);
    packed.set(new Uint8Array(ciphertext), 12);

    return packed.buffer;
}

/**
 * Decrypt a binary chunk (for file transfers)
 */
export async function decryptChunk(peerId: string, encryptedChunk: ArrayBuffer): Promise<ArrayBuffer> {
    const state = peerKeys.get(peerId);
    if (!state?.ready) {
        throw new Error(`E2EE not established with peer ${peerId}`);
    }

    const data = new Uint8Array(encryptedChunk);
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);

    return await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        state.sharedKey,
        ciphertext
    );
}

/**
 * Clean up peer's crypto state (on disconnect)
 */
export function removePeerCrypto(peerId: string): void {
    peerKeys.delete(peerId);
}

/**
 * Reset all crypto state (on hang up / session end)
 */
export function resetCrypto(): void {
    peerKeys.clear();
    localKeyPair = null;
}

/**
 * Get the number of peers with established E2EE
 */
export function getE2EEPeerCount(): number {
    let count = 0;
    for (const state of peerKeys.values()) {
        if (state.ready) count++;
    }
    return count;
}

// --- Utility functions ---

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
