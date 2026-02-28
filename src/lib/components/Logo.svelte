<script>
  export let size = 40;
  export let showText = false;
  export let textSize = 'md';
</script>

<div class="logo-brand" class:with-text={showText}>
  <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#7289da;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#5865f2;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#5865f2;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#4752c4;stop-opacity:1" />
      </linearGradient>
    </defs>
    <circle cx="148" cy="256" r="72" fill="url(#lg1)" opacity="0.9"/>
    <circle cx="364" cy="256" r="72" fill="url(#lg2)" opacity="0.9"/>
    <path d="M190 210 Q256 120 322 210" stroke="#7289da" stroke-width="16" fill="none" stroke-linecap="round" opacity="0.7"/>
    <path d="M190 302 Q256 392 322 302" stroke="#4752c4" stroke-width="16" fill="none" stroke-linecap="round" opacity="0.7"/>
    <rect x="230" y="244" width="52" height="40" rx="6" fill="#ffffff"/>
    <path d="M240 244 V230 Q240 214 256 214 Q272 214 272 230 V244" stroke="#ffffff" stroke-width="8" fill="none" stroke-linecap="round"/>
    <circle cx="256" cy="260" r="6" fill="#5865f2"/>
    <rect x="253" y="260" width="6" height="10" rx="2" fill="#5865f2"/>
    <path d="M108 220 Q92 256 108 292" stroke="#7289da" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.5"/>
    <path d="M88 200 Q64 256 88 312" stroke="#7289da" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.3"/>
    <path d="M404 220 Q420 256 404 292" stroke="#4752c4" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.5"/>
    <path d="M424 200 Q448 256 424 312" stroke="#4752c4" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.3"/>
  </svg>
  {#if showText}
    <span class="logo-text" class:text-sm={textSize === 'sm'} class:text-md={textSize === 'md'} class:text-lg={textSize === 'lg'} class:text-xl={textSize === 'xl'}>p2ptalk</span>
  {/if}
</div>

<style>
  .logo-brand {
    display: inline-flex;
    align-items: center;
    gap: 0;
  }
  .logo-brand.with-text {
    gap: 10px;
  }
  .logo-text {
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.5px;
    user-select: none;
  }
  .text-sm { font-size: 14px; }
  .text-md { font-size: 18px; }
  .text-lg { font-size: 24px; }
  .text-xl { font-size: 32px; }
</style>
