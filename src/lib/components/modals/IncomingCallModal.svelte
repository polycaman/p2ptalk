<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/i18n';
  export let incomingCall: any = null;

  const dispatch = createEventDispatcher();
</script>

{#if incomingCall}
<div class="modal-overlay">
    <div class="call-modal">
        <div class="caller-avatar">{incomingCall.name ? incomingCall.name[0] : 'U'}</div>
        <h3>{$t('incoming.title')}</h3>
        <p>{incomingCall.name || $t('incoming.privateCall')}</p>
        <div class="call-actions">
            <button class="btn-decline" on:click={() => dispatch('reject')}><i class="fas fa-clock"></i> {$t('incoming.later')}</button>
            <button class="btn-accept" on:click={() => dispatch('accept')}><i class="fas fa-phone"></i> {$t('incoming.accept')}</button>
        </div>
    </div>
</div>
{/if}

<style>
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 2000; }
    .call-modal { background: #2b2d31; padding: 32px; border-radius: 8px; text-align: center; width: 300px; max-width: 90%; color: #dbdee1; }
    .caller-avatar { width: 80px; height: 80px; background: #5865f2; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 16px; font-weight: bold; }
    
    .call-modal h3 { margin: 8px 0; color: #fff; }
    .call-modal p { margin: 0 0 24px; color: #b9bbbe; }
    
    .call-actions { display: flex; gap: 16px; justify-content: center; margin-top: 24px; }
    .btn-accept { background: #23a559; color: white; border: none; padding: 12px 24px; border-radius: 50px; cursor: pointer; font-weight: bold; font-size: 14px; display: flex; align-items: center; gap: 8px; transition: background 0.2s; }
    .btn-accept:hover { background: #1a7f45; }
    
    .btn-decline { background: #da373c; color: white; border: none; padding: 12px 24px; border-radius: 50px; cursor: pointer; font-weight: bold; font-size: 14px; display: flex; align-items: center; gap: 8px; transition: background 0.2s; }
    .btn-decline:hover { background: #a1282c; }
</style>
