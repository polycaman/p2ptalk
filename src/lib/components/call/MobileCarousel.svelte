<script lang="ts">
    import { srcObject } from '$lib/actions/srcObject';

    type StreamEntry = {
        id: string;
        stream: MediaStream | null;
        user: { username: string };
        isLocal: boolean;
        videoEnabled: boolean;
        audioEnabled: boolean;
    };

    export let allStreams: StreamEntry[];
    export let mobileStreamIndex: number;

    function nextStream() {
        if (allStreams.length === 0) return;
        mobileStreamIndex = (mobileStreamIndex + 1) % allStreams.length;
    }

    function prevStream() {
        if (allStreams.length === 0) return;
        mobileStreamIndex = (mobileStreamIndex - 1 + allStreams.length) % allStreams.length;
    }
</script>

<div class="mobile-carousel">
    <button class="nav-btn prev" on:click={prevStream}>
        <i class="fas fa-chevron-left"></i>
    </button>

    {#key mobileStreamIndex}
        {@const streamData = allStreams[mobileStreamIndex]}
        <div class="carousel-slide">
            <div class="video-container mobile-fullscreen">
                {#if streamData.stream && streamData.videoEnabled}
                    <video autoplay playsinline muted use:srcObject={streamData.stream}></video>
                {:else}
                    <div class="avatar-placeholder">
                        <div class="avatar-circle">
                            {streamData.user?.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div class="status-icon video-off"><i class="fas fa-video-slash"></i></div>
                    </div>
                {/if}
                <div class="nametag large">
                    {streamData.user?.username || 'Unknown'}
                </div>
            </div>
        </div>
    {/key}

    <button class="nav-btn next" on:click={nextStream}>
        <i class="fas fa-chevron-right"></i>
    </button>

    <div class="carousel-dots">
        {#each allStreams as _, i}
            <div class="dot" class:active={i === mobileStreamIndex}></div>
        {/each}
    </div>
</div>

<style>
    .mobile-carousel { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; background: #000; overflow: hidden; }

    .carousel-slide { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; position: absolute; top: 0; left: 0; }

    .video-container.mobile-fullscreen { width: 100%; height: 100%; border-radius: 0; border: none; background: #111; display: flex; justify-content: center; align-items: center; position: relative; }
    .video-container.mobile-fullscreen video { object-fit: contain; width: 100%; height: 100%; }

    .nav-btn {
        position: absolute; top: 50%; transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.5); color: white; border: none; border-radius: 50%;
        width: 48px; height: 48px; z-index: 200; display: flex; align-items: center;
        justify-content: center; cursor: pointer; font-size: 20px; backdrop-filter: blur(4px);
    }
    .nav-btn.prev { left: 16px; }
    .nav-btn.next { right: 16px; }

    .carousel-dots { position: absolute; bottom: 20px; left: 0; right: 0; display: flex; justify-content: center; gap: 8px; z-index: 200; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255, 255, 255, 0.3); transition: 0.2s; }
    .dot.active { background: #fff; transform: scale(1.2); }

    .nametag { position: absolute; bottom: 12px; left: 12px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 13px; font-weight: 500; }
    .nametag.large { font-size: 18px; padding: 8px 16px; }

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
</style>
