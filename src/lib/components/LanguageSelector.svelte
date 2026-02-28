<script lang="ts">
  import { locale, SUPPORTED_LOCALES } from '$lib/i18n';

  let open = false;

  function selectLocale(code: string) {
    $locale = code as typeof $locale;
    open = false;
  }

  $: currentLocale = SUPPORTED_LOCALES.find(l => l.code === $locale);
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="lang-selector" class:open>
  <button class="lang-btn" on:click={() => open = !open} title="Language">
    <span class="flag">{currentLocale?.flag}</span>
    <span class="lang-code">{currentLocale?.code.toUpperCase()}</span>
    <i class="fas fa-chevron-down chevron"></i>
  </button>

  {#if open}
    <div class="lang-backdrop" on:click={() => open = false}></div>
    <div class="lang-dropdown">
      {#each SUPPORTED_LOCALES as loc}
        <button
          class="lang-option"
          class:active={loc.code === $locale}
          on:click={() => selectLocale(loc.code)}
        >
          <span class="flag">{loc.flag}</span>
          <span class="label">{loc.label}</span>
          {#if loc.code === $locale}
            <i class="fas fa-check check-icon"></i>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .lang-selector {
    position: relative;
    display: flex;
    align-items: center;
  }

  .lang-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    color: #b5bac1;
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    transition: all 0.2s;
  }
  .lang-btn:hover {
    background: rgba(255,255,255,0.1);
    color: #fff;
  }

  .flag { font-size: 14px; line-height: 1; }
  .lang-code { font-size: 11px; text-transform: uppercase; }
  .chevron { font-size: 8px; transition: transform 0.2s; margin-left: 2px; }
  .open .chevron { transform: rotate(180deg); }

  .lang-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
  }

  .lang-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: #2b2d31;
    border: 1px solid #1f2023;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    min-width: 180px;
    max-height: 320px;
    overflow-y: auto;
    z-index: 1001;
    padding: 4px;
  }

  .lang-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    background: none;
    border: none;
    color: #b5bac1;
    cursor: pointer;
    border-radius: 4px;
    font-size: 13px;
    transition: all 0.15s;
  }
  .lang-option:hover {
    background: rgba(255,255,255,0.06);
    color: #fff;
  }
  .lang-option.active {
    background: rgba(88, 101, 242, 0.15);
    color: #5865f2;
  }
  .lang-option .flag { font-size: 16px; }
  .lang-option .label { flex: 1; text-align: left; }
  .check-icon { font-size: 11px; color: #5865f2; }

  .lang-dropdown::-webkit-scrollbar { width: 4px; }
  .lang-dropdown::-webkit-scrollbar-track { background: transparent; }
  .lang-dropdown::-webkit-scrollbar-thumb { background: #4e5058; border-radius: 2px; }
</style>
