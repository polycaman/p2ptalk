<script lang="ts">
    import { t } from '$lib/i18n';

    export let filteredFriends: any[];
    export let onlineFriends: Record<string, boolean>;
    export let friendSearch: string;
    export let onStartCall: (id: string, isGroup: boolean) => void;
    export let onRemoveFriend: (id: string, name: string) => void;
    export let onOpenChat: (id: string) => void;
    export let onDiagnostics: (id: string, name: string) => void;
</script>

<div class="friends-header">
    <input type="text" placeholder={$t('sidebar.searchFriends')} bind:value={friendSearch} class="friend-search-input" />
</div>

<div style="flex: 1; overflow-y: auto; min-height: 0;">
    <ul class="user-list">
        {#each filteredFriends as u}
        <li>
            <div class="user-row">
                <div class="user-info">
                    <div class="avatar small">
                        <img
                            src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${u.username}`}
                            alt={u.username}
                            style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; background: #2f3136;"
                        />
                        <div class="status-indicator" class:online={onlineFriends[u.id]}></div>
                    </div>
                    <div style="display: flex; flex-direction: column;">
                        <span class="name" class:online-text={onlineFriends[u.id]}>{u.displayName || u.username}</span>
                        {#if u.displayName && u.displayName !== u.username}
                            <span style="font-size: 10px; color: #72767d;">@{u.username}</span>
                        {/if}
                    </div>
                </div>
                <div class="user-actions">
                    <button class="chat-icon" on:click={() => onOpenChat(u.id)} title={$t('sidebar.chat')}>
                        <i class="fas fa-comment"></i>
                    </button>
                    <button class="call-icon" on:click={() => onStartCall(u.id, false)} title={$t('sidebar.call')}>
                        <i class="fas fa-phone"></i>
                    </button>
                    <button class="diag-icon" on:click|stopPropagation={() => onDiagnostics(u.id, u.displayName || u.username)} title={$t('sidebar.diagnostics')}>
                        <i class="fas fa-stethoscope"></i>
                    </button>
                    <button class="icon-btn tiny reject" on:click={() => onRemoveFriend(u.id, u.username)} title={$t('sidebar.removeFriend')}>
                        <i class="fas fa-user-minus"></i>
                    </button>
                </div>
            </div>
        </li>
        {:else}
            <li class="empty-state">{$t('sidebar.noFriends')}</li>
        {/each}
    </ul>
</div>

<style>
    .friends-header { padding: 0 16px 8px 16px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 8px; }
    .friend-search-input { background: #1e1f22; border: 1px solid #1e1f22; color: white; padding: 10px 12px; font-size: 14px; border-radius: 4px; outline: none; width: 100%; box-sizing: border-box; }
    .friend-search-input:focus { border-color: #5865f2; }

    .user-list { list-style: none; padding: 0 8px; margin: 0; display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto; }
    .user-row { display: flex; align-items: center; justify-content: space-between; padding: 8px; border-radius: 4px; cursor: pointer; transition: background 0.1s; height: 48px; }
    .user-row:hover { background: #35373c; }
    .user-row:hover .name { color: #dbdee1; }
    .user-row .user-info { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; overflow: hidden; }
    .user-row .user-actions { display: flex; align-items: center; gap: 4px; opacity: 0; transition: opacity 0.2s; flex-shrink: 0; }
    .user-row:hover .user-actions { opacity: 1; }
    .user-row .user-actions .icon-btn { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #2f3136; transition: all 0.2s; border: none; color: white; cursor: pointer; }
    .user-row .user-actions .icon-btn:hover { background: #40444b; color: #fff; }

    .avatar.small { width: 32px; height: 32px; font-size: 14px; position: relative; flex-shrink: 0; background: #5865f2; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; }
    .status-indicator { width: 14px; height: 14px; border-radius: 50%; background: #747f8d; position: absolute; bottom: -2px; right: -2px; border: 3px solid #2b2d31; }
    .status-indicator.online { background: #23a559; }
    .name { font-size: 15px; font-weight: 500; color: #949ba4; transition: color 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .name.online-text { color: #fff; font-weight: 600; }

    .call-icon, .chat-icon, .diag-icon { border: none; background: none; cursor: pointer; opacity: 0.6; color: white; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; transition: background 0.2s; }
    .call-icon:hover, .chat-icon:hover, .diag-icon:hover { background: #40444b; opacity: 1; }
    .chat-icon { color: #5865f2; }
    .diag-icon { color: #f0b232; font-size: 13px; }

    .icon-btn.tiny { padding: 4px; font-size: 12px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 4px; background: none; border: none; cursor: pointer; }
    .icon-btn.tiny.reject { color: #da373c; background: rgba(218, 55, 60, 0.1); }
    .icon-btn.tiny.reject:hover { background: #da373c; color: white; }

    .empty-state { padding: 16px; text-align: center; color: #949ba4; font-size: 13px; font-style: italic; }
</style>
