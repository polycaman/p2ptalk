<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { t } from '$lib/i18n';

    export let isScreenSharing: boolean;
    export let isVideoMuted: boolean;
    export let isAudioMuted: boolean;
    export let e2eeActive: boolean;
    export let turnRelayCallPeers: Set<string> = new Set();

    $: turnRelayCount = turnRelayCallPeers.size;

    const dispatch = createEventDispatcher();

    let fileInput: HTMLInputElement;

    function handleFileSelect() {
        if (fileInput.files && fileInput.files.length > 0) {
            dispatch('fileSelect', fileInput.files[0]);
        }
    }
</script>

<div class="control-dock">
    {#if e2eeActive}
        <div class="e2ee-badge secure" title={$t('controls.e2eeSecure')}>
            <i class="fas fa-lock"></i> {$t('controls.e2ee')}
        </div>
    {:else}
        <div class="e2ee-badge insecure" title={$t('controls.noE2eeTooltip')}>
            <i class="fas fa-lock-open"></i> {$t('controls.noE2ee')}
        </div>
    {/if}

    {#if turnRelayCount > 0}
        <div class="turn-badge" title={$t('controls.turnTooltip', { n: turnRelayCount })}>
            <i class="fas fa-server"></i> {$t('controls.turnBadge')} <span class="turn-count">{turnRelayCount}</span>
        </div>
    {/if}

    {#if isScreenSharing}
        <button class="dock-btn active" on:click={() => dispatch('stopScreenShare')} title={$t('controls.stopScreen')}>
            <i class="fas fa-stop"></i>
        </button>
    {:else}
        <button class="dock-btn" on:click={() => dispatch('shareScreen')} title={$t('controls.shareScreen')}>
            <i class="fas fa-desktop"></i>
        </button>
    {/if}

    <button class="dock-btn" class:muted={isVideoMuted} on:click={() => dispatch('toggleVideo')} title={$t('controls.toggleCamera')}>
        {#if isVideoMuted} <i class="fas fa-video-slash"></i> {:else} <i class="fas fa-video"></i> {/if}
    </button>

    <button class="dock-btn" class:muted={isAudioMuted} on:click={() => dispatch('toggleAudio')} title={$t('controls.toggleMic')}>
        {#if isAudioMuted} <i class="fas fa-microphone-slash"></i> {:else} <i class="fas fa-microphone"></i> {/if}
    </button>

    <button class="dock-btn" on:click={() => dispatch('openSettings')} title={$t('controls.settings')}>
        <i class="fas fa-cog"></i>
    </button>

    <label class="dock-btn" title="Share File">
        <i class="fas fa-file-upload"></i>
        <input type="file" style="display:none" bind:this={fileInput} on:change={handleFileSelect}>
    </label>

    <button class="dock-btn invite" on:click={() => dispatch('openInvite')} title={$t('controls.inviteFriends')}>
        <i class="fas fa-user-plus"></i>
    </button>

    <button class="dock-btn hangup" on:click={() => dispatch('hangUp')} title={$t('controls.leave')}>
        <i class="fas fa-phone-slash"></i>
    </button>
</div>

<style>
    .control-dock { height: 80px; background: #1e1f22; display: flex; align-items: center; justify-content: center; gap: 16px; z-index: 150; }
    .dock-btn {
        width: 56px; height: 56px; border-radius: 50%; border: none; background: #2b2d31;
        color: #fff; font-size: 24px; cursor: pointer; transition: 0.2s;
        display: flex; align-items: center; justify-content: center;
    }
    .dock-btn:hover { background: #35373c; }
    .dock-btn.active { background: #ed4245; }
    .dock-btn.muted { background: #da373c; }
    .dock-btn.hangup { background: #da373c; width: 64px; height: 64px; }

    .e2ee-badge {
        display: flex; align-items: center; gap: 6px;
        padding: 6px 14px; border-radius: 20px;
        font-size: 12px; font-weight: 700; letter-spacing: 0.5px;
        white-space: nowrap; user-select: none;
    }
    .e2ee-badge.secure {
        background: rgba(35, 165, 89, 0.15); border: 1px solid rgba(35, 165, 89, 0.4);
        color: #57d28c;
    }
    .e2ee-badge.insecure {
        background: rgba(237, 66, 69, 0.15); border: 1px solid rgba(237, 66, 69, 0.4);
        color: #f38688;
    }
    .e2ee-badge i { font-size: 11px; }

    .turn-badge {
        display: flex; align-items: center; gap: 6px;
        padding: 6px 14px; border-radius: 20px;
        font-size: 12px; font-weight: 700; letter-spacing: 0.5px;
        white-space: nowrap; user-select: none;
        background: rgba(250, 166, 26, 0.15); border: 1px solid rgba(250, 166, 26, 0.4);
        color: #faa61a; cursor: help;
    }
    .turn-badge i { font-size: 11px; }
    .turn-count {
        background: rgba(250, 166, 26, 0.3); padding: 1px 6px; border-radius: 8px;
        font-size: 10px; min-width: 14px; text-align: center;
    }

    @media (max-width: 768px) {
        .control-dock {
            height: auto; padding: 12px 8px; padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
            display: flex; flex-wrap: wrap;
            justify-content: center; gap: 12px; background: #111; flex-shrink: 0;
        }
        .dock-btn { width: 44px; height: 44px; font-size: 18px; }
        .dock-btn.hangup { width: 52px; height: 52px; }
    }
</style>
