<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { io } from 'socket.io-client';
  import { enhance } from '$app/forms';

  // ─── Stores ────────────────────────────────────────────
  import {
    socket, userData,
    activeTab, showCreateRoomModal, showSettings, showInviteModal, showMobileMenu,
    friendsList, friendRequests, onlineFriends, addFriendUsername, friendSearch,
    inCall, incomingCall, activeGroups,
    localStream, localScreenStream, remoteStreams, activeSpeakerId,
    isAudioMuted, isVideoMuted, isScreenSharing,
    e2eeActive, messages, messageInput,
    audioInputs, audioOutputs, videoInputs,
    selectedAudioInput, selectedAudioOutput, selectedVideoInput,
    noiseCancellation, echoCancellation, autoGainControl,
    turnRelayCallPeers, peerUsernames
  } from '$lib/stores/callState';

  // ─── Actions ───────────────────────────────────────────
  import {
    joinRoom, hangUp, answerCall, rejectCall,
    sendMessage, toggleAudio, toggleVideo,
    shareScreen, stopScreenShare, loadDevices, applySettings,
    deleteRoom, removeFriend, startCall,
    handleCreateRoom, handleInvite, isVisible
  } from '$lib/callActions';
  import { handleFileSelect, requestFile } from '$lib/webrtc';
  import { initSocketEvents } from '$lib/socketEvents';
  import { cleanupAllChatPeers } from '$lib/chatWebrtc';
  import { conversations, activeConversationId, unreadCounts, turnRelayChatPeers } from '$lib/stores/chatStore';
  import { initChatPersistence } from '$lib/chatPersistence';

  // ─── Components ────────────────────────────────────────
  import Sidebar from '$lib/components/dashboard/Sidebar.svelte';
  import ChannelList from '$lib/components/dashboard/ChannelList.svelte';
  import CallInterface from '$lib/components/call/CallInterface.svelte';
  import CreateRoomModal from '$lib/components/modals/CreateRoomModal.svelte';
  import IncomingCallModal from '$lib/components/modals/IncomingCallModal.svelte';
  import SettingsModal from '$lib/components/modals/SettingsModal.svelte';
  import InviteModal from '$lib/components/modals/InviteModal.svelte';
  import ChatView from '$lib/components/chat/ChatView.svelte';
  import LanguageSelector from '$lib/components/LanguageSelector.svelte';
  import Logo from '$lib/components/Logo.svelte';
  import { t } from '$lib/i18n';

  // ─── Page Data ─────────────────────────────────────────
  export let data;
  export let form;

  // Derived local values for template (stores use $-prefix auto-subscribe)
  $: filteredFriends = $friendsList.filter((f: any) =>
      f.username.toLowerCase().includes($friendSearch.toLowerCase())
  );

  $: totalUnread = Object.values($unreadCounts).reduce((a, b) => a + b, 0);

  $: turnRelayTotal = $turnRelayCallPeers.size + $turnRelayChatPeers.size;
  $: isTurnRelayed = turnRelayTotal > 0;

  function openChat(friendId: string) {
      $socket.emit('get-or-create-dm', { friendId }, (response: any) => {
          if (response?.conversation) {
              conversations.update(c => {
                  if (c.find(x => x.id === response.conversation.id)) return c;
                  return [...c, response.conversation];
              });
              activeConversationId.set(response.conversation.id);
              unreadCounts.update(uc => ({ ...uc, [response.conversation.id]: 0 }));
              $activeTab = 'chats';
          }
      });
  }

  let cleanupPersistence: (() => void) | null = null;

  // ─── Lifecycle ─────────────────────────────────────────
  onMount(() => {
    // Seed stores from server data
    userData.set(data.user);
    friendsList.set(data.friends || []);
    friendRequests.set(data.friendRequests || []);
    activeGroups.set(data.rooms || []);

    // Create socket & register events
    const sock = io();
    socket.set(sock);
    initSocketEvents(sock, data);

    // Initialize conversations from server data
    conversations.set(data.conversations || []);

    // Load persisted chat messages & start auto-save
    cleanupPersistence = initChatPersistence();

    // Auto-join room if redirected from /room/[id]
    const autoJoinId = sessionStorage.getItem('autoJoinRoom');
    if (autoJoinId) {
        sessionStorage.removeItem('autoJoinRoom');
        // Wait a tick for socket to be ready, then join
        setTimeout(() => {
            $activeTab = 'rooms';
            joinRoom(autoJoinId);
        }, 500);
    }
  });

  onDestroy(() => {
    if (cleanupPersistence) cleanupPersistence();
    if ($socket) $socket.disconnect();
    if ($localStream) $localStream.getTracks().forEach(t => t.stop());
    if ($localScreenStream) $localScreenStream.getTracks().forEach(t => t.stop());
    cleanupAllChatPeers();
  });

  // ─── Thin Event Wrappers (CustomEvent → module functions) ──
  function onCreateRoom(e: CustomEvent) {
    const { name, scope, allowTurn } = e.detail;
    handleCreateRoom(name, scope, allowTurn);
  }
  function onInvite(e: CustomEvent) {
    handleInvite(e.detail);
  }
  function onFileSelect(e: CustomEvent) {
    handleFileSelect(e.detail);
  }
  function onRequestFile(e: CustomEvent) {
    requestFile(e.detail);
  }
