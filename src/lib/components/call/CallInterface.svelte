<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { srcObject } from '$lib/actions/srcObject';
    import { t } from '$lib/i18n';
    import VideoGrid from './VideoGrid.svelte';
    import FeaturedView from './FeaturedView.svelte';
    import MobileCarousel from './MobileCarousel.svelte';
    import ControlDock from './ControlDock.svelte';
    import ChatPanel from './ChatPanel.svelte';

    export let localStream: MediaStream | null;
    export let localScreenStream: MediaStream | null;
    export let remoteStreams: Record<string, any> = {};
    export let activeSpeakerId: string | null = null;

    export let isAudioMuted = false;
    export let isVideoMuted = true;
    export let isScreenSharing = false;
    export let e2eeActive = false;
    export let turnRelayCallPeers: Set<string> = new Set();
    export let peerUsernames: Record<string, string> = {};

    $: turnRelayActive = turnRelayCallPeers.size > 0;

    export let messages: any[] = [];
    export let messageInput = '';
    export let currentUsername: string = '';

    const dispatch = createEventDispatcher();

    // Local UI State
    let featuredView: { stream: MediaStream | null, label: string, id: string, isLocal: boolean, streamType: 'cam' | 'screen' } | null = null;
    let isSidebarOpen = true;

    // Chat & Mobile
    let innerWidth = 0;
    let mobileStreamIndex = 0;
    let isChatOpen = false;
    $: isMobile = innerWidth <= 768;

    // Derive all streams for mobile carousel
    $: allStreams = [
        { id: 'local', stream: localStream, user: { username: $t('call.you') }, isLocal: true, videoEnabled: !isVideoMuted, audioEnabled: !isAudioMuted },
        ...(localScreenStream ? [{ id: 'local-screen', stream: localScreenStream, user: { username: $t('call.youScreen') }, isLocal: true, videoEnabled: true, audioEnabled: true }] : []),
        ...Object.entries(remoteStreams).flatMap(([uid, s]) => {
            const name = peerUsernames[uid] || $t('call.unknown');
            const res: any[] = [];
            res.push({
                id: uid,
                stream: s.cam || null,
                user: { username: name },
                isLocal: false,
                videoEnabled: s.cam && !s.camMuted,
                audioEnabled: !s.micMuted
            });
            if (s.screen) {
                res.push({
                    id: uid + '-screen',
                    stream: s.screen,
                    user: { username: $t('call.screen', { name }) },
                    isLocal: false,
                    videoEnabled: true,
                    audioEnabled: true
                });
            }
            return res;
        })
    ];

    $: if (mobileStreamIndex >= allStreams.length) mobileStreamIndex = 0;

    function handleSetFeatured(e: CustomEvent) {
        const { stream, label, id, isLocal, streamType } = e.detail;
        if (!stream) return;
        featuredView = { stream, label, id, isLocal, streamType };
    }

    function resetLayout() {
        featuredView = null;
    }

    function toggleSidebar() {
        isSidebarOpen = !isSidebarOpen;
    }
</script>

<svelte:window bind:innerWidth />

<div class="call-layout" class:mobile={innerWidth <= 768}>

    <!-- AUDIO: Always play each remote user's audio via a dedicated hidden <audio> element -->
    {#each Object.entries(remoteStreams) as [uid, streams]}
        {#if streams.audio}
            <audio autoplay playsinline use:srcObject={streams.audio} data-stream-id={uid}></audio>
        {/if}
        {#if streams.screen}
            <audio autoplay playsinline use:srcObject={streams.screen} data-stream-id={uid + '-screen'} style="display:none;"></audio>
        {/if}
    {/each}

    <div class="main-stage">
        {#if innerWidth <= 768 && allStreams.length > 0}
            <MobileCarousel {allStreams} bind:mobileStreamIndex />

        {:else if featuredView}
            <FeaturedView
                {featuredView}
                {localStream}
                {localScreenStream}
                {remoteStreams}
                {isVideoMuted}
                {isSidebarOpen}
                {turnRelayCallPeers}
                {peerUsernames}
                on:setFeatured={handleSetFeatured}
                on:resetLayout={resetLayout}
                on:toggleSidebar={toggleSidebar}
            />

        {:else}
            <VideoGrid
                {localStream}
                {localScreenStream}
                {remoteStreams}
                {isAudioMuted}
                {isVideoMuted}
                {activeSpeakerId}
                {turnRelayCallPeers}
                {peerUsernames}
                on:setFeatured={handleSetFeatured}
            />
        {/if}

        <ControlDock
            {isScreenSharing}
            {isVideoMuted}
            {isAudioMuted}
            {e2eeActive}
            {turnRelayCallPeers}
            on:shareScreen
            on:stopScreenShare
            on:toggleVideo
            on:toggleAudio
            on:openSettings
            on:fileSelect
            on:openInvite
            on:hangUp
        />
    </div>

    <ChatPanel
        {messages}
        bind:messageInput
        {isChatOpen}
        {currentUsername}
        on:sendMessage
        on:requestFile
        on:toggleChat={() => isChatOpen = !isChatOpen}
    />
</div>

<slot />

<style>
    .call-layout { display: flex; height: calc(100vh - 48px); height: calc(100dvh - 48px); background: #000; overflow: hidden; position: relative; }
    .main-stage { flex: 1; display: flex; flex-direction: column; position: relative; overflow: hidden; }

    @media (max-width: 768px) {
        .call-layout { flex-direction: column; height: calc(100vh - 48px); height: calc(100dvh - 48px); position: relative; }
        .main-stage { flex: 1; height: auto; min-height: 0; }
    }
</style>
