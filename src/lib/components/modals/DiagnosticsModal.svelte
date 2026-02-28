<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { t } from '$lib/i18n';
    import { runDiagnostics } from '$lib/connectionDiagnostics';
    import type { DiagnosticReport, TestStatus } from '$lib/connectionDiagnostics';

    export let friendId: string;
    export let friendName: string;
    export let show: boolean = false;

    const dispatch = createEventDispatcher();

    let report: DiagnosticReport | null = null;

    function statusIcon(s: TestStatus): string {
        switch (s) {
            case 'pass': return 'fa-check-circle';
            case 'fail': return 'fa-times-circle';
            case 'warn': return 'fa-exclamation-triangle';
            case 'running': return 'fa-spinner fa-spin';
            default: return 'fa-circle';
        }
    }

    function statusColor(s: TestStatus): string {
        switch (s) {
            case 'pass': return '#23a559';
            case 'fail': return '#da373c';
            case 'warn': return '#f0b232';
            case 'running': return '#5865f2';
            default: return '#949ba4';
        }
    }

    function summaryIcon(s: string): string {
        switch (s) {
            case 'good': return 'fa-check-circle';
            case 'degraded': return 'fa-exclamation-triangle';
            case 'bad': return 'fa-times-circle';
            default: return 'fa-question-circle';
        }
    }

    function summaryColor(s: string): string {
        switch (s) {
            case 'good': return '#23a559';
            case 'degraded': return '#f0b232';
            case 'bad': return '#da373c';
            default: return '#949ba4';
        }
    }

    function run() {
        report = null;
        runDiagnostics(friendId, friendName, (r) => {
            report = r;
        });
    }

    $: if (show) run();

    function close() {
        show = false;
        dispatch('close');
    }
</script>

{#if show}
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-overlay" on:click={close}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="modal-card" on:click|stopPropagation>
        <div class="modal-header">
            <div class="header-left">
                <i class="fas fa-stethoscope" style="color: #5865f2;"></i>
                <h2>{$t('diag.title')}</h2>
            </div>
            <button class="close-btn" on:click={close}>
                <i class="fas fa-times"></i>
            </button>
        </div>

        <div class="friend-info">
            <img
                src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${friendName}`}
                alt={friendName}
                class="friend-avatar"
            />
            <span class="friend-name">{friendName}</span>
        </div>

        {#if report}
            <div class="tests-list">
                {#each report.tests as test}
                    <div class="test-row" class:running={test.status === 'running'}>
                        <div class="test-left">
                            <i class="fas {statusIcon(test.status)}" style="color: {statusColor(test.status)}; width: 18px; text-align: center;"></i>
                            <span class="test-label">{$t(test.label)}</span>
                        </div>
                        <div class="test-right">
                            {#if test.latency && test.status === 'pass'}
                                <span class="latency-badge">{test.latency}ms</span>
                            {/if}
                            <span class="test-detail" style="color: {statusColor(test.status)};">
                                {test.detail || '—'}
                            </span>
                        </div>
                    </div>
                {/each}
            </div>

            {#if !report.running}
                <div class="summary" style="border-color: {summaryColor(report.summary)};">
                    <i class="fas {summaryIcon(report.summary)}" style="color: {summaryColor(report.summary)}; font-size: 20px;"></i>
                    <div class="summary-text">
                        <strong style="color: {summaryColor(report.summary)};">{$t(`diag.summary.${report.summary}`)}</strong>
                        <span class="summary-hint">{$t(`diag.hint.${report.summary}`)}</span>
                    </div>
                </div>

                <button class="rerun-btn" on:click={run}>
                    <i class="fas fa-redo"></i> {$t('diag.rerun')}
                </button>
            {/if}
        {:else}
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>{$t('diag.running')}</span>
            </div>
        {/if}
    </div>
</div>
{/if}

<style>
    .modal-overlay {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center;
        animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .modal-card {
        background: #2b2d31; border-radius: 12px; width: 460px; max-width: 95vw;
        max-height: 85vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        animation: slideUp 0.2s ease;
    }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: none; opacity: 1; } }

    .modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 20px; border-bottom: 1px solid #1e1f22;
    }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .header-left h2 { margin: 0; font-size: 16px; color: #f2f3f5; font-weight: 600; }

    .close-btn {
        background: none; border: none; color: #949ba4; cursor: pointer;
        width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
        transition: all 0.15s;
    }
    .close-btn:hover { background: #1e1f22; color: #fff; }

    .friend-info {
        display: flex; align-items: center; gap: 12px; padding: 14px 20px;
        background: #1e1f22; margin: 0;
    }
    .friend-avatar { width: 36px; height: 36px; border-radius: 50%; background: #5865f2; }
    .friend-name { color: #f2f3f5; font-weight: 600; font-size: 15px; }

    .tests-list { padding: 8px 12px; }

    .test-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 8px; border-radius: 6px; transition: background 0.1s;
    }
    .test-row:hover { background: #35373c; }
    .test-row.running { opacity: 0.85; }

    .test-left { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .test-label { color: #dbdee1; font-size: 13px; font-weight: 500; }

    .test-right { display: flex; align-items: center; gap: 8px; text-align: right; min-width: 0; }
    .test-detail { font-size: 12px; color: #949ba4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }

    .latency-badge {
        background: rgba(35, 165, 89, 0.15); color: #23a559;
        padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;
        white-space: nowrap;
    }

    .summary {
        margin: 8px 20px 16px; padding: 14px 16px; border-radius: 8px;
        background: #1e1f22; display: flex; align-items: center; gap: 14px;
        border-left: 3px solid;
    }
    .summary-text { display: flex; flex-direction: column; gap: 2px; }
    .summary-text strong { font-size: 14px; }
    .summary-hint { font-size: 12px; color: #949ba4; line-height: 1.4; }

    .rerun-btn {
        display: flex; align-items: center; justify-content: center; gap: 8px;
        width: calc(100% - 40px); margin: 0 20px 16px; padding: 10px;
        background: #5865f2; color: white; border: none; border-radius: 6px;
        cursor: pointer; font-size: 13px; font-weight: 600; transition: background 0.15s;
    }
    .rerun-btn:hover { background: #4752c4; }

    .loading {
        display: flex; align-items: center; justify-content: center; gap: 10px;
        padding: 32px; color: #949ba4; font-size: 14px;
    }
</style>