</script>

<div class="app-container">
    <!-- HEADER — always visible -->
    <header>
         <button class="friends-toggle-btn" on:click={() => $showMobileMenu = !$showMobileMenu} title={$t('header.friends')}>
             <i class="fas fa-user-friends"></i>
             {#if $friendRequests.length > 0}
                 <span class="friends-badge">{$friendRequests.length}</span>
             {/if}
         </button>
        <div class="logo"><Logo size={24} showText textSize="sm" /></div>
        {#if isTurnRelayed}
            <div class="header-turn-badge" title={$t('header.turnTooltip')}>
                <i class="fas fa-server"></i>
                <span>{$t('header.turnActive')}</span>
                <span class="turn-peer-count">{turnRelayTotal}</span>
            </div>
        {/if}
        <div class="user-info">
               <img 
                    src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${data.user.username}`} 
                    alt="Me" 
                    class="avatar-small" 
                    style="width: 32px; height: 32px; border-radius: 50%; margin-right: 8px; border: 2px solid #5865f2; background: #2f3136;" 
               />
               <div style="display: flex; flex-direction: column; align-items: flex-end; margin-right: 8px;">
                   <span style="font-weight: 600;">{data.user.displayName || data.user.username}</span>
                   <span style="font-size: 10px; color: #b9bbbe;">@{data.user.username}</span>
               </div>
               <LanguageSelector />
               <button class="icon-btn" on:click={() => { $showSettings = true; loadDevices(); }} title={$t('header.settings')}>
                   <i class="fas fa-cog"></i>
               </button>
               {#if !$inCall}
                   <form action="/logout" method="POST" use:enhance style="display:inline;">
                       <button class="logout-btn"><i class="fas fa-sign-out-alt"></i> {$t('header.logout')}</button>
                   </form>
               {/if}
        </div>
    </header>

    <!-- FRIENDS SIDEBAR — always available -->
    {#if $showMobileMenu}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="sidebar-backdrop" on:click={() => $showMobileMenu = false}></div>
    {/if}
    
    <Sidebar 
        friendRequests={$friendRequests}
        filteredFriends={filteredFriends}
        onlineFriends={$onlineFriends}
        bind:friendSearch={$friendSearch}
        bind:addFriendUsername={$addFriendUsername}
        bind:showMobileMenu={$showMobileMenu}
        form={form}
        socket={$socket}
        userId={data.user.id}
        onStartCall={startCall}
        onRemoveFriend={removeFriend}
        onOpenChat={openChat}
    />

    {#if !$inCall}
        <!-- DASHBOARD LAYOUT -->
        <main class="dashboard-grid">
            <section class="content-area" class:chat-active={$activeTab === 'chats'}>
                <div class="center-tabs">
                    <button 
                        class="tab-link" 
                        class:active={$activeTab === 'chats'} 
                        on:click={() => $activeTab = 'chats'}>
                        {$t('tabs.chats')}
                        {#if totalUnread > 0}
                            <span class="badge count-badge">{totalUnread}</span>
                        {/if}
                    </button>
                    <button 
                        class="tab-link" 
                        class:active={$activeTab === 'rooms'} 
                        on:click={() => $activeTab = 'rooms'}>
                        {$t('tabs.liveChannels')} 
                        <span class="badge count-badge">{$activeGroups.filter(g => isVisible(g, $friendsList)).length}</span>
                    </button>
                </div>

                {#if $activeTab === 'chats'}
                    <ChatView socket={$socket} user={data.user} />
                {:else}
                    <ChannelList 
                        groups={$activeGroups.filter(g => isVisible(g, $friendsList))}
                        user={data.user}
                        friendIds={$friendsList.map((f) => f.id)}
                        onJoinRoom={joinRoom}
                        onDeleteRoom={deleteRoom}
                        onCreateRoom={() => $showCreateRoomModal = true}
                    />
                {/if}
            </section>
        </main>

        <CreateRoomModal 
            bind:show={$showCreateRoomModal}
            on:create={onCreateRoom}
            on:close={() => $showCreateRoomModal = false}
        />

        <IncomingCallModal 
            incomingCall={$incomingCall}
            on:accept={answerCall}
            on:reject={rejectCall}
        />

    {:else}
        <!-- CALL INTERFACE -->
        <CallInterface
            localStream={$localStream}
            localScreenStream={$localScreenStream}
            remoteStreams={$remoteStreams}
            activeSpeakerId={$activeSpeakerId}
            isAudioMuted={$isAudioMuted}
            isVideoMuted={$isVideoMuted}
            isScreenSharing={$isScreenSharing}
            e2eeActive={$e2eeActive}
            turnRelayCallPeers={$turnRelayCallPeers}
            peerUsernames={$peerUsernames}
            messages={$messages}
            bind:messageInput={$messageInput}
            currentUsername={data.user.username}
            
            on:toggleVideo={toggleVideo}
            on:toggleAudio={toggleAudio}
            on:shareScreen={shareScreen}
            on:stopScreenShare={stopScreenShare}
            on:fileSelect={onFileSelect}
            on:sendMessage={sendMessage}
            on:requestFile={onRequestFile}
            on:openSettings={() => { $showSettings = true; loadDevices(); }}
            on:openInvite={() => $showInviteModal = true}
            on:hangUp={hangUp}
        >
             {#if $showInviteModal}
                 <InviteModal 
                    friends={$friendsList} 
                    onlineFriends={$onlineFriends}
                    on:close={() => $showInviteModal = false}
                    on:invite={onInvite}
                 />
             {/if}
        </CallInterface>
    {/if}

    {#if $showSettings}
        <SettingsModal 
            user={data.user}
            bind:selectedAudioInput={$selectedAudioInput}
            bind:selectedAudioOutput={$selectedAudioOutput}
            bind:selectedVideoInput={$selectedVideoInput}
            bind:isVideoMuted={$isVideoMuted}
            bind:noiseCancellation={$noiseCancellation}
            bind:echoCancellation={$echoCancellation}
            bind:autoGainControl={$autoGainControl}
            audioInputs={$audioInputs}
            audioOutputs={$audioOutputs}
            videoInputs={$videoInputs}
            on:close={() => $showSettings = false}
            on:save={applySettings}
        />
    {/if}
</div>

<style>
    :global(body) { margin: 0; font-family: 'gg sans', 'Helvetica Neue', Arial, sans-serif; background-color: #313338; color: #dbdee1; overflow: hidden; height: 100vh; }
    .app-container { display: flex; flex-direction: column; height: 100vh; }

    header { height: 48px; background: #2b2d31; display: flex; align-items: center; padding: 0 16px; border-bottom: 1px solid #1f2023; justify-content: space-between; }
    .logo { font-weight: 800; font-size: 16px; color: #fff; margin-right: 0; }
    header .user-info { display: flex; align-items: center; margin-left: auto; justify-content: flex-end; gap: 8px; flex: 0 0 auto; min-width: auto; overflow: visible; }
    .logout-btn { background: none; border: 1px solid #ed4245; color: #ed4245; padding: 4px 12px; border-radius: 4px; cursor: pointer; transition: 0.2s; }
    .logout-btn:hover { background: #da373c; color: #fff; }

    /* TURN relay header badge */
    .header-turn-badge {
        display: flex; align-items: center; gap: 6px;
        background: rgba(250, 166, 26, 0.15); border: 1px solid rgba(250, 166, 26, 0.4);
        color: #faa61a; padding: 4px 10px; border-radius: 12px;
        font-size: 11px; font-weight: 600; cursor: help;
        animation: turn-pulse 2s ease-in-out infinite;
        margin-left: 12px;
    }
    .header-turn-badge i { font-size: 10px; }
    .turn-peer-count {
        background: rgba(250, 166, 26, 0.3); padding: 1px 6px; border-radius: 8px;
        font-size: 10px; font-weight: 700; min-width: 14px; text-align: center;
    }
    @keyframes turn-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
    }

    .dashboard-grid { display: grid; grid-template-columns: 1fr; height: calc(100vh - 48px); position: relative; }
    .content-area { padding: 24px; background: #313338; overflow-y: auto; height: 100%; box-sizing: border-box; }
    .content-area.chat-active { padding: 0; overflow: hidden; display: flex; flex-direction: column; }

    /* --- CENTER TABS --- */
    .center-tabs {
        display: flex;
        border-bottom: 1px solid #2f3136;
        margin-bottom: 24px;
        position: sticky;
        top: 0;
        background: #313338; 
        z-index: 10;
        padding-top: 8px;
        flex-shrink: 0;
    }
    .chat-active .center-tabs { margin-bottom: 0; padding: 8px 24px 0; }

    .tab-link {
        flex: 1;
        background: none;
        border: none;
        padding: 16px 0;
        color: #949ba4;
        cursor: pointer;
        font-weight: 600;
        font-size: 16px;
        transition: background 0.2s, color 0.2s;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }

    .tab-link:hover {
        background-color: rgba(255,255,255,0.05);
        color: #dbdee1;
    }

    .tab-link.active {
        color: #fff;
    }

    .tab-link.active::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background-color: #5865f2;
        border-radius: 3px 3px 0 0;
    }

    .count-badge {
        background: #ed4245;
        color: white;
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 700;
        line-height: normal;
    }
    
    .icon-btn { background: none; border: none; color: #b5bac1; cursor: pointer; font-size: 18px; padding: 8px; margin-left: 8px; transition: color 0.2s; }
    .icon-btn:hover { color: #fff; }

    /* Friends sidebar toggle */
    .friends-toggle-btn {
        background: none; border: none; color: #b5bac1; cursor: pointer;
        font-size: 18px; padding: 6px 10px; margin-right: 12px;
        border-radius: 6px; transition: all 0.2s; position: relative;
        display: flex; align-items: center; gap: 4px;
    }
    .friends-toggle-btn:hover { color: #fff; background: rgba(255,255,255,0.08); }
    .friends-badge {
        position: absolute; top: -2px; right: -4px;
        background: #ed4245; color: #fff; font-size: 10px; font-weight: 700;
        min-width: 16px; height: 16px; border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        padding: 0 4px; box-sizing: border-box;
    }

    /* Sidebar backdrop (all screen sizes) */
    .sidebar-backdrop {
        position: fixed; top: 48px; bottom: 0; left: 0; right: 0;
        background: rgba(0,0,0,0.5); z-index: 999;
    }

    @media (max-width: 768px) {
        .content-area { padding: 16px; }
        .content-area.chat-active { padding: 0; }
        header { padding: 0 12px; }
        .logo { font-size: 14px; }
    }
</style>
