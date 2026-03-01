<script lang="ts">
  import { enhance } from '$app/forms';
  import { t } from '$lib/i18n';
  import LanguageSelector from '$lib/components/LanguageSelector.svelte';
  import Logo from '$lib/components/Logo.svelte';

  export let form: any;

  let loading = false;
  let showPassword = false;
  let showConfirm = false;
  let acceptTerms = false;
</script>

<svelte:head>
  <title>p2ptalk – {$t('register.title')}</title>
</svelte:head>

<div class="auth-page">
  <div class="auth-card">
    <div class="auth-header">
      <div class="logo-icon">
        <Logo size={48} />
      </div>
      <h1>{$t('register.heading')}</h1>
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
        <label for="email">{$t('register.email')}</label>
        <input
          id="email"
          name="email"
          type="email"
          value={form?.email ?? ''}
          class:error={form?.errors?.email}
          placeholder={$t('register.emailPlaceholder')}
          autocomplete="email"
          required
        />
        {#if form?.errors?.email}
          <span class="field-error">{form.errors.email}</span>
        {/if}
      </div>

      <div class="form-group">
        <label for="username">{$t('register.username')}</label>
        <input
          id="username"
          name="username"
          type="text"
          value={form?.username ?? ''}
          class:error={form?.errors?.username}
          placeholder={$t('register.usernamePlaceholder')}
          autocomplete="username"
          required
        />
        {#if form?.errors?.username}
          <span class="field-error">{form.errors.username}</span>
        {/if}
      </div>

      <div class="form-group">
        <label for="password">{$t('register.password')}</label>
        <div class="password-wrapper">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            class:error={form?.errors?.password}
            placeholder={$t('register.passwordPlaceholder')}
            autocomplete="new-password"
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

      <div class="form-group">
        <label for="confirmPassword">{$t('register.confirmPassword')}</label>
        <div class="password-wrapper">
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            class:error={form?.errors?.confirmPassword}
            placeholder={$t('register.confirmPlaceholder')}
            autocomplete="new-password"
            required
          />
          <button type="button" class="toggle-pw" on:click={() => showConfirm = !showConfirm} tabindex="-1">
            {showConfirm ? '🙈' : '👁️'}
          </button>
        </div>
        {#if form?.errors?.confirmPassword}
          <span class="field-error">{form.errors.confirmPassword}</span>
        {/if}
      </div>

      <div class="form-group terms-group">
        <label class="checkbox-label">
          <input type="checkbox" name="acceptTerms" bind:checked={acceptTerms} required />
          <span>
            <a href="/terms" target="_blank" rel="noopener">{$t('register.termsCheckbox')}</a>{$t('register.termsAccept')}
          </span>
        </label>
        {#if form?.errors?.acceptTerms}
          <span class="field-error">{form.errors.acceptTerms}</span>
        {/if}
      </div>

      <button type="submit" class="submit-btn" disabled={loading || !acceptTerms}>
        {#if loading}
          <span class="spinner"></span> {$t('register.creating')}
        {:else}
          {$t('register.submit')}
        {/if}
      </button>
    </form>

    <p class="auth-footer">
      {$t('register.hasAccount')} <a href="/login">{$t('register.login')}</a>
    </p>
    <div class="auth-footer" style="margin-top: 8px; display: flex; justify-content: center; align-items: center; gap: 12px;">
      <a href="/terms" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #b5bac1; text-decoration: none;"><i class="fas fa-file-contract"></i> {$t('register.terms')}</a>
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
    min-height: 100dvh;
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

  .terms-group {
    margin-bottom: 20px;
  }

  .checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
    font-size: 13px;
    color: #b5bac1;
    text-transform: none;
    font-weight: 400;
    letter-spacing: 0;
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    margin-top: 1px;
    accent-color: #5865f2;
    cursor: pointer;
    flex-shrink: 0;
  }

  .checkbox-label a {
    color: #5865f2;
    text-decoration: none;
    font-weight: 500;
  }

  .checkbox-label a:hover {
    text-decoration: underline;
  }

  .terms-link {
    margin-top: 8px;
    font-size: 12px;
  }

  .terms-link a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
</style>
