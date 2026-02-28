<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { srcObject } from '$lib/actions/srcObject';
    import { t } from '$lib/i18n';
    import StreamContextMenu from './StreamContextMenu.svelte';

    export let localStream: MediaStream | null;
    export let localScreenStream: MediaStream | null;
    export let remoteStreams: Record<string, any>;
    export let isAudioMuted: boolean;
    export let isVideoMuted: boolean;
    export let activeSpeakerId: string | null;
    export let turnRelayCallPeers: Set<string> = new Set();
    export let peerUsernames: Record<string, string> = {};

    const dispatch = createEventDispatcher();

    // Per-stream volume & mute state
    let streamVolumes: Record<string, number> = {};
    let streamMutes: Record<string, boolean> = {};

    // Context menu state
    let ctxMenu: { x: number; y: number; streamId: string; label: string } | null = null;

    function getVolume(id: string) { return streamVolumes[id] ?? 100; }
    function getMuted(id: string) { return streamMutes[id] ?? false; }

    function hasVideoTrack(stream: MediaStream | null): boolean {
        return stream ? stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled : false;
    }

    function setFeatured(stream: MediaStream | null | undefined, label: string, id: string, isLocal: boolean, streamType: 'cam' | 'screen') {
        if (!stream) return;
        dispatch('setFeatured', { stream, label, id, isLocal, streamType });
    }

    function openContextMenu(e: MouseEvent, streamId: string, label: string) {
        e.preventDefault();
        ctxMenu = { x: e.clientX, y: e.clientY, streamId, label };
    }

    function handleToggleMute(e: CustomEvent) {
        const { streamId, muted } = e.detail;
        streamMutes[streamId] = muted;
        streamMutes = streamMutes; // trigger reactivity
        applyVolume(streamId);
    }

    function handleVolumeChange(e: CustomEvent) {
        const { streamId, volume } = e.detail;
        streamVolumes[streamId] = volume;
        streamVolumes = streamVolumes;
        applyVolume(streamId);
    }

    function applyVolume(streamId: string) {
        // Apply to the corresponding hidden audio element
        const audioEl = document.querySelector(`audio[data-stream-id="${streamId}"]`) as HTMLAudioElement;
        if (audioEl) {
            audioEl.volume = getMuted(streamId) ? 0 : getVolume(streamId) / 100;
            audioEl.muted = getMuted(streamId);
        }
    }

    // Reactive declarations so Svelte tracks streamMutes/streamVolumes changes for the context menu
    $: ctxMuted = ctxMenu ? (streamMutes[ctxMenu.streamId] ?? false) : false;
    $: ctxVolume = ctxMenu ? (streamVolumes[ctxMenu.streamId] ?? 100) : 100;
</script>

