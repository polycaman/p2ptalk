<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/i18n';

  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  let name = '';
  let scope = 'public';
  let allowTurn = false;

  $: trimmedName = name.trim();

  function handleCreate() {
      if (!trimmedName) return;
      dispatch('create', { name: trimmedName, scope, allowTurn });
      // Reset
      name = '';
      scope = 'public';
      allowTurn = false;
  }

  function handleClose() {
      dispatch('close');
  }
</script>

{#if show}
<div class="modal-overlay">
    <div class="settings-modal" style="width: 320px;">
        <h2>{$t('createRoom.title')}</h2>
        <div class="settings-content">
            <div class="form-group">
                <label for="room-name">{$t('createRoom.name')}</label>
                <input id="room-name" type="text" bind:value={name} placeholder={$t('createRoom.namePlaceholder')} autofocus />
            </div>
            <div class="form-group">
                <label for="room-scope">{$t('createRoom.privacy')}</label>
                <select id="room-scope" bind:value={scope}>
                    <option value="public">{$t('createRoom.publicOption')}</option>
                    <option value="friends">{$t('createRoom.friendsOption')}</option>
                    <option value="private">{$t('createRoom.privateOption')}</option>
                </select>
            </div>
            <div class="form-group toggle-group">
                <label class="toggle-label" for="allow-turn">
                    <input id="allow-turn" type="checkbox" bind:checked={allowTurn} />
                    <span class="toggle-text">
                        <i class="fas fa-server"></i> {$t('createRoom.allowTurn')}
                    </span>
                </label>
                <p class="turn-hint">
                    {$t('createRoom.turnHint')}
                </p>
            </div>
        </div>
        <div class="settings-actions">
            <button class="btn-secondary" on:click={handleClose}>{$t('createRoom.cancel')}</button>
            <button class="btn-primary" on:click={handleCreate} disabled={!trimmedName}>{$t('createRoom.submit')}</button>
        </div>
    </div>
</div>
{/if}

<style>
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 2000; }
    .settings-modal { background: #313338; padding: 24px; border-radius: 8px; width: 400px; max-width: 90%; color: #dbdee1; display: flex; flex-direction: column; gap: 16px; }
    .settings-modal h2 { margin-top: 0; margin-bottom: 16px; text-align: center; color: #f2f3f5; font-size: 20px; }
    .settings-content { display: flex; flex-direction: column; gap: 16px; }
    
    .form-group { display: flex; flex-direction: column; gap: 8px; }
    .form-group label { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #949ba4; }
    .form-group input, .form-group select { padding: 10px; border-radius: 4px; border: none; background: #1e1f22; color: #dbdee1; outline: none; }
    
    .toggle-group { gap: 4px; }
    .toggle-label {
        display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; color: #dbdee1;
    }
    .toggle-label input[type="checkbox"] {
        width: 16px; height: 16px; accent-color: #5865f2; cursor: pointer;
    }
    .toggle-text { display: flex; align-items: center; gap: 6px; }
    .toggle-text i { color: #faa61a; font-size: 12px; }
    .turn-hint { margin: 0; font-size: 11px; color: #72767d; line-height: 1.3; }
    
    .settings-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
    .btn-secondary { background: transparent; color: #fff; border: none; padding: 10px 20px; cursor: pointer; }
    .btn-secondary:hover { text-decoration: underline; }
    .btn-primary { background: #5865f2; color: white; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; transition: 0.2s; }
    .btn-primary:hover:not(:disabled) { background: #4752c4; }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
