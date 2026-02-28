<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/i18n';
  import VoiceSettings from '../settings/VoiceSettings.svelte';
  import ProfileSettings from '../settings/ProfileSettings.svelte';

  export let user: any;
  export let audioInputs: MediaDeviceInfo[] = [];
  export let audioOutputs: MediaDeviceInfo[] = [];
  export let videoInputs: MediaDeviceInfo[] = [];
  
  export let selectedAudioInput = '';
  export let selectedAudioOutput = '';
  export let selectedVideoInput = '';
  
  export let isVideoMuted = true;
  export let noiseCancellation = true;
  export let echoCancellation = true;
  export let autoGainControl = true;

  const dispatch = createEventDispatcher();

  let settingsTab: 'voice' | 'profile' = 'voice';
  let voiceSettingsRef: VoiceSettings;

  function handleClose() {
      if (voiceSettingsRef) voiceSettingsRef.stopMicrophoneTest();
      dispatch('close');
  }

  function handleSave() {
      if (voiceSettingsRef) voiceSettingsRef.stopMicrophoneTest();
      dispatch('save');
  }
</script>

<div class="modal-overlay" on:click={handleClose}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="settings-modal" on:click|stopPropagation>
        <h2>{$t('settings.title')}</h2>

        <div class="settings-tabs">
            <button class="tab-link" class:active={settingsTab === 'voice'} on:click={() => settingsTab = 'voice'}>
                {$t('settings.voiceVideo')}
            </button>
            <button class="tab-link" class:active={settingsTab === 'profile'} on:click={() => settingsTab = 'profile'}>
                {$t('settings.profile')}
            </button>
        </div>

        <div class="settings-content">
            {#if settingsTab === 'voice'}
                <VoiceSettings
                    bind:this={voiceSettingsRef}
                    {audioInputs}
                    {audioOutputs}
                    {videoInputs}
                    bind:selectedAudioInput
                    bind:selectedAudioOutput
                    bind:selectedVideoInput
                    bind:isVideoMuted
                    bind:noiseCancellation
                    bind:echoCancellation
                    bind:autoGainControl
                />
            {/if}

            {#if settingsTab === 'profile'}
                <ProfileSettings {user} />
                <div class="settings-actions">
                    <button class="btn-secondary" on:click={handleClose}>{$t('settings.close')}</button>
                </div>
            {/if}
        </div>

        {#if settingsTab === 'voice'}
        <div class="settings-actions">
            <button class="btn-secondary" on:click={handleClose}>{$t('settings.cancel')}</button>
            <button class="btn-primary" on:click={handleSave}>{$t('settings.save')}</button>
        </div>
        {/if}
    </div>
</div>

<style>
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 2000; }
    .settings-modal { background: #313338; padding: 24px; border-radius: 8px; width: 400px; max-width: 90%; color: #dbdee1; display: flex; flex-direction: column; gap: 16px; }
    .settings-modal h2 { margin-top: 0; margin-bottom: 16px; text-align: center; color: white; }
    .settings-tabs { display: flex; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid #1f2023; }
    .tab-link { background: none; border: none; padding: 8px 0; color: #949ba4; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 500; font-size: 14px; flex: 1; transition: 0.2s; }
    .tab-link:hover { color: #dbdee1; }
    .tab-link.active { color: #fff; border-bottom: 2px solid #5865f2; }
    .settings-content { display: flex; flex-direction: column; gap: 16px; }
    .settings-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
    .btn-secondary { background: transparent; color: #fff; border: none; padding: 10px 20px; cursor: pointer; }
    .btn-secondary:hover { text-decoration: underline; }
    .btn-primary { background: #5865f2; color: white; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; transition: 0.2s; }
    .btn-primary:hover { background: #4752c4; }
</style>