<div class="video-grid">
    <!-- Local Cam -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="video-container local"
         class:audio-only={isVideoMuted || !hasVideoTrack(localStream)}
         on:click={() => setFeatured(localStream, $t('call.you'), 'local', true, 'cam')}>

        <video autoplay playsinline muted use:srcObject={localStream} class:hidden={isVideoMuted || !hasVideoTrack(localStream)}></video>

        {#if isVideoMuted || !hasVideoTrack(localStream)}
            <div class="avatar-placeholder">
                <div class="avatar-circle">
                    <span>YOU</span>
                </div>
                <div class="status-icon video-off"><i class="fas fa-video-slash"></i></div>
            </div>
        {/if}

        <div class="nametag">{$t('call.you')}</div>
        {#if isAudioMuted}
            <div class="status-icon" style="top: 12px; right: 12px; bottom: auto; background: #da373c; border: none; width: 28px; height: 28px;">
                <i class="fas fa-microphone-slash" style="color: white; font-size: 14px;"></i>
            </div>
        {/if}
    </div>

    <!-- Local Screen -->
    {#if localScreenStream}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="video-container local screen" on:click={() => setFeatured(localScreenStream, $t('call.youScreen'), 'local-screen', true, 'screen')}>
            <video autoplay playsinline muted use:srcObject={localScreenStream}></video>
            <div class="nametag">{$t('call.youScreen')}</div>
        </div>
    {/if}

    <!-- Remote Peers -->
    {#each Object.entries(remoteStreams) as [uid, streams]}
        <!-- Cam / Audio Peer -->
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="video-container"
             class:speaking={activeSpeakerId === uid}
             class:audio-only={!streams.cam || !hasVideoTrack(streams.cam) || streams.camMuted}
             on:click={() => setFeatured(streams.cam, peerUsernames[uid] || $t('call.unknown'), uid, false, 'cam')}
             on:contextmenu={(e) => openContextMenu(e, uid, peerUsernames[uid] || $t('call.unknown'))}>

            {#if streams.cam}
                <video autoplay playsinline muted use:srcObject={streams.cam} class:hidden={!hasVideoTrack(streams.cam) || streams.camMuted}></video>
            {/if}

            {#if !streams.cam || !hasVideoTrack(streams.cam) || streams.camMuted}
                <div class="avatar-placeholder">
                    <div class="avatar-circle">
                        <span>{(peerUsernames[uid] || $t('call.unknown')).slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div class="status-icon video-off">
                        <i class="fas fa-video-slash"></i>
                    </div>
                </div>
            {/if}

            <div class="nametag">
                {peerUsernames[uid] || $t('call.unknown')}
                {#if streams.micMuted}
                    <i class="fas fa-microphone-slash" title={$t('call.micMuted')} style="margin-left: 4px; color: #ed4245;"></i>
                {/if}
                {#if getMuted(uid)}
                    <i class="fas fa-volume-mute" title={$t('call.mutedByYou')} style="margin-left: 4px; color: #faa61a;"></i>
                {/if}
            </div>

            {#if turnRelayCallPeers.has(uid)}
                <div class="turn-overlay" title={$t('call.turnRelayTooltip')}>
                    <i class="fas fa-server"></i> {$t('call.turnRelay')}
                </div>
            {/if}

            {#if activeSpeakerId === uid}
                <div class="speaking-ring"></div>
            {/if}
        </div>

        <!-- Screen Share -->
        {#if streams.screen}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="video-container screen"
                 on:click={() => setFeatured(streams.screen, $t('call.screen', { name: peerUsernames[uid] || $t('call.unknown') }), uid + '-screen', false, 'screen')}
                 on:contextmenu={(e) => openContextMenu(e, uid + '-screen', $t('call.screen', { name: peerUsernames[uid] || $t('call.unknown') }))}>
                <video autoplay playsinline use:srcObject={streams.screen}></video>
                <div class="nametag">
                    {$t('call.screen', { name: peerUsernames[uid] || $t('call.unknown') })}
                    {#if getMuted(uid + '-screen')}
                        <i class="fas fa-volume-mute" title={$t('call.mutedByYou')} style="margin-left: 4px; color: #faa61a;"></i>
                    {/if}
                </div>
            </div>
        {/if}
    {/each}
</div>

{#if ctxMenu}
    <StreamContextMenu
        x={ctxMenu.x}
        y={ctxMenu.y}
        streamId={ctxMenu.streamId}
        streamLabel={ctxMenu.label}
        volume={ctxVolume}
        isMuted={ctxMuted}
        on:toggleMute={handleToggleMute}
        on:volumeChange={handleVolumeChange}
        on:close={() => ctxMenu = null}
    />
{/if}

<style>
    .video-grid { flex: 1; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 16px; padding: 24px; overflow-y: auto; }
    .video-container {
        background: #1e1f22; border-radius: 12px; overflow: hidden; position: relative;
        aspect-ratio: 4/3; width: 320px; max-width: 100%; flex: 0 0 auto;
        border: 1px solid #1e1f22; display: flex; justify-content: center; align-items: center;
        cursor: pointer; transition: transform 0.2s, border-color 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    .video-container:hover { transform: scale(1.02); z-index: 10; border-color: #5865f2; }
    .video-container video { width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    .video-container.screen { aspect-ratio: 16/9; width: 600px; max-width: 100%; max-height: none; }
    .video-container.screen video { object-fit: contain; }
    .video-container.speaking { border-color: #23a559; box-shadow: 0 0 0 2px #23a559; }
    .video-container.audio-only { background-color: #2b2d31; display: flex; justify-content: center; align-items: center; }
    video.hidden { display: none !important; }

    .nametag { position: absolute; bottom: 12px; left: 12px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 13px; font-weight: 500; }

    .turn-overlay {
        position: absolute; top: 8px; left: 8px;
        background: rgba(250, 166, 26, 0.2); border: 1px solid rgba(250, 166, 26, 0.5);
        color: #faa61a; padding: 3px 8px; border-radius: 10px;
        font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
        display: flex; align-items: center; gap: 4px;
        backdrop-filter: blur(4px); z-index: 5;
    }
    .turn-overlay i { font-size: 9px; }

    .avatar-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; position: relative; }
    .avatar-circle {
        width: 100px; height: 100px; border-radius: 50%;
        background: linear-gradient(135deg, #5865f2 0%, #4752c4 100%);
        display: flex; align-items: center; justify-content: center;
        font-size: 36px; font-weight: bold; color: white; margin-bottom: 8px;
        box-shadow: 0 8px 16px rgba(0,0,0,0.4); border: 4px solid rgba(255,255,255,0.1);
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .video-container:hover .avatar-circle { transform: scale(1.1); }

    .status-icon {
        position: absolute; bottom: 30%; right: 40%;
        background: #2b2d31; border-radius: 50%; width: 28px; height: 28px;
        display: flex; align-items: center; justify-content: center;
        color: #ed4245; border: 3px solid #2b2d31; box-shadow: 0 2px 4px rgba(0,0,0,0.5);
    }

    @media (max-width: 768px) {
        .video-container { width: 100%; aspect-ratio: auto; flex-grow: 1; }
    }
</style>
