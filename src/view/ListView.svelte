<script lang="ts">
    import { COLUMN_HEADER_HEIGHT, handleKeyEvent, HEADER_DIVIDER_WIDTh, LIST_ITEM_HEIGHT } from "../constants";
    import Column from "./Column.svelte";
    import VirtualList from "./VirtualList.svelte";
    import { appState, listState, headerState, renameState } from "./appStateReducer.svelte";
    import FileIcon from "./FileIcon.svelte";
    import path from "../path";

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
        onColumnHeaderClick,
        colDetailMouseDown,
        onScroll,
        onColumnContextMenu,
        toggleExpand,
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
        onColumnHeaderClick: (e: MouseEvent) => void;
        colDetailMouseDown: (e: MouseEvent) => void;
        onScroll: () => Promise<void>;
        onColumnContextMenu: (e: MouseEvent) => Promise<void>;
        toggleExpand: (e: Mp.MediaFile, expand: boolean) => void;
    } = $props();

    const shouldDisplayColumn = (key: Mp.SortKey) => {
        if (key == "directory" && (!headerState.search.searching || listState.isRecycleBin)) return false;

        if (key == "ddate" && !listState.isRecycleBin) return false;

        if (key == "orig_path" && !listState.isRecycleBin) return false;

        return true;
    };
</script>

<VirtualList
    items={listState.files}
    bind:this={virtualList}
    bind:viewport={fileListContainer}
    bind:start={visibleStartIndex}
    bind:end={visibleEndIndex}
    itemHeight={LIST_ITEM_HEIGHT}
    headerHeight={COLUMN_HEADER_HEIGHT}
    onRefresh={searchHighlight}
    {onScroll}
>
    {#snippet header()}
        <div class="list-header" onkeydown={handleKeyEvent} role="button" tabindex="-1">
            {#each listState.columns as column}
                {#if shouldDisplayColumn(column.sortKey)}
                    <Column {column} {onColumnHeaderClick} {onColumnContextMenu} />
                {/if}
            {/each}
        </div>
    {/snippet}
    {#snippet item(item)}
        <div
            id={item.id}
            class="row selectable"
            draggable="true"
            class:selected={$appState.selection.selectedIds.includes(item.id)}
            class:being-selected={$appState.selection.selectedId == item.id}
            class:cut={$appState.copyCutTargets.ids.includes(item.id) && $appState.copyCutTargets.op == "Move"}
            class:drag-highlight={!item.isFile && $appState.dragTargetId == item.id}
            class:dragging={$appState.dragging}
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
            {#each listState.columns as column}
                {#if column.sortKey == "name"}
                    <div class="col-detail" data-file-id={item.id} style="width: {column.width - 20 * (item.treeState?.level ?? 0)}px; margin-left: {20 * (item.treeState?.level ?? 0)}px;">
                        <div
                            class="entry-name draggable"
                            title={headerState.search.searching ? item.fullPath : item.name}
                            data-file-id={item.id}
                            onmousedown={colDetailMouseDown}
                            role="button"
                            tabindex="-1"
                        >
                            {#if $appState.isTreeview && !listState.isRecycleBin}
                                {#if item.entityType == "Folder" || item.entityType == "SymlinkFolder"}
                                    <div class="exp" onclick={() => toggleExpand(item, !item.treeState?.opened)} onkeydown={handleKeyEvent} data-file-id={item.id} role="button" tabindex="-1">
                                        {#if item.treeState?.opened}
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-caret-down-fill" viewBox="0 0 16 16">
                                                <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z" />
                                            </svg>
                                        {:else}
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-caret-right-fill" viewBox="0 0 16 16">
                                                <path d="m12.14 8.753-5.482 4.796c-.646.566-1.658.106-1.658-.753V3.204a1 1 0 0 1 1.659-.753l5.48 4.796a1 1 0 0 1 0 1.506z" />
                                            </svg>
                                        {/if}
                                    </div>
                                {:else}
                                    <div class="padder"></div>
                                {/if}
                            {/if}
                            <div
                                class="icon"
                                class:folder={item.entityType == "Folder" || item.entityType == "SymlinkFolder"}
                                class:hidden-folder={item.fileType == "HiddenFolder"}
                                data-file-id={item.id}
                            >
                                {#if item.linkPath}
                                    <div class="symlink-icon"><div class="symlink-arrow"></div></div>
                                {/if}
                                <FileIcon {item} size={16} showThumbnail={false} />
                            </div>
                            <div class="name" id={item.uuid} data-file-id={item.id} class:rename-hidden={renameState.targetUUID == item.uuid}>
                                {item.name}
                            </div>
                        </div>
                    </div>
                {:else if column.sortKey == "directory"}
                    {#if headerState.search.searching && !listState.isRecycleBin}
                        <div class="col-detail" data-file-id={item.id} style="width: {column.width + HEADER_DIVIDER_WIDTh}px;">
                            <div class="draggable" title={item.dir} data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">{item.dir}</div>
                        </div>
                    {/if}
                {:else if column.sortKey == "orig_path" && column.visible}
                    {#if listState.isRecycleBin}
                        <div class="col-detail" data-file-id={item.id} style="width: {column.width + HEADER_DIVIDER_WIDTh}px;">
                            <div class="draggable" title={item.originalPath} data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">{path.dirname(item.originalPath)}</div>
                        </div>
                    {/if}
                {:else if column.sortKey == "ddate" && column.visible}
                    {#if listState.isRecycleBin}
                        <div class="col-detail" data-file-id={item.id} style="width: {column.width + HEADER_DIVIDER_WIDTh}px;">
                            <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">
                                {item.ddateString}
                            </div>
                        </div>
                    {/if}
                {:else if column.sortKey == "extension" && column.visible}
                    <div class="col-detail" data-file-id={item.id} style="width: {column.width + HEADER_DIVIDER_WIDTh}px;">
                        <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">{item.extension}</div>
                    </div>
                {:else if column.sortKey == "mdate" && column.visible}
                    <div class="col-detail" data-file-id={item.id} style="width: {column.width + HEADER_DIVIDER_WIDTh}px;">
                        <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">
                            {item.mdateString}
                        </div>
                    </div>
                {:else if column.sortKey == "cdate" && column.visible}
                    <div class="col-detail" data-file-id={item.id} style="width: {column.width + HEADER_DIVIDER_WIDTh}px;">
                        <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">
                            {item.cdateString}
                        </div>
                    </div>
                {:else if column.sortKey == "size" && column.visible}
                    <div class="col-detail size" data-file-id={item.id} style="width: {column.width + HEADER_DIVIDER_WIDTh}px;">
                        <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">
                            {item.size > 0 || (item.size == 0 && item.isFile) ? item.sizeString : ""}
                        </div>
                    </div>
                {/if}
            {/each}
        </div>
    {/snippet}
    {#snippet empty()}{/snippet}
</VirtualList>

<style>
    .exp {
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .padder {
        min-width: 15px;
        height: 10px;
    }
    .exp svg {
        width: 10px;
        height: 10px;
    }
</style>
