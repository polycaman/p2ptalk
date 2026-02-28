<script lang="ts">
  import { enhance } from '$app/forms';
  import { t } from '$lib/i18n';
  import LanguageSelector from '$lib/components/LanguageSelector.svelte';
  import Logo from '$lib/components/Logo.svelte';

  export let form: any;

  let loading = false;
  let showPassword = false;
</script>

<svelte:head>
  <title>{$t('login.title')}</title>
</svelte:head>

<div class="auth-page">
  <div class="auth-card">
    <div class="auth-header">
      <div class="logo-icon">
        <Logo size={48} />
      </div>
      <h1>{$t('login.heading')}</h1>
      <p class="subtitle">{$t('login.subtitle')}</p>
    </div>

    {#if form?.errors?.general}
      <div class="alert alert-error">{form.errors.general}</div>
    {/if}

    <form method="POST" use:enhance={() => {
      loading = true;
      return async ({ update }) => {
        loading = false;
        await update();
      };
    }}>
      <div class="form-group">
        <label for="login">{$t('login.emailOrUsername')}</label>
        <input
          id="login"
          name="login"
          type="text"
          value={form?.login ?? ''}
          class:error={form?.errors?.login}
          placeholder={$t('login.emailPlaceholder')}
          autocomplete="username"
          required
        />
        {#if form?.errors?.login}
          <span class="field-error">{form.errors.login}</span>
        {/if}
      </div>

      <div class="form-group">
        <label for="password">{$t('login.password')}</label>
        <div class="password-wrapper">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            class:error={form?.errors?.password}
            placeholder={$t('login.passwordPlaceholder')}
            autocomplete="current-password"
            required
          />
          <button type="button" class="toggle-pw" on:click={() => showPassword = !showPassword} tabindex="-1">
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>
        {#if form?.errors?.password}
          <span class="field-error">{form.errors.password}</span>
        {/if}
      </div>

      <button type="submit" class="submit-btn" disabled={loading}>
        {#if loading}
          <span class="spinner"></span> {$t('login.loggingIn')}
        {:else}
          {$t('login.submit')}
        {/if}
      </button>
    </form>

    <p class="auth-footer">
      {$t('login.noAccount')} <a href="/register">{$t('login.register')}</a>
    </p>
    <div class="auth-footer" style="margin-top: 8px; display: flex; justify-content: center; align-items: center; gap: 12px;">
      <a href="/terms" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #b5bac1; text-decoration: none;"><i class="fas fa-file-contract"></i> {$t('login.terms')}</a>
      <LanguageSelector />
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  }

  .auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #313338;
    background-image: radial-gradient(ellipse at 50% 0%, rgba(88, 101, 242, 0.15) 0%, transparent 60%);
    padding: 20px;
  }

  .auth-card {
    background: #1e1f22;
    border-radius: 8px;
    padding: 32px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }

  .auth-header {
    text-align: center;
    margin-bottom: 24px;
  }

  .logo-icon {
    margin-bottom: 12px;
  }

  .auth-header h1 {
    color: #f2f3f5;
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 4px;
  }

  .subtitle {
    color: #949ba4;
    font-size: 15px;
    margin: 0;
  }

  .alert {
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    margin-bottom: 16px;
  }

  .alert-error {
    background: rgba(237, 66, 69, 0.15);
    border: 1px solid rgba(237, 66, 69, 0.4);
    color: #f38688;
  }

  .form-group {
    margin-bottom: 18px;
  }

  label {
    display: block;
    color: #b5bac1;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    text-transform: uppercase;
  }

  input {
    width: 100%;
    padding: 10px 12px;
    background: #383a40;
    border: 1px solid #1e1f22;
    border-radius: 4px;
    color: #f2f3f5;
    font-size: 15px;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  input::placeholder {
    color: #72767d;
  }

  input:focus {
    border-color: #5865f2;
  }

  input.error {
    border-color: #ed4245;
  }

  .password-wrapper {
    position: relative;
  }

  .password-wrapper input {
    padding-right: 42px;
  }

  .toggle-pw {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    padding: 4px;
    line-height: 1;
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .toggle-pw:hover {
    opacity: 1;
  }

  .field-error {
    display: block;
    color: #f38688;
    font-size: 12px;
    margin-top: 6px;
    font-weight: 500;
  }

  .submit-btn {
    width: 100%;
    padding: 12px;
    margin-top: 8px;
    background: #5865f2;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .submit-btn:hover:not(:disabled) {
    background: #4752c4;
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .auth-footer {
    text-align: center;
    margin-top: 16px;
    color: #949ba4;
    font-size: 14px;
  }

  .auth-footer a {
    color: #5865f2;
    text-decoration: none;
    font-weight: 500;
  }

  .auth-footer a:hover {
    text-decoration: underline;
  }

  @media (max-width: 480px) {
    .auth-card {
      padding: 24px 20px;
    }
  }
</style>
