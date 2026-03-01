<script lang="ts">
    import { createEventDispatcher, afterUpdate, onMount } from 'svelte';
    import { t } from '$lib/i18n';

    export let messages: any[];
    export let messageInput: string;
    export let isChatOpen: boolean;
    export let currentUsername: string = '';

    const dispatch = createEventDispatcher();

    function toggleChat() {
        dispatch('toggleChat');
    }

    let chatMessagesEl: HTMLDivElement;
    let shouldAutoScroll = true;
    let showFormatBar = false;
    let inputEl: HTMLInputElement;

    // ─── Auto-scroll ─────────────────────────────────────
    function handleScroll() {
        if (!chatMessagesEl) return;
        const { scrollTop, scrollHeight, clientHeight } = chatMessagesEl;
        shouldAutoScroll = scrollHeight - scrollTop - clientHeight < 60;
    }

    afterUpdate(() => {
        if (shouldAutoScroll && chatMessagesEl) {
            chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        }
    });

    // ─── Formatting helpers ──────────────────────────────
    function insertFormat(prefix: string, suffix: string = prefix) {
        messageInput = messageInput + prefix + suffix;
        showFormatBar = false;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            dispatch('sendMessage');
        }
    }

    // ─── Markdown-like rendering ─────────────────────────
    function renderContent(text: string): string {
        if (!text) return '';
        // Escape HTML first
        let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Code blocks ``` ... ```
        s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, code) => {
            const langLabel = lang ? `<span class="code-lang">${lang}</span>` : '';
            return `<div class="code-block">${langLabel}<pre><code>${code.trim()}</code></pre></div>`;
        });
        // Inline code
        s = s.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        // Bold **text**
        s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Italic *text*
        s = s.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
        // Strikethrough ~~text~~
        s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
        // Links [text](url)
        s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="chat-link">$1</a>');
        // Auto-link bare URLs
        s = s.replace(/(^|[^"'])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener" class="chat-link">$2</a>');
        // Newlines
        s = s.replace(/\n/g, '<br>');
        return s;
    }

    function avatarUrl(username: string): string {
        return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(username)}`;
    }

    function formatTime(ts?: number): string {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Group consecutive messages by the same sender
    type GroupedMsg = { sender: string; senderId?: string; msgs: any[] };
    $: groupedMessages = groupMessages(messages);

    function groupMessages(msgs: any[]): GroupedMsg[] {
        const groups: GroupedMsg[] = [];
        for (const m of msgs) {
            const last = groups[groups.length - 1];
            if (last && last.sender === m.sender && m.type !== 'file' && last.msgs[last.msgs.length - 1]?.type !== 'file') {
                last.msgs.push(m);
            } else {
                groups.push({ sender: m.sender, senderId: m.senderId, msgs: [m] });
            }
        }
        return groups;
    }
</script>

<div class="chat-drawer" class:open={isChatOpen}>
    <!-- Chevron tab that's always visible, attached to left edge of panel -->
    <button class="chat-chevron" on:click={toggleChat} title={isChatOpen ? $t('chatPanel.hide') : $t('chatPanel.show')}>
        <i class="fas" class:fa-chevron-left={!isChatOpen} class:fa-chevron-right={isChatOpen}></i>
        {#if !isChatOpen && messages.length > 0}
            <span class="chevron-badge">{messages.length}</span>
        {/if}
    </button>

    <div class="chat-panel">
        <div class="chat-header">
            <i class="fas fa-comments"></i> {$t('chatPanel.title')}
            <span class="msg-count">{messages.length}</span>
        </div>

    <div class="chat-messages" bind:this={chatMessagesEl} on:scroll={handleScroll}>
        {#if messages.length === 0}
            <div class="empty-chat">
                <i class="fas fa-comment-dots"></i>
                <p>{$t('chatPanel.empty')}</p>
                <span>{$t('chatPanel.emptyHint')}</span>
            </div>
        {/if}

        {#each groupedMessages as group}
            <div class="message-group" class:own={group.sender === currentUsername}>
                <div class="msg-avatar">
                    <img src={avatarUrl(group.sender)} alt={group.sender} />
                </div>
                <div class="msg-body">
                    <div class="msg-header">
                        <span class="msg-username" class:own-name={group.sender === currentUsername}>{group.sender}</span>
                        {#if group.msgs[0]?.timestamp}
                            <span class="msg-time">{formatTime(group.msgs[0].timestamp)}</span>
                        {/if}
                    </div>
                    {#each group.msgs as msg}
                        {#if msg.type === 'file'}
                            <div class="message-bubble file-msg">
                                <div class="file-attachment">
                                    <div class="file-icon">
                                        <i class="fas" class:fa-file={!msg.mimeType?.startsWith('image')} class:fa-image={msg.mimeType?.startsWith('image')}></i>
                                    </div>
                                    <div class="file-info">
                                        <span class="file-name">{msg.content}</span>
                                        {#if msg.fileData}
                                            {#if msg.mimeType?.startsWith('image')}
                                                <img src={msg.fileData} alt="Shared" class="shared-img-preview" />
                                            {/if}
                                            <a href={msg.fileData} download={msg.fileName || msg.content.split(':')[1]?.trim().replace(/\s*\(\d+(\.\d+)?\s*[KMGTP]?B\).*$/, '') || 'download'} class="download-btn">
                                                <i class="fas fa-download"></i> {$t('chatPanel.download')}
                                            </a>
                                        {:else if msg.progress === 0 && !msg.fileData}
                                            <button class="download-btn" on:click={() => dispatch('requestFile', msg)}>
                                                <i class="fas fa-download"></i> {$t('chatPanel.receive')}
                                            </button>
                                        {:else}
                                            <div class="progress-bar-container">
                                                <div class="progress-bar" style="width: {msg.progress || 0}%"></div>
                                            </div>
                                            <span class="loading">{msg.progress || 0}%</span>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <div class="message-bubble text-msg">
                                {@html renderContent(msg.content)}
                            </div>
                        {/if}
                    {/each}
                </div>
            </div>
        {/each}
    </div>

    <div class="chat-input-area">
        {#if showFormatBar}
            <div class="format-bar">
                <button class="fmt-btn" title={$t('chatPanel.bold')} on:click={() => insertFormat('**')}>
                    <i class="fas fa-bold"></i>
                </button>
                <button class="fmt-btn" title={$t('chatPanel.italic')} on:click={() => insertFormat('*')}>
                    <i class="fas fa-italic"></i>
                </button>
                <button class="fmt-btn" title={$t('chatPanel.strike')} on:click={() => insertFormat('~~')}>
                    <i class="fas fa-strikethrough"></i>
                </button>
                <button class="fmt-btn" title={$t('chatPanel.code')} on:click={() => insertFormat('`')}>
                    <i class="fas fa-code"></i>
                </button>
                <button class="fmt-btn" title={$t('chatPanel.codeBlock')} on:click={() => insertFormat('```\n', '\n```')}>
                    <i class="fas fa-file-code"></i>
                </button>
                <button class="fmt-btn" title={$t('chatPanel.link')} on:click={() => insertFormat('[text](url)')}>
                    <i class="fas fa-link"></i>
                </button>
            </div>
        {/if}
        <div class="input-row">
            <button class="format-toggle" on:click={() => showFormatBar = !showFormatBar} title={$t('chatPanel.formatting')}>
                <i class="fas fa-font"></i>
            </button>
            <input
                bind:this={inputEl}
                bind:value={messageInput}
                on:keydown={handleKeydown}
                placeholder={$t('chatPanel.placeholder')}
            />
            <button class="send-btn" on:click={() => dispatch('sendMessage')} disabled={!messageInput?.trim()}>
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
    </div>
    </div>
</div>

<style>
    /* Drawer container — slides right edge in/out */
    .chat-drawer {
        position: absolute;
        top: 0; right: 0; bottom: 0;
        display: flex;
        transform: translateX(380px);
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        z-index: 200;
        pointer-events: none;
    }
    .chat-drawer > * { pointer-events: auto; }
    .chat-drawer.open { transform: translateX(0); }

    /* Chevron tab pinned to the left edge of the drawer */
    .chat-chevron {
        align-self: center;
        width: 28px;
        min-height: 72px;
        background: rgba(43, 45, 49, 0.92);
        border: 1px solid rgba(255,255,255,0.1);
        border-right: none;
        border-radius: 8px 0 0 8px;
        color: #b5bac1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
        backdrop-filter: blur(8px);
        flex-shrink: 0;
    }
    .chat-chevron:hover { background: rgba(88, 101, 242, 0.85); color: #fff; }
    .chevron-badge {
        background: #ed4245; color: #fff;
        font-size: 10px; font-weight: 700;
        min-width: 18px; height: 18px;
        border-radius: 9px;
        display: flex; align-items: center; justify-content: center;
        padding: 0 4px; box-sizing: border-box;
        line-height: 1;
    }

    /* Inner panel */
    .chat-panel { width: 380px; background: #2b2d31; display: flex; flex-direction: column; border-left: 1px solid #1f2023; }
    .chat-header { padding: 14px 16px; font-weight: bold; border-bottom: 1px solid #2f3136; color: white; display: flex; align-items: center; gap: 8px; font-size: 15px; }
    .msg-count { background: #5865f2; color: white; font-size: 11px; padding: 2px 7px; border-radius: 10px; font-weight: 600; margin-left: auto; }

    /* ─── Messages area ───────────────────────────────── */
    .chat-messages { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; color: #dbdee1; scroll-behavior: smooth; }

    .empty-chat { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; color: #72767d; text-align: center; gap: 4px; }
    .empty-chat i { font-size: 48px; margin-bottom: 8px; opacity: 0.3; }
    .empty-chat p { font-size: 16px; font-weight: 600; margin: 0; }
    .empty-chat span { font-size: 12px; }

    /* ─── Message groups ──────────────────────────────── */
    .message-group { display: flex; gap: 12px; padding: 6px 0; }
    .message-group.own { flex-direction: row-reverse; }
    .message-group.own .msg-body { align-items: flex-end; }
    .message-group.own .msg-header { flex-direction: row-reverse; }

    .msg-avatar { flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%; overflow: hidden; margin-top: 2px; }
    .msg-avatar img { width: 100%; height: 100%; border-radius: 50%; background: #2f3136; }

    .msg-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; max-width: 85%; }
    .msg-header { display: flex; align-items: baseline; gap: 8px; }
    .msg-username { font-size: 13px; font-weight: 700; color: #f2f3f5; }
    .msg-username.own-name { color: #5865f2; }
    .msg-time { font-size: 10px; color: #72767d; }

    /* ─── Message bubbles ─────────────────────────────── */
    .message-bubble { border-radius: 12px; line-height: 1.45; word-break: break-word; overflow-wrap: break-word; }
    .message-bubble.text-msg { background: #383a40; padding: 8px 14px; font-size: 14px; color: #dcddde; border-radius: 4px 12px 12px 12px; }
    .message-group.own .message-bubble.text-msg { background: #5865f2; color: #fff; border-radius: 12px 4px 12px 12px; }
    .message-group.own .message-bubble.text-msg :global(a.chat-link) { color: #c9d0ff; }
    .message-group.own .message-bubble.text-msg :global(code.inline-code) { background: rgba(0,0,0,0.25); color: #e8eaff; }

    .message-bubble.file-msg { background: #2f3136; padding: 10px; border: 1px solid #1e1f22; }
    .file-attachment { display: flex; gap: 12px; align-items: flex-start; }
    .file-icon { width: 40px; height: 40px; border-radius: 8px; background: #5865f2; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; flex-shrink: 0; }
    .file-info { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1; }
    .file-name { font-size: 13px; color: #00aff4; font-weight: 500; word-break: break-all; }
    .shared-img-preview { max-width: 100%; border-radius: 8px; max-height: 200px; object-fit: contain; margin-top: 4px; }
    .progress-bar-container { height: 6px; background: #202225; border-radius: 3px; overflow: hidden; width: 100%; }
    .progress-bar { height: 100%; background: #5865f2; transition: width 0.2s; }
    .download-btn { background: #5865f2; color: white; padding: 6px 14px; border-radius: 4px; text-decoration: none; font-size: 12px; text-align: center; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: background 0.2s; }
    .download-btn:hover { background: #4752c4; }

    /* ─── Rich text styles ────────────────────────────── */
    .message-bubble :global(strong) { font-weight: 700; }
    .message-bubble :global(em) { font-style: italic; }
    .message-bubble :global(del) { text-decoration: line-through; opacity: 0.7; }
    .message-bubble :global(code.inline-code) { background: #1e1f22; color: #e87f7f; padding: 2px 6px; border-radius: 4px; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; }
    .message-bubble :global(.code-block) { background: #1e1f22; border-radius: 8px; margin: 6px 0; overflow: hidden; position: relative; }
    .message-bubble :global(.code-block .code-lang) { position: absolute; top: 6px; right: 10px; font-size: 10px; color: #72767d; text-transform: uppercase; font-weight: 600; }
    .message-bubble :global(.code-block pre) { margin: 0; padding: 12px 14px; overflow-x: auto; }
    .message-bubble :global(.code-block code) { font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; color: #e0e0e0; line-height: 1.5; }
    .message-bubble :global(a.chat-link) { color: #00aff4; text-decoration: none; }
    .message-bubble :global(a.chat-link:hover) { text-decoration: underline; }

    /* ─── Input area ──────────────────────────────────── */
    .chat-input-area { padding: 12px 16px; background: #2b2d31; border-top: 1px solid #1f2023; }

    .format-bar { display: flex; gap: 4px; padding: 6px 0; flex-wrap: wrap; }
    .fmt-btn { background: #383a40; border: none; color: #b5bac1; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px; transition: all 0.15s; }
    .fmt-btn:hover { background: #5865f2; color: white; }

    .input-row { display: flex; align-items: center; gap: 8px; background: #383a40; border-radius: 10px; padding: 4px 8px; }
    .input-row input { flex: 1; padding: 10px 4px; background: transparent; border: none; color: white; outline: none; font-size: 14px; min-width: 0; }
    .input-row input::placeholder { color: #72767d; }
    .format-toggle { background: none; border: none; color: #72767d; cursor: pointer; font-size: 16px; padding: 6px; border-radius: 6px; transition: all 0.15s; flex-shrink: 0; }
    .format-toggle:hover { color: #dbdee1; background: rgba(255,255,255,0.06); }
    .send-btn { background: #5865f2; border: none; color: white; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.15s; flex-shrink: 0; }
    .send-btn:hover { background: #4752c4; }
    .send-btn:disabled { opacity: 0.4; cursor: default; }

    @media (max-width: 768px) {
        .chat-drawer {
            position: fixed; left: 0; right: 0;
            bottom: 80px; bottom: calc(80px + env(safe-area-inset-bottom, 0px));
            top: auto; height: 55vh; height: 55dvh;
            flex-direction: column;
            transform: translateY(calc(100% - 40px));
        }
        .chat-drawer.open { transform: translateY(0); }
        .chat-chevron {
            align-self: center;
            width: auto; min-height: auto;
            padding: 6px 20px;
            border-radius: 8px 8px 0 0;
            border: 1px solid rgba(255,255,255,0.1);
            border-bottom: none;
            flex-direction: row; gap: 8px;
        }
        .chat-panel {
            width: 100%; flex: 1; border-left: none;
            border-top: 1px solid #1f2023;
            box-shadow: 0 -4px 16px rgba(0,0,0,0.5);
        }
        .chat-messages { flex: 1; overflow-y: auto; min-height: 0; }
        .chat-input-area { padding: 8px 12px; padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px)); flex-shrink: 0; }
        .input-row input { padding: 8px 4px; }
    }
</style>
