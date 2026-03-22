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
                    <div class="col-detail" data-file-id={item.id} style="width: {column.width}px;">
                        <div
                            class="entry-name draggable"
                            title={headerState.search.searching ? item.fullPath : item.name}
                            data-file-id={item.id}
                            onmousedown={colDetailMouseDown}
                            role="button"
                            tabindex="-1"
                        >
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
