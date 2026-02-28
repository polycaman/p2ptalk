<script lang="ts">
  import type { Socket } from 'socket.io-client';
  import { t } from '$lib/i18n';
  import FriendRequests from '../sidebar/FriendRequests.svelte';
  import FriendsList from '../sidebar/FriendsList.svelte';
  import AddFriendForm from '../sidebar/AddFriendForm.svelte';

  export let friendRequests: any[] = [];
  export let filteredFriends: any[] = [];
  export let onlineFriends: Record<string, boolean> = {};
  export let friendSearch = '';
  export let addFriendUsername = '';
  export let showMobileMenu = false;
  export let form: any;
  export let socket: Socket;
  export let userId: string = '';

  export let onStartCall: (id: string, isGroup: boolean) => void;
  export let onRemoveFriend: (id: string, name: string) => void;
  export let onOpenChat: (id: string) => void;
  export let onDiagnostics: (id: string, name: string) => void;
</script>

<aside class="sidebar-nav" class:mobile-active={showMobileMenu}>
    <div class="section-label" style="padding: 16px 16px 8px;">{$t('sidebar.friends')}</div>

    <FriendRequests {friendRequests} {socket} {userId} />

    <FriendsList
        {filteredFriends}
        {onlineFriends}
        bind:friendSearch
        {onStartCall}
        {onRemoveFriend}
        {onOpenChat}
        {onDiagnostics}
    />

    <AddFriendForm bind:addFriendUsername {socket} {userId} {form} />
</aside>

<style>
    .sidebar-nav {
        position: fixed;
        top: 48px;
        bottom: 0;
        left: -320px;
        width: 300px;
        max-width: 85vw;
        z-index: 1000;
        background: #2b2d31;
        padding: 12px 0;
        display: flex;
        flex-direction: column;
        height: auto;
        overflow: hidden;
        transition: left 0.3s ease;
        box-shadow: 2px 0 12px rgba(0,0,0,0.4);
        border-right: 1px solid #1f2023;
    }
    .sidebar-nav.mobile-active { left: 0; }
    .section-label { padding: 8px 16px; font-size: 11px; font-weight: 700; color: #949ba4; text-transform: uppercase; margin-top: 16px; }
</style>
