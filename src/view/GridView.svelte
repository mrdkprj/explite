<script lang="ts">
    import { appState, listState, renameState, headerState } from "./appStateReducer.svelte";
    import { GRID_ITEM_HEIGHT, GRID_VERTICAL_MARGIN, handleKeyEvent, LARGE_ICON_SIZE } from "../constants";
    import VirtualList from "./VirtualList.svelte";
    import FileIcon from "./FileIcon.svelte";

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
        onScroll: () => Promise<void>;
    } = $props();

    const toChunk = () => {
        if (!fileListContainer) return [];

        const chunks = [];
        const files = listState.files;
        const chunkSize = listState.chunkSize;

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
    itemHeight={GRID_ITEM_HEIGHT}
    headerHeight={0}
    onRefresh={searchHighlight}
    thumbnail={true}
    vmargin={GRID_VERTICAL_MARGIN * 2}
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
                            <FileIcon {item} size={LARGE_ICON_SIZE} showThumbnail={true} />
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
