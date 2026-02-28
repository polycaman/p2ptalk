<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { t } from '$lib/i18n';
    const dispatch = createEventDispatcher();

    let isRecording = false;
    let mediaRecorder: MediaRecorder | null = null;
    let chunks: Blob[] = [];
    let recordingTime = 0;
    let timer: ReturnType<typeof setInterval>;
    let stream: MediaStream | null = null;

    async function startRecording() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const options: MediaRecorderOptions = {};
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                options.mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                options.mimeType = 'audio/webm';
            }
            mediaRecorder = new MediaRecorder(stream, options);
            chunks = [];
            recordingTime = 0;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
                if (stream) stream.getTracks().forEach(t => t.stop());
                stream = null;
                if (recordingTime > 0) {
                    dispatch('recorded', { blob, duration: recordingTime });
                }
                recordingTime = 0;
            };

            mediaRecorder.start(200);
            isRecording = true;
            timer = setInterval(() => recordingTime++, 1000);
        } catch (e) {
            console.error('Could not start recording:', e);
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        isRecording = false;
        clearInterval(timer);
    }

    function cancelRecording() {
        if (mediaRecorder) {
            mediaRecorder.ondataavailable = null;
            mediaRecorder.onstop = null;
            if (mediaRecorder.state === 'recording') mediaRecorder.stop();
        }
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = null;
        isRecording = false;
        clearInterval(timer);
        recordingTime = 0;
    }

    function formatTime(secs: number): string {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
</script>

{#if isRecording}
    <div class="recording-ui">
        <span class="rec-dot"></span>
        <span class="rec-time">{formatTime(recordingTime)}</span>
        <button class="cancel-btn" on:click={cancelRecording} title={$t('recorder.cancel')}>
            <i class="fas fa-trash"></i>
        </button>
        <button class="stop-btn" on:click={stopRecording} title={$t('recorder.stop')}>
            <i class="fas fa-paper-plane"></i>
        </button>
    </div>
{:else}
    <button class="mic-btn" on:click={startRecording} title={$t('recorder.start')}>
        <i class="fas fa-microphone"></i>
    </button>
{/if}

<style>
    .mic-btn {
        background: none; border: none; color: #b5bac1;
        cursor: pointer; font-size: 18px; padding: 8px;
        border-radius: 4px; transition: all 0.2s; flex-shrink: 0;
    }
    .mic-btn:hover { color: #fff; background: #35373c; }

    .recording-ui { display: flex; align-items: center; gap: 8px; }

    .rec-dot {
        width: 10px; height: 10px; border-radius: 50%;
        background: #ed4245; animation: pulse 1s infinite;
    }
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
    }

    .rec-time {
        font-size: 14px; color: #ed4245; font-weight: 600;
        font-variant-numeric: tabular-nums; min-width: 36px;
    }

    .cancel-btn, .stop-btn {
        background: none; border: none; cursor: pointer;
        font-size: 16px; padding: 6px; border-radius: 4px; transition: all 0.2s;
    }
    .cancel-btn { color: #ed4245; }
    .cancel-btn:hover { background: rgba(237, 66, 69, 0.15); }
    .stop-btn { color: #5865f2; }
    .stop-btn:hover { background: rgba(88, 101, 242, 0.15); }
</style>
