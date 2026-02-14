<script lang="ts">
    import { appState, icons } from "./appStateReducer.svelte";
    import util from "../util";
    import AudioSvg from "../svg/AudioSvg.svelte";
    import VideoSvg from "../svg/VideoSvg.svelte";
    import ImageSvg from "../svg/ImageSvg.svelte";
    import ZipSvg from "../svg/ZipSvg.svelte";
    import AppSvg from "../svg/AppSvg.svelte";
    import FileSvg from "../svg/FileSvg.svelte";
    import DirDesktopSvg from "../svg/DirDesktopSvg.svelte";
    import DirDocumentsSvg from "../svg/DirDocumentsSvg.svelte";
    import DirDownloadsSvg from "../svg/DirDownloadsSvg.svelte";
    import DirMusicSvg from "../svg/DirMusicSvg.svelte";
    import DirImageSvg from "../svg/DirImageSvg.svelte";
    import DirVideoSvg from "../svg/DirVideoSvg.svelte";
    import FolderSvg from "../svg/FolderSvg.svelte";

    let { item, size, showThumbnail }: { item: Mp.MediaFile; size: number; showThumbnail: boolean } = $props();

    const showOSIcon = (item: Mp.MediaFile) => {
        if (!$appState.useOSIcon) return false;

        if (showThumbnail) {
            if (item.fileType == "Image" || item.fileType == "Video") {
                return false;
            }
        }

        if (item.fileType == "App") {
            return item.name in icons.cache;
        } else {
            return item.actualExtension in icons.cache;
        }
    };

    const getImage = (item: Mp.MediaFile) => {
        if (item.fileType == "App") {
            return showThumbnail ? icons.cache[item.name].large : icons.cache[item.name].small;
        } else {
            return showThumbnail ? icons.cache[item.actualExtension].large : icons.cache[item.actualExtension].small;
        }
    };
</script>

{#if item.isFile}
    {#if showOSIcon(item)}
        <img src={getImage(item)} alt="" loading="lazy" width={size} height={size} />
    {:else if item.fileType == "Audio"}
        <AudioSvg />
    {:else if item.fileType == "Video"}
        {#if showThumbnail}
            {#await util.toVideoThumbnail(item.fullPath)}
                <div class="pending"></div>
            {:then data}
                <div class="cover">
                    <div class="film"></div>
                    <img src={data} class="thumbnail-video" alt="" loading="lazy" decoding="async" />
                    <div class="film"></div>
                </div>
            {/await}
        {:else}
            <VideoSvg />
        {/if}
    {:else if item.fileType == "Image"}
        {#if showThumbnail}
            {#await util.toImageThumbnail(item.fullPath)}
                <div class="pending"></div>
            {:then data}
                <img src={data} class="thumbnail-img" alt="" loading="lazy" decoding="async" />
            {/await}
        {:else}
            <ImageSvg />
        {/if}
    {:else if item.fileType == "Zip"}
        <ZipSvg />
    {:else if item.fileType == "App"}
        <AppSvg />
    {:else}
        <FileSvg />
    {/if}
{:else if item.fileType == "Desktop"}
    <DirDesktopSvg />
{:else if item.fileType == "Documents"}
    <DirDocumentsSvg />
{:else if item.fileType == "Downloads"}
    <DirDownloadsSvg />
{:else if item.fileType == "Music"}
    <DirMusicSvg />
{:else if item.fileType == "Pictures"}
    <DirImageSvg />
{:else if item.fileType == "Videos"}
    <DirVideoSvg />
{:else}
    <FolderSvg />
{/if}

<style>
    .pending {
        width: 100px;
        height: 90px;
    }
</style>
