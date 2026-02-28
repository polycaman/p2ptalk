/**
 * Media Frame E2EE using Insertable Streams API
 * 
 * Encrypts/decrypts individual audio and video frames at the WebRTC encoded level.
 * Uses AES-256-GCM per-frame encryption with unique IVs.
 * 
 * Frame format: [unencrypted_header][encrypted_payload][IV (12 bytes)][marker (1 byte)]
 * - Header bytes are preserved so the codec can still parse frame boundaries
 * - VP8/VP9/H264 video: 10 header bytes preserved
 * - Opus audio: 1 header byte preserved
 */

// Magic marker byte to identify encrypted frames
const ENCRYPTED_MARKER = 0xEE;

// Unencrypted header bytes to preserve per codec type
const HEADER_BYTES: Record<string, number> = {
    video: 10,
    audio: 1
};

/**
 * Check if browser supports Insertable Streams for media E2EE
 */
export function supportsMediaE2EE(): boolean {
    return typeof RTCRtpSender !== 'undefined' &&
           'createEncodedStreams' in RTCRtpSender.prototype;
}

/**
 * Create an encryption transform for outgoing media frames
 * @param getKey Callback that returns the current AES-GCM key (or null if not yet ready)
 * @param kind 'audio' or 'video'
 */
export function createEncryptTransform(
    getKey: () => CryptoKey | null,
    kind: 'audio' | 'video'
): TransformStream {
    const headerLen = HEADER_BYTES[kind] ?? 1;

    return new TransformStream({
        async transform(frame: any, controller: TransformStreamDefaultController) {
            const key = getKey();

            // If no key yet or frame too small, pass through unencrypted
            if (!key || !frame.data || frame.data.byteLength <= headerLen) {
                controller.enqueue(frame);
                return;
            }

            try {
                const iv = crypto.getRandomValues(new Uint8Array(12));
                const frameData = new Uint8Array(frame.data);

                // Split: [header (unencrypted)] [payload (to encrypt)]
                const header = frameData.slice(0, headerLen);
                const payload = frameData.slice(headerLen);

                const ciphertext = await crypto.subtle.encrypt(
                    { name: 'AES-GCM', iv },
                    key,
                    payload
                );

                const encryptedBytes = new Uint8Array(ciphertext);

                // Reassemble: [header][encrypted_payload][IV (12)][marker (1)]
                const result = new Uint8Array(
                    header.length + encryptedBytes.length + 12 + 1
                );
                result.set(header, 0);
                result.set(encryptedBytes, header.length);
                result.set(iv, header.length + encryptedBytes.length);
                result[result.length - 1] = ENCRYPTED_MARKER;

                frame.data = result.buffer;
                controller.enqueue(frame);
            } catch {
                // Encryption failed - pass through unencrypted (DTLS-SRTP still protects it)
                controller.enqueue(frame);
            }
        }
    });
}

/**
 * Create a decryption transform for incoming media frames
 * @param getKey Callback that returns the current AES-GCM key (or null if not yet ready)
 * @param kind 'audio' or 'video'
 */
export function createDecryptTransform(
    getKey: () => CryptoKey | null,
    kind: 'audio' | 'video'
): TransformStream {
    const headerLen = HEADER_BYTES[kind] ?? 1;
    // Minimum size: header + at least 1 encrypted byte + 12 IV + 1 marker
    const minSize = headerLen + 1 + 12 + 1;

    return new TransformStream({
        async transform(frame: any, controller: TransformStreamDefaultController) {
            const key = getKey();
            const frameData = new Uint8Array(frame.data);

            // Check if this frame is encrypted: has marker byte and sufficient length
            if (!key || frameData.length < minSize || frameData[frameData.length - 1] !== ENCRYPTED_MARKER) {
                // Not encrypted or no key - pass through as-is
                controller.enqueue(frame);
                return;
            }

            try {
                const header = frameData.slice(0, headerLen);
                const iv = frameData.slice(frameData.length - 13, frameData.length - 1);
                const encrypted = frameData.slice(headerLen, frameData.length - 13);

                const decrypted = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv },
                    key,
                    encrypted
                );

                const decryptedBytes = new Uint8Array(decrypted);
                const result = new Uint8Array(header.length + decryptedBytes.length);
                result.set(header, 0);
                result.set(decryptedBytes, header.length);

                frame.data = result.buffer;
                controller.enqueue(frame);
            } catch {
                // Decryption failed - pass frame through (might not actually be encrypted)
                controller.enqueue(frame);
            }
        }
    });
}

/**
 * Set up encryption on an RTCRtpSender (call after addTrack)
 */
export function setupSenderEncryption(
    sender: RTCRtpSender,
    getKey: () => CryptoKey | null
): boolean {
    if (!('createEncodedStreams' in sender)) return false;

    try {
        const kind = sender.track?.kind === 'video' ? 'video' : 'audio';
        const { readable, writable } = (sender as any).createEncodedStreams();
        const transform = createEncryptTransform(getKey, kind as 'audio' | 'video');
        readable.pipeThrough(transform).pipeTo(writable);
        return true;
    } catch (e) {
        console.warn('[E2EE-Media] Failed to set up sender encryption:', e);
        return false;
    }
}

/**
 * Set up decryption on an RTCRtpReceiver (call in ontrack)
 */
export function setupReceiverDecryption(
    receiver: RTCRtpReceiver,
    track: MediaStreamTrack,
    getKey: () => CryptoKey | null
): boolean {
    if (!('createEncodedStreams' in receiver)) return false;

    try {
        const kind = track.kind === 'video' ? 'video' : 'audio';
        const { readable, writable } = (receiver as any).createEncodedStreams();
        const transform = createDecryptTransform(getKey, kind as 'audio' | 'video');
        readable.pipeThrough(transform).pipeTo(writable);
        return true;
    } catch (e) {
        console.warn('[E2EE-Media] Failed to set up receiver decryption:', e);
        return false;
    }
}
