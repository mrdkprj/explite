<script lang="ts">
    import { appState, icons } from "./appStateReducer.svelte";
    import util from "../util";
    import AudioSvg from "../svg/AudioSvg.svelte";
    import VideoSvg from "../svg/VideoSvg.svelte";
    import ImageSvg from "../svg/ImageSvg.svelte";
    import Zip from "../svg/Zip.svelte";
    import AppSvg from "../svg/AppSvg.svelte";
    import FileSvg from "../svg/FileSvg.svelte";
    import DirDesktop from "../svg/DirDesktop.svelte";
    import DirDocuments from "../svg/DirDocuments.svelte";
    import DirDownloads from "../svg/DirDownloads.svelte";
    import DirMusic from "../svg/DirMusic.svelte";
    import DirImage from "../svg/DirImage.svelte";
    import DirVideo from "../svg/DirVideo.svelte";
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
                <div style="width: 100px;height:90px;"></div>
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
                <div style="width: 100px;height:90px;"></div>
            {:then data}
                <img src={data} class="thumbnail-img" alt="" loading="lazy" decoding="async" />
            {/await}
        {:else}
            <ImageSvg />
        {/if}
    {:else if item.fileType == "Zip"}
        <Zip />
    {:else if item.fileType == "App"}
        <AppSvg />
    {:else}
        <FileSvg />
    {/if}
{:else if item.fileType == "Desktop"}
    <DirDesktop />
{:else if item.fileType == "Documents"}
    <DirDocuments />
{:else if item.fileType == "Downloads"}
    <DirDownloads />
{:else if item.fileType == "Music"}
    <DirMusic />
{:else if item.fileType == "Pictures"}
    <DirImage />
{:else if item.fileType == "Videos"}
    <DirVideo />
{:else}
    <FolderSvg />
{/if}
