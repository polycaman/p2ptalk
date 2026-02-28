<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import MediaPreview from './MediaPreview.svelte';
    import VoicePlayer from './VoicePlayer.svelte';
    import type { ChatMessage } from '$lib/types/chat';
    import { DELETED_MARKER } from '$lib/chatPersistence';
    import { t } from '$lib/i18n';

    export let message: ChatMessage;
    export let isOwn: boolean;
    export let showSender: boolean = false;

    const dispatch = createEventDispatcher();

    const YOUTUBE_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/;
    const IMAGE_URL_REGEX = /https?:\/\/[^\s<]+\.(jpg|jpeg|png|gif|webp)(\?[^\s]*)?/gi;
    const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

    $: isMediaDeleted = message.metadata?.fileData === DELETED_MARKER;
    $: isSentMedia = isOwn && !message.metadata?.fileData && message.metadata?.progress === 100 && !isMediaDeleted;
    $: youtubeId = message.type === 'text' ? extractYouTubeId(message.content) : null;
    $: imageUrls = message.type === 'text' ? extractImageUrls(message.content) : [];
    $: formattedContent = message.type === 'text' ? formatContent(message.content) : '';

    function extractYouTubeId(text: string): string | null {
        const match = text.match(YOUTUBE_REGEX);
        return match ? match[1] : null;
    }

    function extractImageUrls(text: string): string[] {
        return text.match(IMAGE_URL_REGEX) || [];
    }

    function formatContent(text: string): string {
        let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/`(.+?)`/g, '<code>$1</code>');
        html = html.replace(URL_REGEX, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
        html = html.replace(/\n/g, '<br/>');
        return html;
    }

    function formatTime(ts: number): string {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatSize(bytes: number): string {
        if (!bytes) return '';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
</script>

{#if message.type === 'system'}
    <div class="system-message"><span>{message.content}</span></div>
{:else}
    <div class="bubble-row" class:own={isOwn}>
        <div class="bubble" class:own={isOwn}>
            {#if showSender && !isOwn}
                <span class="sender-name">{message.senderName}</span>
            {/if}

            {#if message.type === 'text'}
                <div class="text-content">{@html formattedContent}</div>
                {#if youtubeId}
                    <MediaPreview type="youtube" youtubeId={youtubeId} />
                {/if}
                {#each imageUrls as imgUrl}
                    <MediaPreview type="image" url={imgUrl} />
                {/each}

            {:else if message.type === 'image'}
                {#if isMediaDeleted}
                    <div class="media-deleted">
                        <i class="fas fa-image"></i>
                        <span>{$t('msg.deleted')}</span>
                    </div>
                {:else if isSentMedia}
                    <div class="sent-media-placeholder">
                        <i class="fas fa-image"></i>
                        <div class="file-info">
                            <span class="file-name">{message.metadata?.fileName || message.content}</span>
                            <span class="file-size">{formatSize(message.metadata?.fileSize || 0)}</span>
                        </div>
                    </div>
                {:else if message.metadata?.fileData}
                    <div class="media-content">
                        <img src={message.metadata.fileData} alt={message.content} />
                    </div>
                {:else if message.metadata?.accepted === null && !isOwn}
                    <div class="file-offer">
                        <i class="fas fa-image"></i>
                        <div class="file-info">
                            <span class="file-name">{message.metadata?.fileName}</span>
                            <span class="file-size">{formatSize(message.metadata?.fileSize || 0)}</span>
                        </div>
                        <div class="file-actions">
                            <button class="accept" on:click={() => dispatch('acceptFile', { fileId: message.id, senderId: message.senderId })} title={$t('msg.accept')}><i class="fas fa-check"></i></button>
                            <button class="reject" on:click={() => dispatch('rejectFile', { fileId: message.id, senderId: message.senderId })} title={$t('msg.reject')}><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                {:else if message.metadata?.accepted && (message.metadata?.progress ?? 0) < 100}
                    <div class="file-progress">
                        <div class="progress-track"><div class="progress-bar" style="width: {message.metadata?.progress}%"></div></div>
                        <span>{message.metadata?.progress}%</span>
                    </div>
                {:else if message.metadata?.accepted === false}
                    <div class="file-rejected"><i class="fas fa-ban"></i> {$t('msg.declined')}</div>
                {/if}

            {:else if message.type === 'video'}
                {#if isMediaDeleted}
                    <div class="media-deleted">
                        <i class="fas fa-video"></i>
                        <span>{$t('msg.deleted')}</span>
                    </div>
                {:else if isSentMedia}
                    <div class="sent-media-placeholder">
                        <i class="fas fa-video"></i>
                        <div class="file-info">
                            <span class="file-name">{message.metadata?.fileName || message.content}</span>
                            <span class="file-size">{formatSize(message.metadata?.fileSize || 0)}</span>
                        </div>
                    </div>
                {:else if message.metadata?.fileData}
                    <div class="media-content">
                        <!-- svelte-ignore a11y-media-has-caption -->
                        <video src={message.metadata.fileData} controls></video>
                    </div>
                {:else if message.metadata?.accepted === null && !isOwn}
                    <div class="file-offer">
                        <i class="fas fa-video"></i>
                        <div class="file-info">
                            <span class="file-name">{message.metadata?.fileName}</span>
                            <span class="file-size">{formatSize(message.metadata?.fileSize || 0)}</span>
                        </div>
                        <div class="file-actions">
                            <button class="accept" on:click={() => dispatch('acceptFile', { fileId: message.id, senderId: message.senderId })} title={$t('msg.accept')}><i class="fas fa-check"></i></button>
                            <button class="reject" on:click={() => dispatch('rejectFile', { fileId: message.id, senderId: message.senderId })} title={$t('msg.reject')}><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                {:else if message.metadata?.accepted && (message.metadata?.progress ?? 0) < 100}
                    <div class="file-progress">
                        <div class="progress-track"><div class="progress-bar" style="width: {message.metadata?.progress}%"></div></div>
                        <span>{message.metadata?.progress}%</span>
                    </div>
                {:else if message.metadata?.accepted === false}
                    <div class="file-rejected"><i class="fas fa-ban"></i> {$t('msg.declined')}</div>
                {/if}

            {:else if message.type === 'file'}
                {#if isMediaDeleted}
                    <div class="media-deleted">
                        <i class="fas fa-file"></i>
                        <span>{$t('msg.deleted')}</span>
                    </div>
                {:else}
                <div class="file-offer">
                    <i class="fas fa-file"></i>
                    <div class="file-info">
                        <span class="file-name">{message.metadata?.fileName || message.content}</span>
                        <span class="file-size">{formatSize(message.metadata?.fileSize || 0)}</span>
                    </div>
                    {#if message.metadata?.fileData}
                        <a href={message.metadata.fileData} download={message.metadata.fileName} class="download-btn" title={$t('msg.download')}><i class="fas fa-download"></i></a>
                    {:else if !isOwn && message.metadata?.accepted === null}
                        <div class="file-actions">
                            <button class="accept" on:click={() => dispatch('acceptFile', { fileId: message.id, senderId: message.senderId })} title={$t('msg.accept')}><i class="fas fa-check"></i></button>
                            <button class="reject" on:click={() => dispatch('rejectFile', { fileId: message.id, senderId: message.senderId })} title={$t('msg.reject')}><i class="fas fa-times"></i></button>
                        </div>
                    {:else if message.metadata?.accepted && (message.metadata?.progress ?? 0) < 100}
                        <div class="progress-track"><div class="progress-bar" style="width: {message.metadata?.progress}%"></div></div>
                    {:else if message.metadata?.accepted === false}
                        <span class="declined-text">{$t('msg.declined')}</span>
                    {/if}
                </div>
                {/if}

            {:else if message.type === 'voice'}
                <div class="voice-message">
                    {#if isMediaDeleted}
                        <div class="media-deleted">
                            <i class="fas fa-microphone"></i>
                            <span>{$t('msg.deleted')}</span>
                        </div>
                    {:else if isSentMedia}
                        <div class="sent-media-placeholder">
                            <i class="fas fa-microphone"></i>
                            <span>{$t('msg.voiceSent')} · {message.metadata?.duration || 0}s</span>
                        </div>
                    {:else if message.metadata?.fileData}
                        <VoicePlayer
                            src={message.metadata.fileData}
                            duration={message.metadata?.duration || 0}
                            {isOwn}
                        />
                    {:else if !isOwn && message.metadata?.accepted === null}
                        <div class="voice-offer">
                            <i class="fas fa-microphone"></i>
                            <span>{$t('msg.voiceOffer')} ({message.metadata?.duration || 0}s)</span>
                            <div class="file-actions">
                                <button class="accept" on:click={() => dispatch('acceptFile', { fileId: message.id, senderId: message.senderId })} title={$t('msg.accept')}><i class="fas fa-check"></i></button>
                                <button class="reject" on:click={() => dispatch('rejectFile', { fileId: message.id, senderId: message.senderId })} title={$t('msg.reject')}><i class="fas fa-times"></i></button>
                            </div>
                        </div>
                    {:else if message.metadata?.accepted && (message.metadata?.progress ?? 0) < 100}
                        <div class="file-progress">
                            <div class="progress-track"><div class="progress-bar" style="width: {message.metadata?.progress}%"></div></div>
                            <span>{message.metadata?.progress}%</span>
                        </div>
                    {:else if message.metadata?.accepted === false}
                        <div class="file-rejected"><i class="fas fa-ban"></i> {$t('msg.voiceDeclined')}</div>
                    {/if}
                </div>
            {/if}

            <span class="timestamp">{formatTime(message.timestamp)}</span>
        </div>
    </div>
{/if}

<style>
    .system-message { text-align: center; padding: 4px 0; }
    .system-message span { font-size: 12px; color: #72767d; font-style: italic; }

    .bubble-row { display: flex; justify-content: flex-start; padding: 2px 0; }
    .bubble-row.own { justify-content: flex-end; }

    .bubble {
        max-width: 70%; background: #383a40;
        border-radius: 12px 12px 12px 4px;
        padding: 8px 12px; word-wrap: break-word;
    }
    .bubble.own { background: #5865f2; border-radius: 12px 12px 4px 12px; }

    .sender-name { display: block; font-size: 12px; font-weight: 700; color: #7289da; margin-bottom: 2px; }

    .text-content { font-size: 14px; color: #dcddde; line-height: 1.4; }
    .text-content :global(a) { color: #00aff4; text-decoration: none; }
    .text-content :global(a:hover) { text-decoration: underline; }
    .text-content :global(code) { background: rgba(0,0,0,0.2); padding: 1px 4px; border-radius: 3px; font-size: 13px; }
    .bubble.own .text-content { color: #fff; }
    .bubble.own .text-content :global(a) { color: #c3d7ff; }

    .timestamp { display: block; font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 4px; text-align: right; }
    .bubble:not(.own) .timestamp { color: #72767d; }

    .media-content { margin: 6px 0; border-radius: 8px; overflow: hidden; max-width: 320px; }
    .media-content img, .media-content video { max-width: 100%; max-height: 300px; border-radius: 8px; display: block; }

    .file-offer {
        display: flex; align-items: center; gap: 10px;
        padding: 8px; background: rgba(0,0,0,0.15); border-radius: 8px; margin: 4px 0;
    }
    .file-offer > i { font-size: 24px; color: #b5bac1; flex-shrink: 0; }
    .file-info { flex: 1; min-width: 0; }
    .file-name { display: block; font-size: 13px; color: #dbdee1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .file-size { font-size: 11px; color: #949ba4; }

    .file-actions { display: flex; gap: 4px; }
    .file-actions button {
        width: 32px; height: 32px; border-radius: 50%; border: none;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        font-size: 14px; transition: all 0.2s;
    }
    .file-actions .accept { background: #23a559; color: white; }
    .file-actions .accept:hover { background: #1a9048; }
    .file-actions .reject { background: #ed4245; color: white; }
    .file-actions .reject:hover { background: #d63031; }

    .download-btn { color: #b5bac1; font-size: 18px; padding: 4px; text-decoration: none; }
    .download-btn:hover { color: #fff; }

    .file-progress { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
    .file-progress span { font-size: 11px; color: #b5bac1; }
    .progress-track { flex: 1; background: rgba(0,0,0,0.2); border-radius: 4px; height: 6px; overflow: hidden; }
    .progress-bar { height: 6px; background: #5865f2; border-radius: 4px; transition: width 0.3s; }

    .file-rejected, .declined-text { font-size: 12px; color: #ed4245; font-style: italic; }

    .voice-message { min-width: 240px; }
    .voice-offer { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
    .voice-offer i { color: #5865f2; font-size: 18px; }
    .voice-offer span { font-size: 13px; color: #b5bac1; flex: 1; }

    /* Deleted media placeholder */
    .media-deleted {
        display: flex; align-items: center; gap: 10px;
        padding: 16px 20px; border-radius: 8px; margin: 4px 0;
        background: rgba(0,0,0,0.15); border: 1px dashed rgba(255,255,255,0.1);
        color: #72767d; font-style: italic;
    }
    .media-deleted i { font-size: 20px; opacity: 0.5; }
    .media-deleted span { font-size: 13px; }

    /* Sent media placeholder (sender's own, blob not stored) */
    .sent-media-placeholder {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 14px; border-radius: 8px; margin: 4px 0;
        background: rgba(0,0,0,0.15);
    }
    .sent-media-placeholder i { font-size: 20px; opacity: 0.6; color: #b5bac1; }
    .sent-media-placeholder span { font-size: 13px; color: #b5bac1; }
</style>
