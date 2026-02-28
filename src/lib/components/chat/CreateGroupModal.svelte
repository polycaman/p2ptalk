<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { t } from '$lib/i18n';
    export let friends: any[] = [];
    export let onlineFriends: Record<string, boolean> = {};

    const dispatch = createEventDispatcher();

    let name = '';
    let description = '';
    let selectedMembers: Set<string> = new Set();

    function toggleMember(id: string) {
        if (selectedMembers.has(id)) { selectedMembers.delete(id); }
        else { selectedMembers.add(id); }
        selectedMembers = selectedMembers;
    }

    function handleCreate() {
        if (!name.trim() || selectedMembers.size === 0) return;
        dispatch('create', {
            name: name.trim(),
            description: description.trim() || null,
            memberIds: [...selectedMembers]
        });
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-overlay" on:click={() => dispatch('close')}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="modal" on:click|stopPropagation>
        <div class="modal-header">
            <h2>{$t('groupChat.title')}</h2>
            <button class="close-btn" on:click={() => dispatch('close')}><i class="fas fa-times"></i></button>
        </div>

        <div class="modal-body">
            <div class="form-group">
                <label for="group-name">{$t('groupChat.name')}</label>
                <input id="group-name" type="text" bind:value={name} placeholder={$t('groupChat.namePlaceholder')} />
            </div>
            <div class="form-group">
                <label for="group-desc">{$t('groupChat.description')}</label>
                <input id="group-desc" type="text" bind:value={description} placeholder={$t('groupChat.descPlaceholder')} />
            </div>

            <div class="form-group">
                <label>{$t('groupChat.addMembers', { n: selectedMembers.size })}</label>
                <div class="members-list">
                    {#each friends as friend}
                        <!-- svelte-ignore a11y-click-events-have-key-events -->
                        <!-- svelte-ignore a11y-no-static-element-interactions -->
                        <div class="member-item" class:selected={selectedMembers.has(friend.id)} on:click={() => toggleMember(friend.id)}>
                            <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${friend.username}`} alt={friend.username} class="member-avatar" />
                            <div class="member-info">
                                <span class="member-name">{friend.displayName || friend.username}</span>
                                <span class="member-status" class:online={onlineFriends[friend.id]}>
                                    {onlineFriends[friend.id] ? $t('groupChat.online') : $t('groupChat.offline')}
                                </span>
                            </div>
                            <div class="checkbox" class:checked={selectedMembers.has(friend.id)}>
                                {#if selectedMembers.has(friend.id)}<i class="fas fa-check"></i>{/if}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        </div>

        <div class="modal-footer">
            <button class="cancel-btn" on:click={() => dispatch('close')}>{$t('groupChat.cancel')}</button>
            <button class="create-btn" on:click={handleCreate} disabled={!name.trim() || selectedMembers.size === 0}>{$t('groupChat.submit')}</button>
        </div>
    </div>
</div>

<style>
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999; }
    .modal { background: #313338; border-radius: 8px; width: 440px; max-width: 90vw; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #1f2023; }
    .modal-header h2 { margin: 0; font-size: 18px; color: #f2f3f5; }
    .close-btn { background: none; border: none; color: #b5bac1; cursor: pointer; font-size: 18px; padding: 4px; }
    .close-btn:hover { color: #fff; }

    .modal-body { padding: 16px 20px; overflow-y: auto; flex: 1; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #b5bac1; margin-bottom: 8px; }
    .form-group input { width: 100%; padding: 10px; background: #1e1f22; border: 1px solid transparent; border-radius: 4px; color: #dbdee1; font-size: 14px; outline: none; box-sizing: border-box; }
    .form-group input:focus { border-color: #5865f2; }

    .members-list { max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
    .member-item { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 4px; cursor: pointer; transition: background 0.15s; }
    .member-item:hover { background: #35373c; }
    .member-item.selected { background: rgba(88, 101, 242, 0.15); }
    .member-avatar { width: 32px; height: 32px; border-radius: 50%; background: #2f3136; }
    .member-info { flex: 1; }
    .member-name { display: block; font-size: 14px; color: #dbdee1; }
    .member-status { font-size: 11px; color: #72767d; }
    .member-status.online { color: #23a559; }
    .checkbox { width: 22px; height: 22px; border-radius: 4px; border: 2px solid #4e5058; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .checkbox.checked { background: #5865f2; border-color: #5865f2; color: white; font-size: 12px; }

    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 16px 20px; border-top: 1px solid #1f2023; }
    .cancel-btn { background: none; border: none; color: #b5bac1; cursor: pointer; padding: 8px 16px; font-size: 14px; }
    .cancel-btn:hover { text-decoration: underline; }
    .create-btn { background: #5865f2; border: none; color: white; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600; transition: background 0.2s; }
    .create-btn:hover { background: #4752c4; }
    .create-btn:disabled { background: #4752c4; opacity: 0.5; cursor: not-allowed; }
</style>
