<script lang="ts">
    import { createEventDispatcher, onDestroy } from 'svelte';
    import { t } from '$lib/i18n';

    export let audioInputs: MediaDeviceInfo[];
    export let audioOutputs: MediaDeviceInfo[];
    export let videoInputs: MediaDeviceInfo[];

    export let selectedAudioInput: string;
    export let selectedAudioOutput: string;
    export let selectedVideoInput: string;

    export let isVideoMuted: boolean;
    export let noiseCancellation: boolean;
    export let echoCancellation: boolean;
    export let autoGainControl: boolean;

    const dispatch = createEventDispatcher();

    let testLevel = 0;
    let testStream: MediaStream | null = null;
    let testAudioContext: AudioContext | null = null;
    let isTesting = false;

    async function startMicrophoneTest() {
        if (testStream) return;
        try {
            testStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedAudioInput ? { exact: selectedAudioInput } : undefined
                }
            });

            testAudioContext = new AudioContext();
            const analyser = testAudioContext.createAnalyser();
            const microphone = testAudioContext.createMediaStreamSource(testStream);
            const javascriptNode = testAudioContext.createScriptProcessor(2048, 1, 1);

            analyser.smoothingTimeConstant = 0.8;
            analyser.fftSize = 1024;

            microphone.connect(analyser);
            analyser.connect(javascriptNode);
            javascriptNode.connect(testAudioContext.destination);

            isTesting = true;

            javascriptNode.onaudioprocess = () => {
                if (!isTesting) return;
                const array = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(array);
                let values = 0;
                const length = array.length;
                for (let i = 0; i < length; i++) values += array[i];
                const average = values / length;
                testLevel = Math.min(100, average * 3);
            };
        } catch (e) { console.error("Mic Test Error", e); }
    }

    export function stopMicrophoneTest() {
        isTesting = false;
        if (testAudioContext) { testAudioContext.close(); testAudioContext = null; }
        if (testStream) { testStream.getTracks().forEach(t => t.stop()); testStream = null; }
        testLevel = 0;
    }

    onDestroy(() => stopMicrophoneTest());
</script>

<div class="form-group">
    <label for="mic-select">{$t('voice.microphone')}</label>
    <select id="mic-select" bind:value={selectedAudioInput} on:change={() => {
        if (isTesting) { stopMicrophoneTest(); startMicrophoneTest(); }
    }}>
        <option value="">{$t('voice.defaultDevice')}</option>
        {#each audioInputs as device}
            <option value={device.deviceId}>{device.label || `Microphone ${device.deviceId.slice(0,4)}`}</option>
        {/each}
    </select>
    <div class="test-mic-area">
        <button class="test-btn" on:click={isTesting ? stopMicrophoneTest : startMicrophoneTest}>
            <i class="fas fa-microphone-alt"></i> {isTesting ? $t('voice.testStop') : $t('voice.test')}
        </button>
        <div class="mic-level-container">
            <div class="mic-level-bar" style="width: {testLevel}%"></div>
        </div>
    </div>
</div>

{#if audioOutputs.length > 0}
<div class="form-group">
    <label for="speaker-select">{$t('voice.speaker')}</label>
    <select id="speaker-select" bind:value={selectedAudioOutput}>
        <option value="">{$t('voice.defaultDevice')}</option>
        {#each audioOutputs as device}
            <option value={device.deviceId}>{device.label || `Speaker ${device.deviceId.slice(0,4)}`}</option>
        {/each}
    </select>
</div>
{/if}

<div class="form-group">
    <label for="camera-select">{$t('voice.camera')}</label>
    <select id="camera-select" bind:value={selectedVideoInput}>
        <option value="">{$t('voice.defaultDevice')}</option>
        {#each videoInputs as device}
            <option value={device.deviceId}>{device.label || `Camera ${device.deviceId.slice(0,4)}`}</option>
        {/each}
    </select>
</div>

<div class="checkbox-group">
    <label title={$t('voice.audioOnlyHint')}>
        <input type="checkbox" bind:checked={isVideoMuted}>
        {$t('voice.audioOnly')}
    </label>
    <label><input type="checkbox" bind:checked={echoCancellation}> {$t('voice.echoCancellation')}</label>
    <label title={$t('voice.noiseHint')}>
        <input type="checkbox" bind:checked={noiseCancellation}>
        {$t('voice.noiseCancellation')} <span class="badge">{$t('voice.beta')}</span>
    </label>
    <label><input type="checkbox" bind:checked={autoGainControl}> {$t('voice.autoGain')}</label>
</div>

<style>
    .form-group { display: flex; flex-direction: column; gap: 8px; }
    .form-group label { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #949ba4; }
    .form-group select, .form-group input { padding: 10px; border-radius: 4px; border: none; background: #1e1f22; color: #dbdee1; outline: none; }
    .checkbox-group { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    .checkbox-group label { display: flex; align-items: center; gap: 8px; cursor: pointer; color: #dbdee1; }
    .badge { background: #5865f2; color: white; padding: 2px 4px; border-radius: 4px; font-size: 10px; margin-left: 4px; vertical-align: middle; }
    .test-mic-area { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
    .test-btn { background: #40444b; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; }
    .test-btn:hover { background: #5865f2; }
    .mic-level-container { flex: 1; height: 6px; background: #202225; border-radius: 3px; overflow: hidden; }
    .mic-level-bar { height: 100%; background: #23a559; transition: width 0.1s; }
</style>
