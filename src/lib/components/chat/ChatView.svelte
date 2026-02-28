<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import ConversationList from './ConversationList.svelte';
    import ChatWindow from './ChatWindow.svelte';
    import CreateGroupModal from './CreateGroupModal.svelte';
    import {
        conversations, activeConversationId, activeConversation,
        activeMessages, sortedConversations, unreadCounts,
        chatSearchQuery, showCreateGroupModal, typingUsers,
        chatDataChannels, turnRelayChatPeers
    } from '$lib/stores/chatStore';
    import { onlineFriends, friendsList } from '$lib/stores/callState';
    import { t } from '$lib/i18n';
    import {
        sendChatMessage, setTyping, offerFile, sendVoiceMessage,
        acceptFileTransfer, rejectFileTransfer
    } from '$lib/chatWebrtc';
    import type { Socket } from 'socket.io-client';

    export let socket: Socket;
    export let user: any;

    let showMobileChat = false;

    function handleSelect(e: CustomEvent) {
        activeConversationId.set(e.detail);
        unreadCounts.update(uc => ({ ...uc, [e.detail]: 0 }));
        showMobileChat = true;
    }

    function handleSend(e: CustomEvent) {
        const { content, type, metadata } = e.detail;
        const convId = $activeConversationId;
        if (!convId) return;
        if (type === 'voice') {
            sendVoiceMessage(convId, metadata.blob, metadata.duration);
        } else {
            sendChatMessage(convId, content, type, metadata);
        }
    }

    function handleFile(e: CustomEvent) {
        const convId = $activeConversationId;
        if (!convId) return;
        offerFile(convId, e.detail);
    }

    function handleAcceptFile(e: CustomEvent) {
        acceptFileTransfer(e.detail.fileId, e.detail.senderId);
    }

    function handleRejectFile(e: CustomEvent) {
        rejectFileTransfer(e.detail.fileId, e.detail.senderId);
    }

    function handleTyping(e: CustomEvent) {
        const convId = $activeConversationId;
        if (!convId) return;
        setTyping(convId, e.detail);
    }

    function handleBack() {
        showMobileChat = false;
    }

    function handleCreateGroup(e: CustomEvent) {
        const { name, description, memberIds } = e.detail;
        socket.emit('create-group-chat', { name, description, memberIds }, (response: any) => {
            if (response?.conversation) {
                conversations.update(c => {
                    if (c.find(x => x.id === response.conversation.id)) return c;
                    return [...c, response.conversation];
                });
                activeConversationId.set(response.conversation.id);
                showMobileChat = true;
            }
        });
        showCreateGroupModal.set(false);
    }

    $: currentTyping = $activeConversationId ? ($typingUsers[$activeConversationId] || []) : [];

    $: isTargetOnline = (() => {
        if (!$activeConversation) return false;
        if ($activeConversation.type === 'dm') {
            const other = $activeConversation.members.find(m => m.userId !== user.id);
            return other ? !!$onlineFriends[other.userId] : false;
        }
        return $activeConversation.members.some(m => m.userId !== user.id && $onlineFriends[m.userId]);
    })();

    $: isTurnRelayed = (() => {
        if (!$activeConversation || $activeConversation.type !== 'dm') return false;
        const other = $activeConversation.members.find(m => m.userId !== user.id);
        return other ? $turnRelayChatPeers.has(other.userId) : false;
    })();
</script>

<div class="chat-view" class:mobile-chat-open={showMobileChat}>
    <div class="chat-sidebar">
        <ConversationList
            conversations={$sortedConversations}
            activeId={$activeConversationId}
            onlineFriends={$onlineFriends}
            unreadCounts={$unreadCounts}
            currentUserId={user.id}
            turnRelayChatPeers={$turnRelayChatPeers}
            bind:searchQuery={$chatSearchQuery}
            on:select={handleSelect}
            on:createGroup={() => $showCreateGroupModal = true}
        />
    </div>

    <div class="chat-main">
        {#if $activeConversation}
            <ChatWindow
                conversation={$activeConversation}
                messages={$activeMessages}
                currentUser={user}
                isOnline={isTargetOnline}
                isTurnRelayed={isTurnRelayed}
                typingUsers={currentTyping}
                chatDataChannels={$chatDataChannels}
                on:send={handleSend}
                on:file={handleFile}
                on:typing={handleTyping}
                on:acceptFile={handleAcceptFile}
                on:rejectFile={handleRejectFile}
                on:back={handleBack}
            />
        {:else}
            <div class="empty-state">
                <i class="fas fa-comments"></i>
                <h3>{$t('chatView.title')}</h3>
                <p>{$t('chatView.emptyHint')}</p>
                <p class="hint">{$t('chatView.p2pHint')}</p>
            </div>
        {/if}
    </div>
</div>

{#if $showCreateGroupModal}
    <CreateGroupModal
        friends={$friendsList}
        onlineFriends={$onlineFriends}
        on:create={handleCreateGroup}
        on:close={() => $showCreateGroupModal = false}
    />
{/if}

<style>
    .chat-view { display: grid; grid-template-columns: 320px 1fr; height: 100%; min-height: 0; overflow: hidden; border-radius: 8px; background: #2b2d31; flex: 1; }
    .chat-sidebar { border-right: 1px solid #1f2023; overflow: hidden; display: flex; flex-direction: column; }
    .chat-main { display: flex; flex-direction: column; overflow: hidden; background: #313338; min-height: 0; }

    .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #949ba4; text-align: center; padding: 32px; }
    .empty-state i { font-size: 64px; margin-bottom: 16px; opacity: 0.3; }
    .empty-state h3 { color: #dbdee1; margin: 0 0 8px; font-size: 20px; }
    .empty-state p { margin: 4px 0; font-size: 14px; max-width: 400px; }
    .empty-state .hint { font-size: 12px; color: #72767d; margin-top: 12px; }

    @media (max-width: 768px) {
        .chat-view { grid-template-columns: 1fr; }
        .chat-sidebar { display: flex; }
        .chat-main { display: none; }
        .chat-view.mobile-chat-open .chat-sidebar { display: none; }
        .chat-view.mobile-chat-open .chat-main { display: flex; }
    }
</style>
