<script lang="ts">
    import { createEventDispatcher, afterUpdate } from 'svelte';
    import MessageBubble from './MessageBubble.svelte';
    import VoiceRecorder from './VoiceRecorder.svelte';
    import type { Conversation, ChatMessage } from '$lib/types/chat';
    import { t } from '$lib/i18n';
    import { formatBytes, clearAllChatData, clearMediaOnly, chatStorageSize } from '$lib/chatPersistence';

    export let conversation: Conversation;
    export let messages: ChatMessage[] = [];
    export let currentUser: any;
    export let isOnline: boolean = false;
    export let typingUsers: { userId: string; username: string }[] = [];
    export let chatDataChannels: Record<string, RTCDataChannel> = {};
    export let isTurnRelayed: boolean = false;

    const dispatch = createEventDispatcher();

    let input = '';
    let messagesContainer: HTMLDivElement;
    let fileInput: HTMLInputElement;
    let shouldAutoScroll = true;
    let showStorageMenu = false;

    async function handleClearAll() {
        if (confirm($t('chatWindow.deleteConfirm'))) {
            await clearAllChatData();
            showStorageMenu = false;
        }
    }

    async function handleClearMedia() {
        if (confirm($t('chatWindow.deleteMediaConfirm'))) {
            await clearMediaOnly();
            showStorageMenu = false;
        }
    }

    $: otherUser = conversation.type === 'dm'
        ? conversation.members.find(m => m.userId !== currentUser.id)
        : null;

    $: conversationName = conversation.type === 'group'
        ? (conversation.name || 'Group')
        : (otherUser?.displayName || otherUser?.username || 'Unknown');

    $: avatarUrl = otherUser
        ? `https://api.dicebear.com/9.x/avataaars/svg?seed=${otherUser.username}`
        : '';

    $: p2pConnected = (() => {
        if (conversation.type === 'dm') {
            const other = conversation.members.find(m => m.userId !== currentUser.id);
            if (!other) return false;
            return chatDataChannels[other.userId]?.readyState === 'open';
        }
        return conversation.members.some(m =>
            m.userId !== currentUser.id &&
            chatDataChannels[m.userId]?.readyState === 'open'
        );
    })();

    $: statusText = (() => {
        if (conversation.type === 'group') {
            const online = conversation.members.filter(m =>
                m.userId !== currentUser.id &&
                chatDataChannels[m.userId]?.readyState === 'open'
            );
            return $t('chatWindow.members', { total: conversation.members.length, online: online.length });
        }
        if (isOnline && p2pConnected) return $t('chatWindow.online');
        if (isOnline) return $t('chatWindow.connecting') || 'Connecting...';
        return $t('chatWindow.offline');
    })();

    $: canSend = (() => {
        if (conversation.type === 'dm') {
            const other = conversation.members.find(m => m.userId !== currentUser.id);
            if (!other) return false;
            const dc = chatDataChannels[other.userId];
            return !!dc && dc.readyState === 'open';
        }
        return conversation.members.some(m => {
            if (m.userId === currentUser.id) return false;
            const dc = chatDataChannels[m.userId];
            return dc && dc.readyState === 'open';
        });
    })();

    // Group messages by date
    $: groupedMessages = (() => {
        const groups: { date: string; messages: ChatMessage[] }[] = [];
        let lastDate = '';
        for (const msg of messages) {
            const date = formatDate(msg.timestamp);
            if (date !== lastDate) {
                groups.push({ date, messages: [msg] });
                lastDate = date;
            } else {
                groups[groups.length - 1].messages.push(msg);
            }
        }
        return groups;
    })();

    afterUpdate(() => {
        if (shouldAutoScroll && messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    });

    function handleScroll() {
        if (!messagesContainer) return;
        const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
        shouldAutoScroll = scrollHeight - scrollTop - clientHeight < 100;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
        dispatch('typing', true);
    }

    function send() {
        const text = input.trim();
        if (!text || !canSend) return;
        dispatch('send', { content: text, type: 'text' });
        input = '';
    }

    function handleFileChange(e: Event) {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
            dispatch('file', file);
            target.value = '';
        }
    }

    function handleVoice(e: CustomEvent) {
        dispatch('send', { content: $t('chatWindow.voiceSent'), type: 'voice', metadata: e.detail });
    }

    function formatDate(ts: number): string {
        const d = new Date(ts);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) return $t('chatWindow.today');
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return $t('chatWindow.yesterday');
        return d.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
    }
</script>

<svelte:window on:click={() => { if (showStorageMenu) showStorageMenu = false; }} />

