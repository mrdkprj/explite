<script lang="ts">
    import { appState } from "./appStateReducer.svelte";
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
    import { icons } from "../main";

    let { item }: { item: Mp.MediaFile } = $props();
</script>

{#if item.isFile}
    {#if $appState.useOSIcon && item.actualExtension in icons}
        <img src={icons[item.actualExtension]} alt="" width="16" height="16" />
    {:else if item.fileType == "Audio"}
        <AudioSvg />
    {:else if item.fileType == "Video"}
        <VideoSvg />
    {:else if item.fileType == "Image"}
        <ImageSvg />
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
