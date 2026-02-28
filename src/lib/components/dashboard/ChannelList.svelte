<script lang="ts">
  import { t } from '$lib/i18n';

  export let groups: any[] = [];
  export let user: any;
  export let friendIds: string[] = [];

  export let onJoinRoom: (id: string) => void;
  export let onDeleteRoom: (id: string) => void;
  export let onCreateRoom: () => void;

  // ─── Search & Filter ──────────────────────────────────
  let searchQuery = '';
  let scopeFilter: 'all' | 'public' | 'friends' | 'private' = 'all';
  let copiedId = '';

  // ─── Lazy Loading ─────────────────────────────────────
  const PAGE_SIZE = 12;
  let visibleCount = PAGE_SIZE;
  let listEl: HTMLDivElement;

  function handleScroll() {
      if (!listEl) return;
      const { scrollTop, scrollHeight, clientHeight } = listEl;
      if (scrollHeight - scrollTop - clientHeight < 120) {
          visibleCount = Math.min(visibleCount + PAGE_SIZE, sortedGroups.length);
      }
  }

  // Reset visible count when filters change
  $: if (searchQuery || scopeFilter) visibleCount = PAGE_SIZE;

  // ─── Sorting & Filtering ──────────────────────────────
  $: friendIdSet = new Set(friendIds);

  $: filteredGroups = groups.filter(g => {
      // Search filter
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const name = (g.name || '').toLowerCase();
          const initiator = (g.initiatorDisplayName || g.initiatorName || '').toLowerCase();
          if (!name.includes(q) && !initiator.includes(q)) return false;
      }
      // Scope filter
      if (scopeFilter !== 'all' && g.scope !== scopeFilter) return false;
      return true;
  });

  $: sortedGroups = [...filteredGroups].sort((a, b) => {
      const aFriend = friendIdSet.has(a.initiatorId) || a.initiatorId === user.id;
      const bFriend = friendIdSet.has(b.initiatorId) || b.initiatorId === user.id;
      // Invited first, then friends, then others
      if (a.isInvited && !b.isInvited) return -1;
      if (!a.isInvited && b.isInvited) return 1;
      if (aFriend && !bFriend) return -1;
      if (!aFriend && bFriend) return 1;
      // Newest first within same tier
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  $: visibleGroups = sortedGroups.slice(0, visibleCount);
  $: hasMore = visibleCount < sortedGroups.length;
</script>

<div class="rooms-header">
    <h2>
        <i class="fas fa-hashtag"></i> {$t('channels.title')}
        <span class="total-badge">{groups.length}</span>
    </h2>
    <button class="create-room-btn" on:click={onCreateRoom}>
        <i class="fas fa-plus"></i> {$t('channels.create')}
    </button>
</div>

<div class="search-filter-bar">
    <div class="search-box">
        <i class="fas fa-search"></i>
        <input
            type="text"
            bind:value={searchQuery}
            placeholder={$t('channels.search')}
        />
        {#if searchQuery}
            <button class="clear-btn" on:click={() => searchQuery = ''}>
                <i class="fas fa-times"></i>
            </button>
        {/if}
    </div>
    <div class="scope-tabs">
        <button class="scope-btn" class:active={scopeFilter === 'all'} on:click={() => scopeFilter = 'all'}>{$t('channels.all')}</button>
        <button class="scope-btn" class:active={scopeFilter === 'public'} on:click={() => scopeFilter = 'public'}>
            <i class="fas fa-globe"></i> {$t('channels.public')}
        </button>
        <button class="scope-btn" class:active={scopeFilter === 'friends'} on:click={() => scopeFilter = 'friends'}>
            <i class="fas fa-user-friends"></i> {$t('channels.friends')}
        </button>
        <button class="scope-btn" class:active={scopeFilter === 'private'} on:click={() => scopeFilter = 'private'}>
            <i class="fas fa-lock"></i> {$t('channels.private')}
        </button>
    </div>
</div>

<div class="cards-scroll" bind:this={listEl} on:scroll={handleScroll}>
    {#if filteredGroups.length > 0 && searchQuery}
        <p class="result-count">{$t('channels.found', { n: filteredGroups.length })}</p>
    {/if}

    <div class="cards-grid">
        {#each visibleGroups as group (group.id)}
            <div class="room-card"
                class:private={group.scope === 'private'}
                class:friends={group.scope === 'friends'}
                class:invited={group.isInvited}
                class:friend-room={friendIdSet.has(group.initiatorId)}>
                <div class="room-icon">
                    {#if group.isInvited} <i class="fas fa-envelope-open-text" title={$t('channels.invited')}></i>
                    {:else if group.scope === 'private'} <i class="fas fa-lock"></i>
                    {:else if group.scope === 'friends'} <i class="fas fa-user-friends"></i>
                    {:else} <i class="fas fa-globe"></i>
                    {/if}
                </div>
                <div class="room-details">
                    <h4>
                        {group.name}
                        {#if group.participantCount > 0}
                            <span class="participant-count" title={$t('channels.participants', { n: group.participantCount })}>
                                <i class="fas fa-user"></i> {group.participantCount}
                            </span>
                        {/if}
                    </h4>
                    <small>
                        {#if group.isInvited} <span style="color: #5865f2; font-weight: bold;">{$t('channels.invited')}</span> •
                        {:else if group.scope === 'private'} {$t('channels.privateCall')}
                        {:else if group.scope === 'friends'} {$t('channels.friendsOnly')}
                        {:else} {$t('channels.publicGroup')}
                        {/if}
                        {group.initiatorDisplayName || group.initiatorName || 'User ' + group.initiatorId?.slice(0,4)}
                        {#if friendIdSet.has(group.initiatorId)}
                            <span class="friend-tag"><i class="fas fa-heart"></i> {$t('channels.friendTag')}</span>
                        {/if}
                        {#if group.allowTurn}
                            <span class="turn-tag" title={$t('channels.turnTooltip')}><i class="fas fa-server"></i> TURN</span>
                        {/if}
                    </small>
                </div>
                <div class="room-actions">
                    <button on:click={() => onJoinRoom(group.id)}>{$t('channels.joinVoice')}</button>
                    {#if group.scope === 'public'}
                        <button class="icon-btn share-btn" title={$t('channels.copyLink')}
                            on:click|stopPropagation={() => {
                                const url = `${window.location.origin}/room/${group.id}`;
                                navigator.clipboard.writeText(url);
                                copiedId = group.id;
                                setTimeout(() => { if (copiedId === group.id) copiedId = ''; }, 2000);
                            }}>
                            <i class="fas" class:fa-check={copiedId === group.id} class:fa-link={copiedId !== group.id}></i>
                        </button>
                    {/if}
                    {#if group.initiatorId === user.id}
                        <!-- svelte-ignore a11y-click-events-have-key-events -->
                        <!-- svelte-ignore a11y-no-static-element-interactions -->
                        <button class="icon-btn delete-btn" title={$t('channels.deleteRoom')} on:click|stopPropagation={() => onDeleteRoom(group.id)}>
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    {/if}
                </div>
            </div>
        {/each}

        {#if hasMore}
            <div class="load-more">
                <button class="load-more-btn" on:click={() => visibleCount += PAGE_SIZE}>
                    {$t('channels.loadMore', { n: sortedGroups.length - visibleCount })}
                </button>
            </div>
        {/if}

        {#if groups.length === 0}
            <div class="empty-rooms">
                <i class="fas fa-wind" style="font-size: 48px; color: #444; margin-bottom: 16px;"></i>
                <p>{$t('channels.empty')}</p>
                <button class="btn-link" on:click={onCreateRoom}>{$t('channels.createOne')}</button>
            </div>
        {:else if filteredGroups.length === 0}
            <div class="empty-rooms">
                <i class="fas fa-search" style="font-size: 36px; color: #444; margin-bottom: 16px;"></i>
                <p>{$t('channels.noMatch')}</p>
                <button class="btn-link" on:click={() => { searchQuery = ''; scopeFilter = 'all'; }}>{$t('channels.clearFilters')}</button>
            </div>
        {/if}
    </div>
</div>

<style>
    .rooms-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .rooms-header h2 { margin: 0; display: flex; align-items: center; gap: 12px; font-size: 20px; color: #f2f3f5; }
    .total-badge { background: #4f545c; color: #dcddde; font-size: 12px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
    .create-room-btn { background: #23a559; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
    .create-room-btn:hover { background: #1a7f45; }

    /* ─── Search & Filter Bar ──────────────────────────── */
    .search-filter-bar { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
    .search-box { display: flex; align-items: center; background: #1e1f22; border-radius: 8px; padding: 0 12px; gap: 8px; border: 1px solid transparent; transition: border-color 0.2s; }
    .search-box:focus-within { border-color: #5865f2; }
    .search-box i { color: #72767d; font-size: 14px; }
    .search-box input { flex: 1; background: none; border: none; color: #dbdee1; padding: 10px 0; outline: none; font-size: 14px; }
    .search-box input::placeholder { color: #72767d; }
    .clear-btn { background: none; border: none; color: #72767d; cursor: pointer; padding: 4px; font-size: 12px; transition: color 0.15s; }
    .clear-btn:hover { color: #dbdee1; }

    .scope-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
    .scope-btn { background: #2b2d31; border: 1px solid #3f4147; color: #b5bac1; padding: 6px 12px; border-radius: 16px; cursor: pointer; font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 6px; transition: all 0.15s; }
    .scope-btn:hover { background: #35373c; color: #dbdee1; }
    .scope-btn.active { background: #5865f2; border-color: #5865f2; color: white; }

    .result-count { color: #72767d; font-size: 12px; margin: 0 0 8px 0; }

    /* ─── Scrollable container ─────────────────────────── */
    .cards-scroll { flex: 1; overflow-y: auto; padding-right: 4px; }

    /* ─── Cards Grid ───────────────────────────────────── */
    .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .room-card { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; border: 1px solid #2b2d31; transition: transform 0.2s, background 0.2s; background: #2b2d31; border-radius: 8px; padding: 16px; }
    .room-card:hover { transform: translateY(-2px); background: #35373c; border-color: #404249; }
    .room-card .room-details { width: 100%; }
    .room-card h4 { margin: 0 0 4px 0; font-size: 16px; color: #f2f3f5; }
    .room-card small { color: #b5bac1; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .room-card button { width: 100%; margin-top: auto; padding: 8px; background: #5865f2; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }
    .room-card button:hover { background: #4752c4; }
    .room-card button.delete-btn { width: 40px; margin-left: auto; background: #da373c; display: flex; align-items: center; justify-content: center; flex: 0 0 40px !important; }
    .room-card button.delete-btn:hover { background: #a1282c; }

    .room-actions { display: flex; gap: 8px; width: 100%; margin-top: auto; }

    .room-icon { width: 48px; height: 48px; background: #41434a; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #dbdee1; }

    .room-card.private { border-left: 4px solid #da373c; }
    .room-card.friends { border-left: 4px solid #e0c20a; }
    .room-card.invited { border-left: 4px solid #5865f2; background-color: rgba(88, 101, 242, 0.1); }
    .room-card.friend-room:not(.invited) { border-left: 4px solid #23a559; }

    .friend-tag { color: #23a559; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px; background: rgba(35, 165, 89, 0.15); padding: 1px 6px; border-radius: 8px; }
    .turn-tag { color: #faa61a; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px; background: rgba(250, 166, 26, 0.15); padding: 1px 6px; border-radius: 8px; }

    .participant-count {
        display: inline-flex; align-items: center; gap: 4px;
        background: rgba(88, 101, 242, 0.15); color: #8b9bfa;
        font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
        margin-left: 8px; vertical-align: middle;
    }
    .participant-count i { font-size: 10px; }

    .share-btn { width: 40px; background: #2b2d31 !important; border: 1px solid #3f4147; display: flex; align-items: center; justify-content: center; flex: 0 0 40px !important; color: #b5bac1 !important; }
    .share-btn:hover { background: #35373c !important; color: #5865f2 !important; border-color: #5865f2; }
    .share-btn .fa-check { color: #23a559 !important; }

    .empty-rooms { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; border: 2px dashed #404249; border-radius: 8px; color: #949ba4; }
    .btn-link { background: none; border: none; color: #00aff4; cursor: pointer; padding: 0; text-decoration: underline; font-size: inherit; }

    .load-more { grid-column: 1 / -1; display: flex; justify-content: center; padding: 8px 0; }
    .load-more-btn { background: #2b2d31; border: 1px solid #3f4147; color: #b5bac1; padding: 8px 24px; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.15s; }
    .load-more-btn:hover { background: #35373c; color: #dbdee1; border-color: #5865f2; }

    @media (max-width: 480px) {
        .cards-grid { grid-template-columns: 1fr; }
        .room-card { padding: 12px; }
        .scope-tabs { overflow-x: auto; flex-wrap: nowrap; }
    }
</style>