<div class="chat-window">
    <!-- Header -->
    <div class="chat-header">
        <button class="back-btn" on:click={() => dispatch('back')} title={$t('chatWindow.back')}>
            <i class="fas fa-arrow-left"></i>
        </button>
        <div class="header-avatar">
            {#if conversation.type === 'group'}
                <div class="group-icon"><i class="fas fa-users"></i></div>
            {:else}
                <img src={avatarUrl} alt="" />
            {/if}
        </div>
        <div class="header-info">
            <span class="header-name">{conversationName}</span>
            <span class="header-status" class:online={isOnline}>{statusText}</span>
        </div>
        {#if isTurnRelayed}
            <div class="turn-badge" title={$t('chatWindow.turnTooltip')}>
                <i class="fas fa-server"></i> {$t('chatWindow.turnBadge')}
                <span class="turn-warn">{$t('chatWindow.turnWarn')}</span>
            </div>
        {/if}
        <div class="header-storage">
            <button class="storage-btn" on:click|stopPropagation={() => showStorageMenu = !showStorageMenu} title={$t('chatWindow.chatStorage')}>
                <i class="fas fa-database"></i>
                <span class="storage-size">{formatBytes($chatStorageSize)}</span>
            </button>
            {#if showStorageMenu}
                <div class="storage-menu">
                    <div class="storage-menu-header">
                        <i class="fas fa-hdd"></i> {$t('chatWindow.storage')}: {formatBytes($chatStorageSize)}
                    </div>
                    <button class="storage-menu-item" on:click={handleClearMedia}>
                        <i class="fas fa-photo-video"></i> {$t('chatWindow.deleteMedia')}
                        <span class="menu-hint">{$t('chatWindow.mediaHint')}</span>
                    </button>
                    <button class="storage-menu-item danger" on:click={handleClearAll}>
                        <i class="fas fa-trash-alt"></i> {$t('chatWindow.deleteAll')}
                        <span class="menu-hint">{$t('chatWindow.deleteAllHint')}</span>
                    </button>
                </div>
            {/if}
        </div>
    </div>

    <!-- Messages -->
    <div class="messages-area" bind:this={messagesContainer} on:scroll={handleScroll}>
        {#if messages.length === 0}
            <div class="no-messages">
                <i class="fas fa-lock"></i>
                <p>{$t('chatWindow.p2pNotice')}</p>
                <p>{$t('chatWindow.startChat')}</p>
            </div>
        {/if}

        {#each groupedMessages as group}
            <div class="date-divider"><span>{group.date}</span></div>
            {#each group.messages as msg (msg.id)}
                <MessageBubble
                    message={msg}
                    isOwn={msg.senderId === currentUser.id}
                    showSender={conversation.type === 'group'}
                    on:acceptFile
                    on:rejectFile
                />
            {/each}
        {/each}

        {#if typingUsers.length > 0}
            <div class="typing-indicator">
                <div class="typing-dots"><span></span><span></span><span></span></div>
                <span>{$t('chatWindow.typing', { name: typingUsers.map(u => u.username).join(', ') })}</span>
            </div>
        {/if}
    </div>

    <!-- Input -->
    <div class="input-area">
        {#if !canSend}
            <div class="offline-banner">
                <i class="fas fa-wifi" style="opacity: 0.5;"></i>
                {#if conversation.type === 'dm'}
                    {$t('chatWindow.offlineDm', { name: otherUser?.displayName || otherUser?.username || '' })}
                {:else}
                    {$t('chatWindow.offlineGroup')}
                {/if}
            </div>
        {/if}
        {#if canSend}
            <button class="attach-btn" on:click={() => fileInput.click()} title={$t('chatWindow.attach')}>
                <i class="fas fa-paperclip"></i>
            </button>
            <input type="file" bind:this={fileInput} on:change={handleFileChange} style="display:none;" />

            <div class="text-input-wrap">
                <textarea
                    bind:value={input}
                    on:keydown={handleKeydown}
                    placeholder={$t('chatWindow.placeholder')}
                    rows="1"
                ></textarea>
            </div>

            {#if input.trim()}
                <button class="send-btn" on:click={send} title={$t('chatWindow.send')}>
                    <i class="fas fa-paper-plane"></i>
                </button>
            {:else}
                <VoiceRecorder on:recorded={handleVoice} />
            {/if}
        {/if}
    </div>
</div>

<style>
    .chat-window { display: flex; flex-direction: column; height: 100%; min-height: 0; }

    /* Header */
    .chat-header {
        display: flex; align-items: center; gap: 12px;
        padding: 12px 16px; background: #2b2d31; border-bottom: 1px solid #1f2023; flex-shrink: 0;
    }
    .back-btn { display: none; background: none; border: none; color: #b5bac1; cursor: pointer; font-size: 16px; padding: 4px; }
    .header-avatar img { width: 36px; height: 36px; border-radius: 50%; background: #2f3136; }
    .group-icon {
        width: 36px; height: 36px; border-radius: 50%; background: #5865f2;
        display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;
    }
    .header-info { display: flex; flex-direction: column; }
    .header-name { font-weight: 600; color: #fff; font-size: 15px; }
    .header-status { font-size: 12px; color: #747f8d; }
    .header-status.online { color: #23a559; }

    .turn-badge {
        display: flex; align-items: center; gap: 5px;
        padding: 4px 10px; border-radius: 12px;
        font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
        background: rgba(250, 166, 26, 0.15); border: 1px solid rgba(250, 166, 26, 0.35);
        color: #faa61a; white-space: nowrap; flex-shrink: 0; cursor: help;
    }
    .turn-badge i { font-size: 10px; }
    .turn-warn { font-size: 9px; font-weight: 500; opacity: 0.85; }

    /* Storage */
    .header-storage { margin-left: auto; position: relative; }
    .storage-btn {
        background: rgba(255,255,255,0.06); border: none; color: #949ba4; cursor: pointer;
        display: flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 6px;
        font-size: 12px; transition: all 0.2s; white-space: nowrap;
    }
    .storage-btn:hover { color: #dbdee1; background: rgba(255,255,255,0.1); }
    .storage-btn i { font-size: 11px; }
    .storage-size { font-weight: 600; }

    .storage-menu {
        position: absolute; top: 100%; right: 0; margin-top: 6px;
        background: #1e1f22; border: 1px solid #2f3136; border-radius: 8px;
        width: 220px; z-index: 100; box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        overflow: hidden;
    }
    .storage-menu-header {
        padding: 10px 14px; font-size: 12px; color: #949ba4; font-weight: 600;
        border-bottom: 1px solid #2f3136; display: flex; align-items: center; gap: 8px;
    }
    .storage-menu-item {
        display: flex; flex-direction: column; align-items: flex-start;
        width: 100%; padding: 10px 14px; background: none; border: none;
        color: #dbdee1; font-size: 13px; cursor: pointer; text-align: left;
        transition: background 0.15s; gap: 2px;
    }
    .storage-menu-item:hover { background: rgba(255,255,255,0.06); }
    .storage-menu-item.danger { color: #ed4245; }
    .storage-menu-item.danger:hover { background: rgba(237,66,69,0.1); }
    .storage-menu-item i { margin-right: 6px; width: 14px; text-align: center; }
    .menu-hint { font-size: 11px; color: #72767d; }

    /* Messages */
    .messages-area { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 4px; }
    .no-messages {
        flex: 1; display: flex; flex-direction: column; align-items: center;
        justify-content: center; color: #72767d; text-align: center;
    }
    .no-messages i { font-size: 32px; margin-bottom: 12px; opacity: 0.4; }
    .no-messages p { margin: 4px 0; font-size: 13px; }

    .date-divider { display: flex; align-items: center; justify-content: center; margin: 16px 0 8px; }
    .date-divider span { background: #313338; color: #949ba4; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 8px; }

    /* Typing */
    .typing-indicator { display: flex; align-items: center; gap: 8px; padding: 4px 8px; font-size: 12px; color: #949ba4; }
    .typing-dots { display: flex; gap: 3px; }
    .typing-dots span { width: 6px; height: 6px; border-radius: 50%; background: #949ba4; animation: typingBounce 1.4s infinite; }
    .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typingBounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-4px); }
    }

    /* Input */
    .input-area {
        display: flex; align-items: flex-end; gap: 8px;
        padding: 12px 16px; background: #2b2d31; border-top: 1px solid #1f2023;
        flex-shrink: 0;
    }
    .offline-banner {
        flex: 1; text-align: center; color: #949ba4; font-size: 13px;
        padding: 8px; background: #1e1f22; border-radius: 8px;
        display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .attach-btn, .send-btn {
        background: none; border: none; color: #b5bac1; cursor: pointer;
        font-size: 18px; padding: 8px; border-radius: 4px; transition: all 0.2s; flex-shrink: 0;
    }
    .attach-btn:hover, .send-btn:hover { color: #fff; background: #35373c; }
    .send-btn { color: #5865f2; }
    .send-btn:hover { color: #7289da; }

    .text-input-wrap { flex: 1; }
    .text-input-wrap textarea {
        width: 100%; padding: 10px 12px; background: #383a40; border: none;
        border-radius: 8px; color: #dbdee1; font-size: 14px; font-family: inherit;
        resize: none; outline: none; min-height: 20px; max-height: 120px; box-sizing: border-box;
    }
    .text-input-wrap textarea::placeholder { color: #72767d; }

    @media (max-width: 768px) {
        .back-btn { display: block; }
        .input-area { padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)); }
    }
</style>
