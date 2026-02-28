<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/i18n';
  export let friends: any[] = [];
  export let onlineFriends: Record<string, boolean> = {};

  const dispatch = createEventDispatcher();
  let search = '';
  
  // Track invited status per session
  let invited: Record<string, boolean> = {};

  function handleInvite(friendId: string) {
      invited[friendId] = true;
      dispatch('invite', friendId);
  }
</script>

<div class="modal-overlay" on:click={() => dispatch('close')}>
     <!-- svelte-ignore a11y-click-events-have-key-events -->
     <!-- svelte-ignore a11y-no-static-element-interactions -->
     <div class="settings-modal" style="width: 400px;" on:click|stopPropagation>
         <div class="rooms-header" style="margin-bottom: 16px;">
            <h2 style="font-size: 18px; color: #f2f3f5;">{$t('invite.title')}</h2>
            <button class="icon-btn" on:click={() => dispatch('close')}><i class="fas fa-times"></i></button>
         </div>
         
         <div class="search-bar" style="margin-bottom: 16px;">
            <input 
                type="text" 
                bind:value={search} 
                placeholder={$t('invite.search')} 
                class="friend-search-input"
            />
         </div>

         <div class="settings-content" style="max-height: 300px; overflow-y: auto; padding-right: 4px;">
             {#if friends.length === 0}
                 <p class="empty-state">{$t('invite.noFriends')}</p>
             {:else}
                 {@const filteredInvites = friends.filter(f => f.username.toLowerCase().includes(search.toLowerCase()))}
                 {#if filteredInvites.length === 0}
                    <p class="empty-state">{$t('invite.noMatch')}</p>
                 {:else}
                    <ul class="user-list">
                        {#each filteredInvites as friend}
                            <li class="user-row">
                                <div class="user-info">
                                    <div class="avatar small">
                                        <img 
                                            src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${friend.username}`} 
                                            alt={friend.username}
                                            style="width: 100%; height: 100%; border-radius: 50%;"
                                        />
                                        <div class="status-indicator {onlineFriends[friend.id] ? 'online' : ''}"></div>
                                    </div>
                                    <span class="name" class:online-text={onlineFriends[friend.id]}>{friend.displayName || friend.username}</span>
                                </div>
                                <button 
                                    class="btn-primary" 
                                    class:invited={invited[friend.id]}
                                    style="padding: 4px 12px; font-size: 12px; height: 28px;"
                                    disabled={invited[friend.id]}
                                    on:click={() => handleInvite(friend.id)}
                                >
                                    {#if invited[friend.id]}
                                        <i class="fas fa-check"></i>
                                    {:else}
                                        {$t('invite.submit')}
                                    {/if}
                                </button>
                            </li>
                        {/each}
                    </ul>
                 {/if}
             {/if}
         </div>
     </div>
 </div>

<style>
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 2000; }
    .settings-modal { background: #313338; padding: 24px; border-radius: 8px; width: 400px; max-width: 90%; color: #dbdee1; display: flex; flex-direction: column; gap: 16px; }
    .rooms-header { display: flex; align-items: center; justify-content: space-between; }
    .friend-search-input { background: #1e1f22; border: 1px solid #1e1f22; color: white; padding: 10px 12px; font-size: 14px; border-radius: 4px; outline: none; width: 100%; box-sizing: border-box; }
    .friend-search-input:focus { border-color: #5865f2; }
    
    .status-indicator { width: 14px; height: 14px; border-radius: 50%; background: #747f8d; position: absolute; bottom: -2px; right: -2px; border: 3px solid #2b2d31; }
    .status-indicator.online { background: #23a559; }
    .name { font-size: 15px; font-weight: 500; color: #949ba4; transition: color 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .name.online-text { color: #fff; font-weight: 600; }
    .avatar.small { width: 32px; height: 32px; font-size: 14px; position: relative; flex-shrink: 0; margin-right: 12px; } 

    .user-list { list-style: none; padding: 0 8px; margin: 0; display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto; }
    .user-row { display: flex; align-items: center; justify-content: space-between; padding: 8px; border-radius: 4px; cursor: pointer; transition: background 0.1s; height: 48px; }
    .user-row:hover { background: #35373c; }
    .user-info { display: flex; align-items: center; min-width: 0; flex: 1; overflow: hidden; }
    
    .icon-btn { background: none; border: none; color: #b5bac1; cursor: pointer; font-size: 18px; padding: 8px; margin-left: 8px; transition: color 0.2s; }
    .icon-btn:hover { color: #fff; }
    
    .btn-primary { background: #5865f2; color: white; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; transition: 0.2s; }
    .btn-primary:hover { background: #4752c4; }
    
    .btn-primary.invited { background: #23a559; cursor: default; }
    .btn-primary.invited:hover { background: #23a559; }

    .empty-state { padding: 16px; text-align: center; color: #949ba4; font-size: 13px; font-style: italic; }
</style>
