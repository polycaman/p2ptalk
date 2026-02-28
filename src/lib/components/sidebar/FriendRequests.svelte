<script lang="ts">
    import { enhance } from '$app/forms';
    import { t } from '$lib/i18n';
    import type { Socket } from 'socket.io-client';

    export let friendRequests: any[];
    export let socket: Socket;
    export let userId: string;
</script>

{#if friendRequests.length > 0}
    <div class="section-label">{$t('sidebar.requests', { n: friendRequests.length })}</div>
    <ul class="user-list request-list">
        {#each friendRequests as req}
            <li>
                <div class="user-row">
                    <div class="user-info">
                        <div class="avatar small">
                            <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${req.username}`} alt={req.username} style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; background: #2f3136;" />
                        </div>
                        <span class="name">{req.username}</span>
                    </div>
                    <div class="user-actions" style="opacity:1;">
                        <form method="POST" action="?/acceptFriendRequest" use:enhance={() => {
                            return async ({ result, update }) => {
                                if (result.type === 'success') {
                                    if (socket) socket.emit('accept-friend-request', { acceptorId: userId, requestId: req.id });
                                }
                                await update();
                            };
                        }} style="display:inline;">
                            <input type="hidden" name="requestId" value={req.id}>
                            <button class="icon-btn tiny accept" title={$t('sidebar.acceptRequest')}><i class="fas fa-check"></i></button>
                        </form>
                        <form method="POST" action="?/rejectFriendRequest" use:enhance style="display:inline;">
                            <input type="hidden" name="requestId" value={req.id}>
                            <button class="icon-btn tiny reject" title={$t('sidebar.rejectRequest')}><i class="fas fa-times"></i></button>
                        </form>
                    </div>
                </div>
            </li>
        {/each}
    </ul>
{/if}

<style>
    .section-label { padding: 8px 16px; font-size: 11px; font-weight: 700; color: #949ba4; text-transform: uppercase; margin-top: 16px; }
    .request-list { max-height: 180px; overflow-y: auto; flex-shrink: 0; }
    .user-list { list-style: none; padding: 0 8px; margin: 0; display: flex; flex-direction: column; gap: 2px; }
    .user-row { display: flex; align-items: center; justify-content: space-between; padding: 8px; border-radius: 4px; cursor: pointer; transition: background 0.1s; height: 48px; }
    .user-row:hover { background: #35373c; }
    .user-row .user-info { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; overflow: hidden; }
    .user-row .user-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .avatar.small { width: 32px; height: 32px; font-size: 14px; position: relative; flex-shrink: 0; background: #5865f2; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; }
    .name { font-size: 15px; font-weight: 500; color: #949ba4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .icon-btn.tiny { padding: 4px; font-size: 12px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 4px; background: none; border: none; cursor: pointer; }
    .icon-btn.tiny.accept { color: #23a559; background: rgba(35, 165, 89, 0.1); }
    .icon-btn.tiny.accept:hover { background: #23a559; color: white; }
    .icon-btn.tiny.reject { color: #da373c; background: rgba(218, 55, 60, 0.1); }
    .icon-btn.tiny.reject:hover { background: #da373c; color: white; }
</style>
