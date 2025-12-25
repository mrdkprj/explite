<script lang="ts">
    import { appState, listState, renameState, headerState } from "./appStateReducer.svelte";

    import { handleKeyEvent } from "../constants";
    import VirtualList from "./VirtualList.svelte";
    import AudioSvg from "../svg/AudioSvg.svelte";
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

    let {
        visibleStartIndex = $bindable(0),
        visibleEndIndex = $bindable(0),
        fileListContainer = $bindable<HTMLDivElement>(),
        virtualList = $bindable<VirtualList<Mp.MediaFile> | VirtualList<Mp.MediaFile[]>>(),
        searchHighlight,
        clipMouseEnter,
        clipMouseLeave,
        onRowClick,
        onSelect,
        colDetailMouseDown,
        toVideoThumbnail,
        toImageThumbnail,
        onScroll,
    }: {
        visibleStartIndex: number;
        visibleEndIndex: number;
        fileListContainer: HTMLDivElement | undefined;
        virtualList: VirtualList<Mp.MediaFile> | VirtualList<Mp.MediaFile[]> | undefined;
        searchHighlight: (nodes: HTMLElement[]) => void;
        clipMouseEnter: (e: MouseEvent) => void;
        clipMouseLeave: (e: MouseEvent) => void;
        onRowClick: (e: MouseEvent) => void;
        onSelect: (e: MouseEvent) => void;
        colDetailMouseDown: (e: MouseEvent) => void;
        toVideoThumbnail: (fullPath: string) => Promise<string>;
        toImageThumbnail: (fullPath: string) => Promise<string>;
        onScroll: () => Promise<void>;
    } = $props();

    const GRID_ITEM_WIDTH = 110 + 10 + 10;

    const toChunk = () => {
        if (!fileListContainer) return [];
        const chunks = [];
        const files = listState.files;
        const chunkSize = Math.floor(fileListContainer.clientWidth / GRID_ITEM_WIDTH);
        for (let i = 0; i < files.length; i += chunkSize) {
            const chunk = files.slice(i, i + chunkSize);
            chunks.push(chunk);
        }
        return chunks;
    };
</script>

<VirtualList
    items={toChunk()}
    bind:this={virtualList}
    bind:viewport={fileListContainer}
    bind:start={visibleStartIndex}
    bind:end={visibleEndIndex}
    itemHeight={140}
    headerHeight={0}
    onRefresh={searchHighlight}
    thumbnail={true}
    {onScroll}
>
    {#snippet header()}{/snippet}
    {#snippet item(items)}
        {#each items as item (item.uuid)}
            <div
                id={item.id}
                class="thumb-column selectable"
                draggable="true"
                class:selected={$appState.selection.selectedIds.includes(item.id)}
                class:being-selected={$appState.selection.selectedId == item.id}
                class:cut={$appState.copyCutTargets.ids.includes(item.id) && $appState.copyCutTargets.op == "Move"}
                class:drag-highlight={!item.isFile && $appState.dragTargetId == item.id}
                onmouseover={clipMouseEnter}
                onmouseout={clipMouseLeave}
                onfocus={() => {}}
                onblur={() => {}}
                onclick={onRowClick}
                ondblclick={onSelect}
                onkeydown={handleKeyEvent}
                data-file-id={item.id}
                role="button"
                tabindex="-1"
            >
                <div class="thumb-col-detail" data-file-id={item.id}>
                    <div
                        class="thumb-entry-name draggable"
                        title={headerState.search.searching ? item.fullPath : item.name}
                        data-file-id={item.id}
                        onmousedown={colDetailMouseDown}
                        role="button"
                        tabindex="-1"
                    >
                        <div class="icon" class:folder={item.entityType == "Folder" || item.entityType == "SymlinkFolder"} class:hidden-folder={item.fileType == "HiddenFolder"} data-file-id={item.id}>
                            {#if item.linkPath}
                                <div class="symlink-icon"><div class="symlink-arrow"></div></div>
                            {/if}
                            {#if item.isFile}
                                {#if item.fileType == "Audio"}
                                    <AudioSvg />
                                {:else if item.fileType == "Video"}
                                    {#await toVideoThumbnail(item.fullPath)}
                                        <div style="width: 100px;height:90px;"></div>
                                    {:then data}
                                        <div class="cover">
                                            <div class="film"></div>
                                            <img src={data} class="thumbnail-video" alt="" loading="lazy" decoding="async" />
                                            <div class="film"></div>
                                        </div>
                                    {/await}
                                {:else if item.fileType == "Image"}
                                    {#await toImageThumbnail(item.fullPath)}
                                        <div style="width: 100px;height:90px;"></div>
                                    {:then data}
                                        <img src={data} class="thumbnail-img" alt="" loading="lazy" decoding="async" />
                                    {/await}
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
                        </div>
                        <div class="name" id={item.uuid} data-file-id={item.id} class:rename-hidden={renameState.targetUUID == item.uuid}>
                            {item.name}
                        </div>
                    </div>
                </div>
            </div>
        {/each}
    {/snippet}
    {#snippet empty()}{/snippet}
</VirtualList>
