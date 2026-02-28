<script>
  import { t } from '$lib/i18n';
  import LanguageSelector from '$lib/components/LanguageSelector.svelte';
  import Logo from '$lib/components/Logo.svelte';
</script>

<svelte:head>
  <title>{$t('terms.title')}</title>
</svelte:head>

<div class="terms-page">
  <div class="terms-container">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <a href="/" class="back-link"><i class="fas fa-arrow-left"></i> {$t('terms.back')}</a>
      <LanguageSelector />
    </div>

    <div class="terms-header">
      <div class="logo"><Logo size={56} showText textSize="xl" /></div>
      <h1>{$t('terms.heading')}</h1>
      <p class="effective">{$t('terms.effective')}</p>
    </div>

    <div class="terms-body">

      <!-- 1. Giriş -->
      <section>
        <h2>{$t('terms.s1.title')}</h2>
        <p>{@html $t('terms.s1.p1')}</p>
        <p>{$t('terms.s1.p2')}</p>
      </section>

      <!-- 2. Hizmet Tanımı -->
      <section>
        <h2>{$t('terms.s2.title')}</h2>
        <p>{@html $t('terms.s2.p1')}</p>
        <div class="highlight-box">
          <i class="fas fa-exclamation-triangle"></i>
          <div>
            <strong>{$t('terms.s2.important')}</strong> {@html $t('terms.s2.highlight')}
          </div>
        </div>
      </section>

      <!-- 3. Hesap ve Kullanıcı Yükümlülükleri -->
      <section>
        <h2>{$t('terms.s3.title')}</h2>
        <ul>
          {#each $t('terms.s3.items').split('|') as item}
            <li>{item}</li>
          {/each}
        </ul>
      </section>

      <!-- 4. İçerik Sorumluluğu -->
      <section>
        <h2>{$t('terms.s4.title')}</h2>
        <div class="highlight-box critical">
          <i class="fas fa-shield-alt"></i>
          <div>
            <strong>{$t('terms.s4.critical')}</strong> {@html $t('terms.s4.highlight')}
          </div>
        </div>
        <p>{$t('terms.s4.intro')}</p>
        <ul>
          {#each $t('terms.s4.items').split('|') as item}
            <li>{item}</li>
          {/each}
        </ul>
      </section>

      <!-- 5. Yasaklanan Kullanımlar -->
      <section>
        <h2>{$t('terms.s5.title')}</h2>
        <p>{$t('terms.s5.intro')}</p>
        <ul>
          {#each $t('terms.s5.items').split('|') as item}
            <li>{item}</li>
          {/each}
        </ul>
      </section>

      <!-- 6. TURN Relay ve Veri Yönlendirme -->
      <section>
        <h2>{$t('terms.s6.title')}</h2>
        <p>{@html $t('terms.s6.p1')}</p>
        <ul>
          {#each $t('terms.s6.items').split('|') as item}
            <li>{item}</li>
          {/each}
        </ul>
      </section>

      <!-- 7. Gizlilik ve Veri İşleme -->
      <section>
        <h2>{$t('terms.s7.title')}</h2>
        <h3>{$t('terms.s7.sub1')}</h3>
        <p>{$t('terms.s7.sub1intro')}</p>
        <ul>
          {#each $t('terms.s7.sub1items').split('|') as item}
            <li>{item}</li>
          {/each}
        </ul>

        <h3>{$t('terms.s7.sub2')}</h3>
        <ul>
          {#each $t('terms.s7.sub2items').split('|') as item}
            <li>{item}</li>
          {/each}
        </ul>

        <h3>{$t('terms.s7.sub3')}</h3>
        <p>{$t('terms.s7.sub3p')}</p>
      </section>

      <!-- 8. Fikri Mülkiyet -->
      <section>
        <h2>{$t('terms.s8.title')}</h2>
        <p>{$t('terms.s8.p1')}</p>
      </section>

      <!-- 9. Sorumluluk Sınırlaması -->
      <section>
        <h2>{$t('terms.s9.title')}</h2>
        <p>{@html $t('terms.s9.p1')}</p>
        <ul>
          {#each $t('terms.s9.items').split('|') as item}
            <li>{item}</li>
          {/each}
        </ul>
      </section>

      <!-- 10. Hesap Askıya Alma ve Fesih -->
      <section>
        <h2>{$t('terms.s10.title')}</h2>
        <ul>
          {#each $t('terms.s10.items').split('|') as item}
            <li>{item}</li>
          {/each}
        </ul>
      </section>

      <!-- 11. Değişiklikler -->
      <section>
        <h2>{$t('terms.s11.title')}</h2>
        <p>{$t('terms.s11.p1')}</p>
      </section>

      <!-- 12. Uygulanacak Hukuk -->
      <section>
        <h2>{$t('terms.s12.title')}</h2>
        <p>{$t('terms.s12.p1')}</p>
      </section>

      <!-- 13. İletişim -->
      <section>
        <h2>{$t('terms.s13.title')}</h2>
        <p>{$t('terms.s13.p1')}</p>
        <ul>
          <li>{@html $t('terms.s13.web')}</li>
          <li>{@html $t('terms.s13.email')}</li>
        </ul>
      </section>

    </div>

    <div class="terms-footer">
      <p>{$t('terms.footer')}</p>
      <a href="/register" class="btn-primary">{$t('terms.createAccount')}</a>
      <a href="/login" class="btn-secondary">{$t('terms.login')}</a>
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  }

  .terms-page {
    min-height: 100vh;
    background: #1e1f22;
    color: #dbdee1;
    padding: 32px 20px 64px;
  }

  .terms-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #5865f2;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 24px;
    transition: opacity 0.15s;
  }
  .back-link:hover { opacity: 0.8; }

  .terms-header {
    text-align: center;
    margin-bottom: 40px;
    padding-bottom: 32px;
    border-bottom: 1px solid #3f4147;
  }

  .logo {
    display: flex;
    justify-content: center;
    margin-bottom: 12px;
  }
  .logo :global(.logo-text) {
    color: #5865f2;
  }

  .terms-header h1 {
    color: #f2f3f5;
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 8px;
  }

  .effective {
    color: #72767d;
    font-size: 13px;
    margin: 0;
  }

  .terms-body section {
    margin-bottom: 32px;
  }

  .terms-body h2 {
    color: #f2f3f5;
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #2b2d31;
  }

  .terms-body h3 {
    color: #dbdee1;
    font-size: 15px;
    font-weight: 600;
    margin: 16px 0 8px;
  }

  .terms-body p {
    color: #b5bac1;
    font-size: 14px;
    line-height: 1.7;
    margin: 0 0 12px;
  }

  .terms-body ul {
    color: #b5bac1;
    font-size: 14px;
    line-height: 1.7;
    padding-left: 24px;
    margin: 0 0 12px;
  }

  .terms-body li {
    margin-bottom: 6px;
  }

  .highlight-box {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    background: rgba(88, 101, 242, 0.08);
    border: 1px solid rgba(88, 101, 242, 0.2);
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0;
    font-size: 14px;
    line-height: 1.6;
    color: #b5bac1;
  }
  .highlight-box i {
    color: #5865f2;
    font-size: 18px;
    margin-top: 2px;
    flex-shrink: 0;
  }
  .highlight-box strong { color: #f2f3f5; }

  .highlight-box.critical {
    background: rgba(237, 66, 69, 0.08);
    border-color: rgba(237, 66, 69, 0.25);
  }
  .highlight-box.critical i { color: #ed4245; }

  .terms-footer {
    text-align: center;
    margin-top: 48px;
    padding-top: 32px;
    border-top: 1px solid #3f4147;
  }
  .terms-footer p {
    color: #949ba4;
    font-size: 14px;
    margin-bottom: 20px;
  }

  .btn-primary {
    display: inline-block;
    background: #5865f2;
    color: #fff;
    padding: 10px 24px;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
    transition: background 0.2s;
    margin: 0 6px;
  }
  .btn-primary:hover { background: #4752c4; }

  .btn-secondary {
    display: inline-block;
    background: transparent;
    color: #5865f2;
    padding: 10px 24px;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
    border: 1px solid #5865f2;
    transition: all 0.2s;
    margin: 0 6px;
  }
  .btn-secondary:hover { background: rgba(88, 101, 242, 0.1); }

  @media (max-width: 600px) {
    .terms-page { padding: 20px 16px 48px; }
    .terms-header h1 { font-size: 20px; }
    .terms-body h2 { font-size: 16px; }
  }
</style>
