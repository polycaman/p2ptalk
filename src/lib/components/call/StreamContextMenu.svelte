<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { t } from '$lib/i18n';

    export let x: number;
    export let y: number;
    export let streamId: string;
    export let streamLabel: string;
    export let volume: number = 100;
    export let isMuted: boolean = false;

    const dispatch = createEventDispatcher();

    let menuEl: HTMLDivElement;

    function handleClickOutside(e: MouseEvent) {
        if (menuEl && !menuEl.contains(e.target as Node)) {
            dispatch('close');
        }
    }

    function toggleMute() {
        dispatch('toggleMute', { streamId, muted: !isMuted });
    }

    function handleVolume(e: Event) {
        const val = parseInt((e.target as HTMLInputElement).value);
        dispatch('volumeChange', { streamId, volume: val });
    }
</script>

<svelte:window on:click={handleClickOutside} />

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="context-menu" style="left: {x}px; top: {y}px;" bind:this={menuEl} on:click|stopPropagation>
    <div class="ctx-header">
        <span class="ctx-label">{streamLabel}</span>
    </div>
    <div class="ctx-divider"></div>
    <button class="ctx-item" on:click={toggleMute}>
        <i class="fas" class:fa-volume-up={!isMuted} class:fa-volume-mute={isMuted}></i>
        {isMuted ? $t('call.unmute') : $t('call.mute')}
    </button>
    <div class="ctx-volume">
        <i class="fas fa-volume-down"></i>
        <input
            type="range"
            min="0"
            max="100"
            value={volume}
            on:input={handleVolume}
            class="volume-slider"
        />
        <span class="vol-val">{volume}%</span>
    </div>
</div>

<style>
    .context-menu {
        position: fixed;
        z-index: 9999;
        background: #111214;
        border: 1px solid #2f3136;
        border-radius: 8px;
        min-width: 220px;
        padding: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.6);
        animation: fadeIn 0.12s ease-out;
    }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

    .ctx-header { padding: 8px 10px 4px; }
    .ctx-label { font-size: 12px; font-weight: 700; color: #b5bac1; text-transform: uppercase; }
    .ctx-divider { height: 1px; background: #2f3136; margin: 4px 0; }

    .ctx-item {
        display: flex; align-items: center; gap: 10px;
        width: 100%; background: none; border: none; color: #dcddde;
        padding: 8px 10px; border-radius: 4px; cursor: pointer; font-size: 14px;
        text-align: left; transition: background 0.1s;
    }
    .ctx-item:hover { background: #5865f2; color: #fff; }
    .ctx-item i { width: 18px; text-align: center; }

    .ctx-volume {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 10px; color: #b5bac1;
    }
    .ctx-volume i { font-size: 14px; flex-shrink: 0; }
    .vol-val { font-size: 12px; min-width: 32px; text-align: right; color: #dcddde; }

    .volume-slider {
        flex: 1; -webkit-appearance: none; appearance: none;
        height: 4px; background: #4f545c; border-radius: 2px; outline: none;
        cursor: pointer;
    }
    .volume-slider::-webkit-slider-thumb {
        -webkit-appearance: none; appearance: none;
        width: 14px; height: 14px; border-radius: 50%;
        background: #5865f2; cursor: pointer; border: 2px solid #fff;
        box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }
    .volume-slider::-moz-range-thumb {
        width: 14px; height: 14px; border-radius: 50%;
        background: #5865f2; cursor: pointer; border: 2px solid #fff;
    }
</style>
