<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Conversation } from '$lib/types/chat';
    import { t } from '$lib/i18n';

    export let conversations: Conversation[] = [];
    export let activeId: string | null = null;
    export let onlineFriends: Record<string, boolean> = {};
    export let unreadCounts: Record<string, number> = {};
    export let currentUserId: string = '';
    export let searchQuery: string = '';
    export let turnRelayChatPeers: Set<string> = new Set();

    const dispatch = createEventDispatcher();

    function getName(conv: Conversation): string {
        if (conv.type === 'group') return conv.name || $t('convList.group');
        const other = conv.members.find(m => m.userId !== currentUserId);
        return other?.displayName || other?.username || $t('convList.unknown');
    }

    function getAvatar(conv: Conversation): string {
        if (conv.type === 'group') return '';
        const other = conv.members.find(m => m.userId !== currentUserId);
        return other ? `https://api.dicebear.com/9.x/avataaars/svg?seed=${other.username}` : '';
    }

    function isOnline(conv: Conversation): boolean {
        if (conv.type === 'group') {
            return conv.members.some(m => m.userId !== currentUserId && onlineFriends[m.userId]);
        }
        const other = conv.members.find(m => m.userId !== currentUserId);
        return other ? !!onlineFriends[other.userId] : false;
    }

    function getPreview(conv: Conversation): string {
        if (!conv.lastMessage) return $t('convList.noMessages');
        const name = conv.lastMessage.senderId === currentUserId ? $t('convList.you') : conv.lastMessage.senderName;
        if (conv.lastMessage.type === 'voice') return `${name}: ${$t('convList.voice')}`;
        if (conv.lastMessage.type === 'image') return `${name}: ${$t('convList.image')}`;
        if (conv.lastMessage.type === 'video') return `${name}: ${$t('convList.video')}`;
        if (conv.lastMessage.type === 'file') return `${name}: ${$t('convList.file', { name: conv.lastMessage.content })}`;
        const content = conv.lastMessage.content.length > 40
            ? conv.lastMessage.content.substring(0, 40) + '…'
            : conv.lastMessage.content;
        return conv.type === 'group' ? `${name}: ${content}` : content;
    }

    function getTime(conv: Conversation): string {
        if (!conv.lastActivity) return '';
        const d = new Date(conv.lastActivity);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    function isRelayed(conv: Conversation): boolean {
        if (conv.type !== 'dm') return false;
        const other = conv.members.find(m => m.userId !== currentUserId);
        return other ? turnRelayChatPeers.has(other.userId) : false;
    }
</script>

<div class="list-header">
    <h3>{$t('convList.title')}</h3>
    <button class="new-group-btn" on:click={() => dispatch('createGroup')} title={$t('convList.newGroup')}>
        <i class="fas fa-users"></i><i class="fas fa-plus" style="font-size: 8px; margin-left: 2px;"></i>
    </button>
</div>

<div class="search-wrap">
    <i class="fas fa-search"></i>
    <input type="text" placeholder={$t('convList.search')} bind:value={searchQuery} />
</div>

<div class="conversation-items">
    {#each conversations as conv (conv.id)}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="conv-item" class:active={activeId === conv.id} on:click={() => dispatch('select', conv.id)}>
            <div class="conv-avatar">
                {#if conv.type === 'group'}
                    <div class="group-avatar"><i class="fas fa-users"></i></div>
                {:else}
                    <img src={getAvatar(conv)} alt="" />
                {/if}
                <div class="status-dot" class:online={isOnline(conv)}></div>
            </div>
            <div class="conv-info">
                <div class="conv-top-row">
                    <span class="conv-name">
                        {getName(conv)}
                        {#if isRelayed(conv)}
                            <span class="turn-indicator" title={$t('convList.turnTooltip')}>
                                <i class="fas fa-server"></i>
                            </span>
                        {/if}
                    </span>
                    <span class="conv-time">{getTime(conv)}</span>
                </div>
                <div class="conv-bottom-row">
                    <span class="conv-preview">{getPreview(conv)}</span>
                    {#if (unreadCounts[conv.id] || 0) > 0}
                        <span class="unread-badge">{unreadCounts[conv.id]}</span>
                    {/if}
                </div>
            </div>
        </div>
    {:else}
        <div class="empty">
            <p>{$t('convList.empty')}</p>
            <p class="hint">{$t('convList.emptyHint')}</p>
        </div>
    {/each}
</div>

<style>
    .list-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 8px; }
    .list-header h3 { margin: 0; font-size: 16px; color: #fff; font-weight: 700; }
    .new-group-btn {
        background: none; border: none; color: #b5bac1; cursor: pointer;
        font-size: 16px; padding: 6px 8px; border-radius: 4px; transition: all 0.2s;
        display: flex; align-items: center;
    }
    .new-group-btn:hover { background: #35373c; color: #fff; }

    .search-wrap { padding: 0 12px 8px; position: relative; }
    .search-wrap i { position: absolute; left: 22px; top: 50%; transform: translateY(-50%); color: #72767d; font-size: 12px; pointer-events: none; }
    .search-wrap input {
        width: 100%; padding: 8px 8px 8px 32px; background: #1e1f22;
        border: 1px solid transparent; border-radius: 4px; color: #dbdee1;
        font-size: 13px; outline: none; box-sizing: border-box;
    }
    .search-wrap input:focus { border-color: #5865f2; }

    .conversation-items { flex: 1; overflow-y: auto; padding: 0 8px; }

    .conv-item {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 8px; border-radius: 6px; cursor: pointer; transition: background 0.15s;
    }
    .conv-item:hover { background: #35373c; }
    .conv-item.active { background: #404249; }

    .conv-avatar { position: relative; flex-shrink: 0; width: 40px; height: 40px; }
    .conv-avatar img { width: 40px; height: 40px; border-radius: 50%; background: #2f3136; }
    .group-avatar {
        width: 40px; height: 40px; border-radius: 50%; background: #5865f2;
        display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;
    }
    .status-dot {
        position: absolute; bottom: 0; right: 0; width: 12px; height: 12px;
        border-radius: 50%; background: #747f8d; border: 2px solid #2b2d31;
    }
    .status-dot.online { background: #23a559; }

    .conv-info { flex: 1; min-width: 0; }
    .conv-top-row { display: flex; justify-content: space-between; align-items: baseline; }
    .conv-name { font-size: 15px; font-weight: 600; color: #dbdee1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px; }
    .turn-indicator { color: #faa61a; font-size: 10px; flex-shrink: 0; }
    .conv-time { font-size: 11px; color: #72767d; flex-shrink: 0; margin-left: 4px; }
    .conv-bottom-row { display: flex; justify-content: space-between; align-items: center; margin-top: 2px; }
    .conv-preview { font-size: 13px; color: #949ba4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
    .unread-badge { background: #5865f2; color: white; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 10px; margin-left: 6px; flex-shrink: 0; }

    .empty { text-align: center; color: #72767d; padding: 32px 16px; }
    .empty p { margin: 4px 0; font-size: 14px; }
    .empty .hint { font-size: 12px; }
</style>
