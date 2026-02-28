<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { srcObject } from '$lib/actions/srcObject';
    import { t } from '$lib/i18n';
    import StreamContextMenu from './StreamContextMenu.svelte';

    export let featuredView: { stream: MediaStream | null, label: string, id: string, isLocal: boolean, streamType: 'cam' | 'screen' };
    export let localStream: MediaStream | null;
    export let localScreenStream: MediaStream | null;
    export let remoteStreams: Record<string, any>;
    export let isVideoMuted: boolean;
    export let isSidebarOpen: boolean;
    export let turnRelayCallPeers: Set<string> = new Set();
    export let peerUsernames: Record<string, string> = {};

    const dispatch = createEventDispatcher();

    // Per-stream volume & mute state
    let streamVolumes: Record<string, number> = {};
    let streamMutes: Record<string, boolean> = {};
    let ctxMenu: { x: number; y: number; streamId: string; label: string } | null = null;

    function getVolume(id: string) { return streamVolumes[id] ?? 100; }
    function getMuted(id: string) { return streamMutes[id] ?? false; }

    function setFeatured(stream: MediaStream | null | undefined, label: string, id: string, isLocal: boolean, streamType: 'cam' | 'screen') {
        if (!stream) return;
        dispatch('setFeatured', { stream, label, id, isLocal, streamType });
    }

    function resetLayout() {
        dispatch('resetLayout');
    }

    function toggleSidebar() {
        dispatch('toggleSidebar');
    }

    function openContextMenu(e: MouseEvent, streamId: string, label: string) {
        e.preventDefault();
        ctxMenu = { x: e.clientX, y: e.clientY, streamId, label };
    }

    function handleToggleMute(e: CustomEvent) {
        const { streamId, muted } = e.detail;
        streamMutes[streamId] = muted;
        streamMutes = streamMutes;
        applyVolume(streamId);
    }

    function handleVolumeChange(e: CustomEvent) {
        const { streamId, volume } = e.detail;
        streamVolumes[streamId] = volume;
        streamVolumes = streamVolumes;
        applyVolume(streamId);
    }

    function applyVolume(streamId: string) {
        const audioEl = document.querySelector(`audio[data-stream-id="${streamId}"]`) as HTMLAudioElement;
        if (audioEl) {
            audioEl.volume = getMuted(streamId) ? 0 : getVolume(streamId) / 100;
            audioEl.muted = getMuted(streamId);
        }
    }

    // Reactive declarations so Svelte tracks streamMutes/streamVolumes changes for the context menu
    $: ctxMuted = ctxMenu ? (streamMutes[ctxMenu.streamId] ?? false) : false;
    $: ctxVolume = ctxMenu ? (streamVolumes[ctxMenu.streamId] ?? 100) : 100;

    $: isMuted = featuredView.id === 'local'
        ? isVideoMuted
        : (featuredView.streamType === 'cam' && remoteStreams[featuredView.id]
            ? remoteStreams[featuredView.id].camMuted
            : false);

    // Check if the featured peer is using TURN relay (strip -screen suffix for lookup)
    $: featuredPeerId = featuredView.id.replace('-screen', '');
    $: isFeaturedRelayed = !featuredView.isLocal && turnRelayCallPeers.has(featuredPeerId);
</script>

