<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={favicon} />
</svelte:head>

{@render children()}

<style>
	/* ─── Global Scrollbar – Dark theme ────────────────── */
	:global(*) {
		scrollbar-width: thin;
		scrollbar-color: #1a1b1e transparent;
	}
	:global(*::-webkit-scrollbar) {
		width: 8px;
		height: 8px;
	}
	:global(*::-webkit-scrollbar-track) {
		background: transparent;
	}
	:global(*::-webkit-scrollbar-thumb) {
		background: #1a1b1e;
		border-radius: 4px;
	}
	:global(*::-webkit-scrollbar-thumb:hover) {
		background: #2e2f34;
	}
	:global(*::-webkit-scrollbar-corner) {
		background: transparent;
	}
</style>
