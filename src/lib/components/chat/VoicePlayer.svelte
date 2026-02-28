<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { transcribeAudio } from '$lib/transcriber';
    import { t } from '$lib/i18n';
    import { transcribeLangIndex } from '$lib/stores/chatStore';

    export let src: string;
    export let duration: number = 0;
    export let isOwn: boolean = false;

    let audio: HTMLAudioElement;
    let isPlaying = false;
    let currentTime = 0;
    let audioDuration = 0;
    let progress = 0;
    let playbackRate = 1;
    let seekBar: HTMLDivElement;

    // Waveform bars (fake visual – generated from a seed)
    const BAR_COUNT = 28;
    let bars: number[] = [];

    // Transcription
    let transcript = '';
    let transcriptStatus = '';
    let isTranscribing = false;
    let showTranscript = false;

    const SPEEDS = [1, 1.5, 2, 4];

    // Language selector
    const LANGUAGES: { code: string; label: string }[] = [
        { code: 'turkish',    label: 'TR' },
        { code: 'english',    label: 'EN' },
        { code: 'german',     label: 'DE' },
        { code: 'spanish',    label: 'ES' },
        { code: 'french',     label: 'FR' },
        { code: 'russian',    label: 'RU' },
        { code: 'ukrainian',  label: 'UK' },
        { code: 'persian',    label: 'FA' },
        { code: 'japanese',   label: 'JA' },
        { code: 'korean',     label: 'KO' },
    ];
    let prevLangIndex = -1;

    function cycleLang(e: MouseEvent) {
        e.stopPropagation();
        $transcribeLangIndex = ($transcribeLangIndex + 1) % LANGUAGES.length;
    }

    // Track language changes — keep old transcripts, just use new lang for next transcription
    $: {
        const idx = $transcribeLangIndex;
        prevLangIndex = idx;
    }

    onMount(() => {
        // Generate pseudo-random waveform bars from src hash
        let seed = 0;
        for (let i = 0; i < src.length; i++) seed = ((seed << 5) - seed + src.charCodeAt(i)) | 0;
        bars = Array.from({ length: BAR_COUNT }, (_, i) => {
            const x = Math.sin(seed * (i + 1) * 0.3) * 0.5 + 0.5;
            return 0.15 + x * 0.85;
        });

        audio = new Audio(src);
        audio.preload = 'metadata';

        audio.addEventListener('loadedmetadata', () => {
            audioDuration = audio.duration && isFinite(audio.duration) ? audio.duration : duration;
        });
        audio.addEventListener('timeupdate', () => {
            currentTime = audio.currentTime;
            audioDuration = audio.duration && isFinite(audio.duration) ? audio.duration : duration;
            progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;
        });
        audio.addEventListener('play', () => { isPlaying = true; });
        audio.addEventListener('pause', () => { isPlaying = false; });
        audio.addEventListener('ended', () => {
            isPlaying = false;
            currentTime = 0;
            progress = 0;
        });
    });

    onDestroy(() => {
        if (audio) {
            audio.pause();
            audio.src = '';
        }
    });

    function togglePlay() {
        if (!audio) return;
        if (audio.paused) {
            audio.playbackRate = playbackRate;
            audio.play().catch(() => {});
            isPlaying = true;
        } else {
            audio.pause();
            isPlaying = false;
        }
    }

    function cycleSpeed(e: MouseEvent) {
        e.stopPropagation();
        const idx = SPEEDS.indexOf(playbackRate);
        playbackRate = SPEEDS[(idx + 1) % SPEEDS.length];
        if (audio) {
            audio.playbackRate = playbackRate;
        }
    }

    function seek(e: MouseEvent) {
        if (!audio || !seekBar || !audioDuration) return;
        const rect = seekBar.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audio.currentTime = x * audioDuration;
    }

    function formatTime(secs: number): string {
        if (!secs || !isFinite(secs)) secs = 0;
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    async function transcribe() {
        // Toggle visibility if already transcribed
        if (transcript) {
            showTranscript = !showTranscript;
            return;
        }

        if (!src) {
            transcript = $t('player.noAudio');
            showTranscript = true;
            return;
        }

        isTranscribing = true;
        showTranscript = true;
        transcriptStatus = $t('player.initializing');

        try {
            const lang = LANGUAGES[$transcribeLangIndex]?.code || 'turkish';
            const text = await transcribeAudio(src, (msg) => {
                transcriptStatus = msg;
            }, lang);
            transcript = text || $t('player.noSpeech');
        } catch (err: any) {
            console.error('Transcription error:', err);
            transcript = $t('player.error');
        } finally {
            isTranscribing = false;
            transcriptStatus = '';
        }
    }
</script>

<div class="voice-player" class:own={isOwn}>
    <!-- Play / Pause -->
    <button class="play-btn" on:click={togglePlay} title={isPlaying ? $t('player.pause') : $t('player.play')}>
        {#if isPlaying}
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1"/>
                <rect x="14" y="5" width="4" height="14" rx="1"/>
            </svg>
        {:else}
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M8 5.14v14.72a1 1 0 001.5.86l11-7.36a1 1 0 000-1.72l-11-7.36A1 1 0 008 5.14z"/>
            </svg>
        {/if}
    </button>

    <!-- Waveform + Seek -->
    <div class="waveform-area">
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="waveform" bind:this={seekBar} on:click={seek}>
            {#each bars as h, i}
                {@const barProgress = (i / BAR_COUNT) * 100}
                <div
                    class="bar"
                    class:played={barProgress < progress}
                    style="height: {h * 100}%"
                ></div>
            {/each}
        </div>
        <div class="time-row">
            <span class="time">{isPlaying ? formatTime(currentTime) : formatTime(audioDuration || duration)}</span>
            <div class="controls-right">
                <button class="speed-btn" on:click|stopPropagation={cycleSpeed} title={$t('player.speed')}>
                    {playbackRate}x
                </button>
                <button class="lang-btn" on:click|stopPropagation={cycleLang} title={$t('player.transcribeLang', { lang: LANGUAGES[$transcribeLangIndex].code })}>
                    {LANGUAGES[$transcribeLangIndex].label}
                </button>
                <button
                    class="transcript-btn"
                    class:active={showTranscript}
                    class:spinning={isTranscribing}
                    on:click|stopPropagation={transcribe}
                    title={transcript ? (showTranscript ? $t('player.hideTranscript') : $t('player.showTranscript')) : $t('player.transcribe')}
                >
                    {#if isTranscribing}
                        <i class="fas fa-spinner"></i>
                    {:else}
                        <i class="fas fa-closed-captioning"></i>
                    {/if}
                </button>
            </div>
        </div>
    </div>
</div>

{#if showTranscript && (transcript || isTranscribing)}
    <div class="transcript-box" class:own={isOwn}>
        <i class="fas fa-quote-left quote-icon"></i>
        {#if isTranscribing}
            <p class="transcribing-status"><i class="fas fa-spinner fa-spin"></i> {transcriptStatus || $t('player.transcribing')}</p>
        {:else}
            <p>{transcript}</p>
        {/if}
    </div>
{/if}

<style>
    .voice-player {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 240px;
        max-width: 320px;
        padding: 4px 0;
    }

    /* Play button */
    .play-btn {
        width: 40px; height: 40px;
        border-radius: 50%;
        border: none;
        background: rgba(255,255,255,0.12);
        color: #fff;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        transition: background 0.2s;
    }
    .voice-player:not(.own) .play-btn {
        background: rgba(88, 101, 242, 0.2);
        color: #5865f2;
    }
    .play-btn:hover { background: rgba(255,255,255,0.2); }
    .voice-player:not(.own) .play-btn:hover { background: rgba(88, 101, 242, 0.35); }

    /* Waveform area */
    .waveform-area { flex: 1; min-width: 0; }

    .waveform {
        display: flex;
        align-items: flex-end;
        gap: 2px;
        height: 32px;
        cursor: pointer;
        padding: 2px 0;
    }

    .bar {
        flex: 1;
        min-width: 2px;
        border-radius: 2px;
        background: rgba(255,255,255,0.25);
        transition: background 0.15s;
    }
    .bar.played { background: rgba(255,255,255,0.8); }
    .voice-player:not(.own) .bar { background: rgba(88, 101, 242, 0.25); }
    .voice-player:not(.own) .bar.played { background: #5865f2; }

    /* Time row */
    .time-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 2px;
    }

    .time {
        font-size: 11px;
        color: rgba(255,255,255,0.5);
        font-variant-numeric: tabular-nums;
    }
    .voice-player:not(.own) .time { color: #949ba4; }

    .controls-right { display: flex; align-items: center; gap: 4px; }

    /* Speed button */
    .speed-btn {
        background: rgba(255,255,255,0.1);
        border: none;
        color: rgba(255,255,255,0.7);
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        font-variant-numeric: tabular-nums;
    }
    .speed-btn:hover { background: rgba(255,255,255,0.2); color: #fff; }
    .voice-player:not(.own) .speed-btn { background: rgba(88, 101, 242, 0.15); color: #7289da; }
    .voice-player:not(.own) .speed-btn:hover { background: rgba(88, 101, 242, 0.3); color: #5865f2; }

    /* Language button */
    .lang-btn {
        background: rgba(255,255,255,0.1);
        border: none;
        color: rgba(255,255,255,0.7);
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        letter-spacing: 0.5px;
    }
    .lang-btn:hover { background: rgba(255,255,255,0.2); color: #fff; }
    .voice-player:not(.own) .lang-btn { background: rgba(88, 101, 242, 0.15); color: #7289da; }
    .voice-player:not(.own) .lang-btn:hover { background: rgba(88, 101, 242, 0.3); color: #5865f2; }

    /* Transcript button */
    .transcript-btn {
        background: rgba(255,255,255,0.08);
        border: none;
        color: rgba(255,255,255,0.5);
        font-size: 15px;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 8px;
        width: 28px;
        height: 28px;
        transition: all 0.2s;
        display: flex; align-items: center; justify-content: center;
    }
    .transcript-btn:hover { color: rgba(255,255,255,0.8); }
    .transcript-btn.active { color: #fff; }
    .voice-player:not(.own) .transcript-btn { color: #949ba4; }
    .voice-player:not(.own) .transcript-btn:hover { color: #5865f2; }
    .voice-player:not(.own) .transcript-btn.active { color: #5865f2; }

    .transcript-btn.spinning i {
        animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Transcript box */
    .transcript-box {
        margin-top: 6px;
        padding: 8px 10px;
        background: rgba(0,0,0,0.15);
        border-radius: 8px;
        border-left: 3px solid rgba(255,255,255,0.2);
        position: relative;
    }
    .transcript-box.own { border-left-color: rgba(255,255,255,0.35); }
    .transcript-box:not(.own) { border-left-color: #5865f2; }

    .quote-icon {
        font-size: 10px;
        color: rgba(255,255,255,0.2);
        position: absolute;
        top: 6px;
        left: 8px;
    }
    .transcript-box:not(.own) .quote-icon { color: rgba(88, 101, 242, 0.3); }

    .transcript-box p {
        margin: 0;
        font-size: 12.5px;
        color: rgba(255,255,255,0.85);
        line-height: 1.45;
        padding-left: 14px;
    }
    .transcript-box:not(.own) p { color: #dcddde; }

    .transcribing-status {
        color: rgba(255,255,255,0.5) !important;
        font-style: italic;
    }
    .transcribing-status i { margin-right: 6px; }
    .transcript-box:not(.own) .transcribing-status { color: #949ba4 !important; }
</style>