<div class="featured-stage">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="featured-video-container" on:dblclick={resetLayout}
         on:contextmenu={(e) => !featuredView.isLocal && openContextMenu(e, featuredView.id, featuredView.label)}>
        <video autoplay playsinline muted={!featuredView.isLocal || featuredView.streamType === 'cam'} use:srcObject={featuredView.stream} class:hidden={isMuted}></video>

        {#if isMuted}
            <div class="avatar-placeholder" style="flex-direction: column;">
                <div class="avatar-circle" style="width: 150px; height: 150px; font-size: 64px;">
                    <span>{featuredView.label[0]}</span>
                </div>
                <div class="status-icon video-off" style="position: static; margin-top: 16px;">
                    <i class="fas fa-video-slash"></i>
                </div>
            </div>
        {/if}

        <div class="nametag large">
            {$t('call.doubleClickReset', { label: featuredView.label })}
            {#if isFeaturedRelayed}
                <span class="turn-tag"><i class="fas fa-server"></i> RELAY</span>
            {/if}
        </div>
    </div>
</div>

<div class="sidebar-strip" class:closed={!isSidebarOpen}>
    <button class="toggle-sidebar-btn" on:click={toggleSidebar} title={isSidebarOpen ? $t('call.collapse') : $t('call.expand')}>
        <i class="fas" class:fa-chevron-right={isSidebarOpen} class:fa-chevron-left={!isSidebarOpen}></i>
    </button>

    {#if isSidebarOpen}
        <div class="strip-content">
            <!-- Local Cam -->
            {#if featuredView.id !== 'local'}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div class="strip-item" on:click={() => setFeatured(localStream, $t('call.you'), 'local', true, 'cam')}>
                    <video autoplay playsinline muted use:srcObject={localStream} class:hidden={isVideoMuted}></video>
                    {#if isVideoMuted}
                        <div class="icon-ov"><i class="fas fa-video-slash"></i></div>
                    {/if}
                    <span class="label">{$t('call.you')}</span>
                </div>
            {/if}

            <!-- Local Screen -->
            {#if localScreenStream && featuredView.id !== 'local-screen'}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div class="strip-item" on:click={() => setFeatured(localScreenStream, $t('call.youScreen'), 'local-screen', true, 'screen')}>
                    <video autoplay playsinline muted use:srcObject={localScreenStream}></video>
                    <div class="nametag">{$t('call.youScreen')}</div>
                </div>
            {/if}

            <!-- Remote Peers -->
            {#each Object.entries(remoteStreams) as [uid, streams]}
                {#if streams.cam && (featuredView.id !== uid || featuredView.streamType !== 'cam')}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div class="strip-item" on:click={() => setFeatured(streams.cam, peerUsernames[uid] || $t('call.unknown'), uid, false, 'cam')}
                         on:contextmenu={(e) => openContextMenu(e, uid, peerUsernames[uid] || $t('call.unknown'))}>
                        <video autoplay playsinline muted use:srcObject={streams.cam} class:hidden={streams.camMuted}></video>
                        {#if streams.camMuted}
                            <div class="icon-ov"><i class="fas fa-video-slash"></i></div>
                        {/if}
                        <span class="label">
                            {peerUsernames[uid] || $t('call.unknown')}
                            {#if turnRelayCallPeers.has(uid)}
                                <i class="fas fa-server" style="color: #faa61a; margin-left: 2px;" title="TURN Relay"></i>
                            {/if}
                        </span>
                    </div>
                {/if}
                {#if streams.screen && (featuredView.id !== uid + '-screen')}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div class="strip-item" on:click={() => setFeatured(streams.screen, $t('call.screen', { name: peerUsernames[uid] || $t('call.unknown') }), uid + '-screen', false, 'screen')}
                         on:contextmenu={(e) => openContextMenu(e, uid + '-screen', $t('call.screen', { name: peerUsernames[uid] || $t('call.unknown') }))}>
                        <video autoplay playsinline use:srcObject={streams.screen}></video>
                        <span class="label">{$t('call.screen', { name: peerUsernames[uid] || $t('call.unknown') })}</span>
                    </div>
                {/if}
            {/each}
        </div>
    {/if}
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
    .featured-stage { flex: 1; padding: 16px; display: flex; align-items: center; justify-content: center; background: #000; min-height: 0; overflow: hidden; }
    .featured-video-container { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
    .featured-video-container video { max-width: 100%; max-height: 100%; object-fit: contain; }
    video.hidden { display: none !important; }

    .nametag { position: absolute; bottom: 12px; left: 12px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 13px; font-weight: 500; }
    .nametag.large { font-size: 18px; padding: 8px 16px; }
    .turn-tag {
        display: inline-flex; align-items: center; gap: 4px;
        background: rgba(250, 166, 26, 0.2); border: 1px solid rgba(250, 166, 26, 0.5);
        color: #faa61a; padding: 2px 8px; border-radius: 10px;
        font-size: 11px; font-weight: 700; margin-left: 8px; vertical-align: middle;
    }
    .turn-tag i { font-size: 9px; }

    .avatar-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; position: relative; }
    .avatar-circle {
        width: 100px; height: 100px; border-radius: 50%;
        background: linear-gradient(135deg, #5865f2 0%, #4752c4 100%);
        display: flex; align-items: center; justify-content: center;
        font-size: 36px; font-weight: bold; color: white; margin-bottom: 8px;
        box-shadow: 0 8px 16px rgba(0,0,0,0.4); border: 4px solid rgba(255,255,255,0.1);
    }
    .status-icon {
        position: absolute; bottom: 30%; right: 40%;
        background: #2b2d31; border-radius: 50%; width: 28px; height: 28px;
        display: flex; align-items: center; justify-content: center;
        color: #ed4245; border: 3px solid #2b2d31;
    }

    .sidebar-strip {
        position: absolute; right: 0; top: 0; bottom: 80px; width: 220px;
        background: rgba(0,0,0,0.8); display: flex; flex-direction: column;
        transition: transform 0.3s; z-index: 100; border-left: 1px solid #333;
    }
    .sidebar-strip.closed { transform: translateX(220px); }

    .toggle-sidebar-btn {
        position: absolute; left: -24px; top: 50%; transform: translateY(-50%);
        width: 24px; height: 48px; background: #333; border: none; color: white;
        border-top-left-radius: 8px; border-bottom-left-radius: 8px; cursor: pointer;
    }

    .strip-content { padding: 8px; overflow-y: auto; height: 100%; display: flex; flex-direction: column; gap: 8px; }
    .strip-item {
        width: 100%; aspect-ratio: 16/9; background: #222; border-radius: 4px;
        overflow: hidden; position: relative; cursor: pointer; border: 2px solid transparent;
    }
    .strip-item:hover { border-color: #5865f2; }
    .strip-item video { width: 100%; height: 100%; object-fit: cover; }
    .strip-item .label { position: absolute; bottom: 4px; left: 4px; font-size: 10px; background: rgba(0,0,0,0.6); padding: 2px 4px; border-radius: 2px; color: white; }
    .icon-ov { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: #222; color: #da373c; }
</style>
