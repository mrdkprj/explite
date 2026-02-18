<script lang="ts">
    import { COLUMN_HEADER_HEIGHT, handleKeyEvent, HEADER_DIVIDER_WIDTh, LIST_ITEM_HEIGHT, RECYCLE_BIN } from "../constants";
    import Column from "./Column.svelte";
    import VirtualList from "./VirtualList.svelte";
    import { appState, columnState, listState, headerState, renameState } from "./appStateReducer.svelte";
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
        onColumnHeaderClick,
        colDetailMouseDown,
        columnHeaderChanged,
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
        onColumnHeaderClick: (e: MouseEvent) => void;
        colDetailMouseDown: (e: MouseEvent) => void;
        columnHeaderChanged: () => void;
        onScroll: () => Promise<void>;
    } = $props();

    const isRecycleBin = () => listState.currentDir.fullPath == RECYCLE_BIN;

    const shouldDisplayLabel = (key: Mp.SortKey) => {
        if (key == "directory" && (!headerState.search.searching || isRecycleBin())) return false;

        if (key == "ddate" && !isRecycleBin()) return false;

        if (key == "orig_path" && !isRecycleBin()) return false;

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
        <div class="list-header nofocus" onkeydown={handleKeyEvent} role="button" tabindex="-1">
            {#each columnState.columnLabels as label}
                {#if shouldDisplayLabel(label.sortKey)}
                    <Column {label} {onColumnHeaderClick} {columnHeaderChanged} />
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
            {#each columnState.columnLabels as label}
                {#if label.sortKey == "name"}
                    <div class="col-detail" data-file-id={item.id} style={$appState.autoAdjustColumn ? `width: ${columnState.adjustedWidths.name}px;` : `width: ${label.width}px;`}>
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
                {:else if label.sortKey == "directory"}
                    {#if headerState.search.searching && !isRecycleBin()}
                        <div
                            class="col-detail"
                            data-file-id={item.id}
                            style={$appState.autoAdjustColumn ? `width: ${columnState.adjustedWidths.directory + HEADER_DIVIDER_WIDTh}px;` : `width: ${label.width + HEADER_DIVIDER_WIDTh}px;`}
                        >
                            <div class="draggable" title={item.dir} data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">{item.dir}</div>
                        </div>
                    {/if}
                {:else if label.sortKey == "orig_path"}
                    {#if isRecycleBin()}
                        <div
                            class="col-detail"
                            data-file-id={item.id}
                            style={$appState.autoAdjustColumn ? `width: ${columnState.adjustedWidths.orig_path + HEADER_DIVIDER_WIDTh}px;` : `width: ${label.width + HEADER_DIVIDER_WIDTh}px;`}
                        >
                            <div class="draggable" title={item.originalPath} data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">{item.dir}</div>
                        </div>
                    {/if}
                {:else if label.sortKey == "ddate"}
                    {#if isRecycleBin()}
                        <div
                            class="col-detail"
                            data-file-id={item.id}
                            style={$appState.autoAdjustColumn ? `width: ${columnState.adjustedWidths.ddate + HEADER_DIVIDER_WIDTh}px;` : `width: ${label.width + HEADER_DIVIDER_WIDTh}px;`}
                        >
                            <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">
                                {item.ddateString}
                            </div>
                        </div>
                    {/if}
                {:else if label.sortKey == "extension"}
                    <div
                        class="col-detail"
                        data-file-id={item.id}
                        style={$appState.autoAdjustColumn ? `width: ${columnState.adjustedWidths.extension + HEADER_DIVIDER_WIDTh}px;` : `width: ${label.width + HEADER_DIVIDER_WIDTh}px;`}
                    >
                        <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">{item.extension}</div>
                    </div>
                {:else if label.sortKey == "mdate"}
                    <div
                        class="col-detail"
                        data-file-id={item.id}
                        style={$appState.autoAdjustColumn ? `width: ${columnState.adjustedWidths.mdate + HEADER_DIVIDER_WIDTh}px;` : `width: ${label.width + HEADER_DIVIDER_WIDTh}px;`}
                    >
                        <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">
                            {item.mdateString}
                        </div>
                    </div>
                {:else if label.sortKey == "cdate"}
                    <div
                        class="col-detail"
                        data-file-id={item.id}
                        style={$appState.autoAdjustColumn ? `width: ${columnState.adjustedWidths.cdate + HEADER_DIVIDER_WIDTh}px;` : `width: ${label.width + HEADER_DIVIDER_WIDTh}px;`}
                    >
                        <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">
                            {item.cdateString}
                        </div>
                    </div>
                {:else if label.sortKey == "size"}
                    <div
                        class="col-detail size"
                        data-file-id={item.id}
                        style={$appState.autoAdjustColumn ? `width: ${columnState.adjustedWidths.size + HEADER_DIVIDER_WIDTh}px;` : `width: ${label.width + HEADER_DIVIDER_WIDTh}px;`}
                    >
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
