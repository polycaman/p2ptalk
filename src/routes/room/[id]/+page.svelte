<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { t } from '$lib/i18n';

    export let data: any;

    const errorType: string | undefined = data.errorType;
    const room = data.room;

    onMount(() => {
        if (room && !errorType) {
            sessionStorage.setItem('autoJoinRoom', room.id);
            goto('/', { replaceState: true });
        }
    });
</script>

<div class="room-page">
    <div class="bg-glow"></div>

    {#if errorType === 'not_found'}
        <!-- Room not found / expired -->
        <div class="card">
            <div class="icon-circle ghost">
                <i class="fas fa-ghost"></i>
            </div>
            <h1>{$t('room.notFound')}</h1>
            <p class="subtitle">{$t('room.notFoundDesc')}</p>
            <div class="hint-box">
                <i class="fas fa-info-circle"></i>
                <span>{$t('room.notFoundHint')}</span>
            </div>
            <button class="btn-primary" on:click={() => goto('/')}>
                <i class="fas fa-home"></i> {$t('room.goHome')}
            </button>
        </div>

    {:else if errorType === 'not_public'}
        <!-- Room exists but isn't public -->
        <div class="card">
            <div class="icon-circle locked">
                <i class="fas fa-lock"></i>
            </div>
            <h1>{$t('room.accessDenied')}</h1>
            {#if data.roomName}
                <div class="room-name-badge">
                    <i class="fas" class:fa-user-friends={data.roomScope === 'friends'} class:fa-lock={data.roomScope === 'private'}></i>
                    {data.roomName}
                </div>
            {/if}
            <p class="subtitle">
                {#if data.roomScope === 'friends'}
                    {$t('room.friendsOnly')}
                {:else}
                    {$t('room.privateOnly')}
                {/if}
            </p>
            <div class="hint-box">
                <i class="fas fa-lightbulb"></i>
                <span>
                    {#if data.roomScope === 'friends'}
                        {$t('room.friendsHint')}
                    {:else}
                        {$t('room.privateHint')}
                    {/if}
                </span>
            </div>
            <button class="btn-primary" on:click={() => goto('/')}>
                <i class="fas fa-home"></i> {$t('room.goHome')}
            </button>
        </div>

    {:else if room}
        <!-- Valid room — redirecting -->
        <div class="card joining">
            <div class="icon-circle join">
                <div class="pulse-ring"></div>
                <i class="fas fa-headset"></i>
            </div>
            <h1>{room.name}</h1>
            <p class="subtitle">{$t('room.hostedBy', { name: room.initiatorName })}</p>
            <div class="tags">
                <span class="tag scope"><i class="fas fa-globe"></i> {$t('room.public')}</span>
                {#if room.allowTurn}
                    <span class="tag turn"><i class="fas fa-server"></i> TURN</span>
                {/if}
            </div>
            <div class="joining-bar">
                <div class="joining-track"><div class="joining-fill"></div></div>
                <span>{$t('room.joining')}</span>
            </div>
        </div>
    {/if}
</div>

<style>
    .room-page {
        display: flex; align-items: center; justify-content: center;
        height: 100vh; background: #1e1f22; color: #dbdee1;
        font-family: 'gg sans', 'Helvetica Neue', Arial, sans-serif;
        position: relative; overflow: hidden;
    }

    /* Ambient background glow */
    .bg-glow {
        position: absolute; width: 500px; height: 500px; border-radius: 50%;
        background: radial-gradient(circle, rgba(88, 101, 242, 0.12) 0%, transparent 70%);
        top: 50%; left: 50%; transform: translate(-50%, -50%);
        pointer-events: none; animation: glow-breathe 4s ease-in-out infinite;
    }
    @keyframes glow-breathe {
        0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
        50% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
    }

    /* Card */
    .card {
        position: relative; z-index: 1;
        background: #2b2d31; border-radius: 16px; padding: 48px 40px;
        text-align: center; max-width: 440px; width: 92%;
        border: 1px solid #3f4147;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset;
        animation: card-enter 0.4s ease-out;
    }
    @keyframes card-enter {
        from { opacity: 0; transform: translateY(20px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Icon circles */
    .icon-circle {
        width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px;
        display: flex; align-items: center; justify-content: center;
        font-size: 32px; position: relative;
    }
    .icon-circle.ghost {
        background: linear-gradient(135deg, rgba(114, 118, 125, 0.2), rgba(114, 118, 125, 0.05));
        color: #72767d; border: 2px solid rgba(114, 118, 125, 0.3);
    }
    .icon-circle.locked {
        background: linear-gradient(135deg, rgba(237, 66, 69, 0.2), rgba(237, 66, 69, 0.05));
        color: #ed4245; border: 2px solid rgba(237, 66, 69, 0.3);
    }
    .icon-circle.join {
        background: linear-gradient(135deg, rgba(88, 101, 242, 0.25), rgba(88, 101, 242, 0.05));
        color: #5865f2; border: 2px solid rgba(88, 101, 242, 0.4);
    }

    /* Pulse ring for joining state */
    .pulse-ring {
        position: absolute; inset: -8px; border-radius: 50%;
        border: 2px solid rgba(88, 101, 242, 0.4);
        animation: pulse-out 1.5s ease-out infinite;
    }
    @keyframes pulse-out {
        0% { transform: scale(1); opacity: 0.6; }
        100% { transform: scale(1.5); opacity: 0; }
    }

    .card h1 {
        margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #f2f3f5;
        letter-spacing: -0.3px;
    }
    .card .subtitle {
        color: #949ba4; margin: 0 0 24px; font-size: 15px; line-height: 1.5;
    }
    .card .subtitle strong { color: #dbdee1; }

    /* Room name badge (for not-public error) */
    .room-name-badge {
        display: inline-flex; align-items: center; gap: 8px;
        background: #1e1f22; border: 1px solid #3f4147;
        padding: 8px 16px; border-radius: 10px;
        font-weight: 600; font-size: 15px; color: #f2f3f5;
        margin-bottom: 16px;
    }
    .room-name-badge i { font-size: 13px; color: #949ba4; }

    /* Hint box */
    .hint-box {
        display: flex; align-items: flex-start; gap: 10px; text-align: left;
        background: rgba(88, 101, 242, 0.08); border: 1px solid rgba(88, 101, 242, 0.15);
        border-radius: 10px; padding: 14px 16px; margin-bottom: 24px;
        font-size: 13px; color: #b5bac1; line-height: 1.5;
    }
    .hint-box i { color: #5865f2; margin-top: 2px; flex-shrink: 0; }

    /* Tags */
    .tags { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 24px; }
    .tag {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 11px; font-weight: 700; padding: 4px 12px;
        border-radius: 12px; letter-spacing: 0.3px; text-transform: uppercase;
    }
    .tag.scope { background: rgba(88, 101, 242, 0.15); color: #8b9bfa; }
    .tag.turn { background: rgba(250, 166, 26, 0.15); color: #faa61a; }

    /* Joining progress bar */
    .joining-bar {
        display: flex; flex-direction: column; align-items: center; gap: 12px;
    }
    .joining-bar span { font-size: 14px; font-weight: 600; color: #5865f2; }
    .joining-track {
        width: 100%; height: 4px; background: #1e1f22; border-radius: 4px; overflow: hidden;
    }
    .joining-fill {
        height: 100%; width: 40%; background: linear-gradient(90deg, #5865f2, #7289da);
        border-radius: 4px; animation: fill-slide 1.2s ease-in-out infinite;
    }
    @keyframes fill-slide {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(350%); }
    }

    /* Buttons */
    .btn-primary {
        background: #5865f2; color: white; border: none;
        padding: 12px 28px; border-radius: 8px; cursor: pointer;
        font-weight: 600; font-size: 15px;
        display: inline-flex; align-items: center; gap: 8px;
        transition: all 0.2s;
    }
    .btn-primary:hover { background: #4752c4; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(88, 101, 242, 0.35); }
    .btn-primary:active { transform: translateY(0); }

    @media (max-width: 480px) {
        .card { padding: 36px 24px; }
        .card h1 { font-size: 20px; }
        .bg-glow { width: 300px; height: 300px; }
    }
</style>
