/**
 * Browser-based audio transcription using Whisper (via @huggingface/transformers).
 * Uses whisper-small for accurate multilingual support (99 languages).
 * The model (~170 MB) is downloaded once on first use and permanently cached
 * in the browser via persistent storage + Cache API.
 * Runs entirely client-side — no server needed.
 */

let transcriber: any = null;
let loadingPromise: Promise<any> | null = null;
let storageRequested = false;

export type ProgressCallback = (message: string) => void;

/**
 * Request persistent storage so the browser never auto-evicts the cached model.
 * This is a one-time request; browsers typically grant it for installed/bookmarked sites.
 */
async function ensurePersistentStorage() {
    if (storageRequested) return;
    storageRequested = true;
    try {
        if (navigator.storage && navigator.storage.persist) {
            const granted = await navigator.storage.persist();
            console.log(`[Transcriber] Persistent storage ${granted ? 'granted ✓' : 'denied (browser may evict under pressure)'}`);
        }
    } catch {
        // Non-critical — cache still works, just not guaranteed permanent
    }
}

async function getTranscriber(onProgress?: ProgressCallback) {
    // Already loaded — return immediately
    if (transcriber) return transcriber;

    // Another call is already loading — wait for it (with error handling)
    if (loadingPromise) {
        try {
            return await loadingPromise;
        } catch (err) {
            // Previous load failed — clear it so we can retry
            loadingPromise = null;
            transcriber = null;
            throw err;
        }
    }

    loadingPromise = (async () => {
        // Ensure browser won't evict our cached model files
        await ensurePersistentStorage();

        onProgress?.('Loading AI model…');
        console.log('[Transcriber] Starting model load…');

        // Dynamic import so the library is only fetched when transcription is used
        const transformers = await import('@huggingface/transformers');
        console.log('[Transcriber] Library imported');

        // Check if model is already cached (skip download message)
        let isFirstChunk = true;

        const instance = await transformers.pipeline(
            'automatic-speech-recognition',
            'onnx-community/whisper-small',
            {
                dtype: 'q8',
                device: 'wasm',
                // Uses Cache API by default — model files persist across sessions
                progress_callback: (p: any) => {
                    if (p.status === 'initiate') {
                        isFirstChunk = true;
                    } else if (p.status === 'download') {
                        onProgress?.('Downloading model (one-time)…');
                    } else if (p.status === 'progress' && p.progress != null) {
                        if (isFirstChunk && p.progress > 0) {
                            isFirstChunk = false;
                        }
                        onProgress?.(`Downloading model… ${Math.round(p.progress)}%`);
                    } else if (p.status === 'done') {
                        onProgress?.('Loading model into memory…');
                    } else if (p.status === 'ready') {
                        onProgress?.('Model ready');
                    }
                }
            }
        );

        console.log('[Transcriber] Model loaded successfully');
        transcriber = instance;
        return instance;
    })();

    try {
        return await loadingPromise;
    } catch (err) {
        console.error('[Transcriber] Model load failed:', err);
        loadingPromise = null;
        transcriber = null;
        throw err;
    }
}

/**
 * Transcribe audio from a URL (blob: or http:).
 * Returns the transcribed text in the detected/specified language.
 *
 * @param audioSrc  URL to audio (blob: or http:)
 * @param onProgress  Optional progress callback
 * @param language  Source language hint (e.g. 'turkish', 'english', 'french').
 *                  Defaults to 'turkish'. Pass any Whisper-supported language name
 *                  or ISO code (e.g. 'tr', 'en', 'fr').
 *                  See: https://github.com/openai/whisper/blob/main/whisper/tokenizer.py
 */
export async function transcribeAudio(
    audioSrc: string,
    onProgress?: ProgressCallback,
    language: string = 'turkish'
): Promise<string> {
    const whisper = await getTranscriber(onProgress);

    onProgress?.('Preparing audio…');
    console.log('[Transcriber] Fetching audio source…');

    // Fetch and decode audio to 16 kHz mono Float32Array (Whisper's expected format)
    const response = await fetch(audioSrc);
    const arrayBuffer = await response.arrayBuffer();
    console.log(`[Transcriber] Audio fetched: ${arrayBuffer.byteLength} bytes`);

    onProgress?.('Decoding audio…');
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const float32 = audioBuffer.getChannelData(0); // first channel = mono
    const durationSecs = float32.length / 16000;
    await audioCtx.close();
    console.log(`[Transcriber] Audio decoded: ${durationSecs.toFixed(1)}s, ${float32.length} samples`);

    // Show a ticking progress while inference runs (WASM can be slow)
    let elapsed = 0;
    const timer = setInterval(() => {
        elapsed++;
        onProgress?.(`Transcribing… ${elapsed}s`);
    }, 1000);

    onProgress?.('Transcribing…');
    console.log(`[Transcriber] Starting inference (lang=${language})…`);

    try {
        // Race between inference and a 3-minute timeout
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Transcription timed out after 3 minutes')), 180_000)
        );

        const result = await Promise.race([
            whisper(float32, {
                language,
                task: 'transcribe',
                return_timestamps: false,
                chunk_length_s: 30,
                stride_length_s: 5,
            }),
            timeoutPromise,
        ]);

        console.log('[Transcriber] Inference complete:', result?.text?.slice(0, 80));
        return (result?.text ?? '').trim();
    } finally {
        clearInterval(timer);
    }
}
