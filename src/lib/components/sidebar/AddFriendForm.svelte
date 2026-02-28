<script lang="ts">
    import { enhance } from '$app/forms';
    import { t } from '$lib/i18n';
    import type { Socket } from 'socket.io-client';

    export let addFriendUsername: string;
    export let socket: Socket;
    export let userId: string;
    export let form: any;
</script>

<div class="add-friend-section">
    <form method="POST" action="?/sendFriendRequest" use:enhance={() => {
        const username = addFriendUsername;
        return async ({ result, update }) => {
            if (result.type === 'success') {
                if (socket) socket.emit('send-friend-request', { fromUserId: userId, toUsername: username });
                addFriendUsername = '';
            }
            await update();
        };
    }}>
        <input type="text" name="username" placeholder={$t('sidebar.addFriend')} bind:value={addFriendUsername} required />
        <button type="submit" title={$t('sidebar.sendRequest')}><i class="fas fa-user-plus"></i></button>
    </form>
    {#if form?.error} <p class="error-msg">{form.error}</p> {/if}
    {#if form?.success} <p class="success-msg">{form.message || 'Request sent!'}</p> {/if}
</div>

<style>
    .add-friend-section { padding: 16px; border-top: 1px solid #1f2023; flex-shrink: 0; }
    .add-friend-section form { display: flex; gap: 8px; }
    .add-friend-section input { flex: 1; padding: 8px; background: #1e1f22; border: none; border-radius: 4px; color: white; font-size: 13px; }
    .add-friend-section button { background: #23a559; color: white; border: none; padding: 0 12px; border-radius: 4px; cursor: pointer; }
    .error-msg { color: #da373c; font-size: 12px; padding: 4px 0; margin: 0; }
    .success-msg { color: #23a559; font-size: 12px; padding: 4px 0; margin: 0; }
</style>
