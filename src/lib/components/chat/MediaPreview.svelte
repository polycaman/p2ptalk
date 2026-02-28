<script lang="ts">
    export let type: 'youtube' | 'image' | 'link' = 'link';
    export let url: string = '';
    export let youtubeId: string = '';
</script>

<div class="media-preview">
    {#if type === 'youtube' && youtubeId}
        <div class="youtube-embed">
            <iframe
                src="https://www.youtube.com/embed/{youtubeId}"
                title="YouTube video"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
            ></iframe>
        </div>
    {:else if type === 'image' && url}
        <div class="image-preview">
            <a href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt="Preview" loading="lazy" on:error={(e) => { /** @type {HTMLImageElement} */ (e.currentTarget).style.display = 'none'; }} />
            </a>
        </div>
    {/if}
</div>

<style>
    .media-preview { margin-top: 6px; }

    .youtube-embed {
        position: relative;
        padding-bottom: 56.25%;
        height: 0;
        overflow: hidden;
        border-radius: 8px;
        max-width: 400px;
    }
    .youtube-embed iframe {
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        border-radius: 8px;
    }

    .image-preview img {
        max-width: 100%;
        max-height: 250px;
        border-radius: 8px;
        cursor: pointer;
        transition: opacity 0.2s;
    }
    .image-preview img:hover { opacity: 0.9; }
</style>
