<script lang="ts">
    import util from "../util";
    import { handleKeyEvent } from "../constants";
    import AscSvg from "../svg/AscSvg.svelte";
    import DescSvg from "../svg/DescSvg.svelte";
    import { appState, listState, dispatch, settings } from "./appStateReducer.svelte";

    let { column, onColumnHeaderClick, onColumnContextMenu }: { column: Mp.Column; onColumnHeaderClick: (e: MouseEvent) => void; onColumnContextMenu: (e: MouseEvent) => Promise<void> } = $props();

    const ROW_LEFT_MARGIN = 10;
    const DETAIL_PADDING = 10;

    const onColSliderMousedown = (e: MouseEvent, key: Mp.SortKey) => {
        e.preventDefault();
        e.stopPropagation();
        dispatch({ type: "startSlide", value: { target: key, startX: e.clientX } });
    };

    const onSliderDblClick = (key: Mp.SortKey) => {
        dispatch({ type: "adjustColumnWidth", value: key });
    };

    const startDragColumn = (e: DragEvent) => {
        if (!settings.data.allowMoveColumn) return;
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        e.stopPropagation();
        dispatch({ type: "startDrag", value: { id: e.target.id, type: "Column" } });
    };

    const onDropColumn = (e: DragEvent) => {
        if (!settings.data.allowMoveColumn) return;
        if ($appState.dragHandler != "Column") return;
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        const sourceId = $appState.dragTargetId;
        dispatch({ type: "endDrag" });

        if (!e.target.hasAttribute("data-column")) return;
        if (sourceId == e.target.id) return;

        e.preventDefault();
        e.stopPropagation();

        const columns = $state.snapshot(listState.columns);

        /* Remove directory column first */
        const dircolumnIndex = columns.findIndex((column) => column.sortKey == "directory");
        const dircolumn = columns.splice(dircolumnIndex, 1)[0];

        const sourceSortKey = atob(sourceId);
        const sourceIndex = columns.findIndex((column) => column.sortKey == sourceSortKey);
        const source = columns.splice(sourceIndex, 1)[0];

        const targetSortKey = atob(e.target.id);
        const targetIndex = columns.findIndex((column) => column.sortKey == targetSortKey);
        const shouldAppend = targetIndex >= sourceIndex;
        columns.splice(shouldAppend ? targetIndex + 1 : targetIndex, 0, source);

        /* Append directory column after name column */
        const namecolumnIndex = columns.findIndex((column) => column.sortKey == "name");
        columns.splice(namecolumnIndex + 1, 0, dircolumn);

        dispatch({ type: "columns", value: columns });
    };
</script>

{#if column.visible}
    <div class="col-list-header" onmouseup={onColumnHeaderClick} oncontextmenu={onColumnContextMenu} style="width: {column.width + ROW_LEFT_MARGIN + DETAIL_PADDING}px;" role="button" tabindex="-1">
        <div
            class="list-header-column"
            data-sort-key={column.sortKey}
            id={btoa(column.sortKey)}
            data-column
            draggable="true"
            ondragover={(e) => e.preventDefault()}
            ondragstart={startDragColumn}
            ondrop={onDropColumn}
            role="button"
            tabindex="-1"
        >
            {#if listState.sortType.key == column.sortKey}
                <div class="sort-indicator">
                    {#if listState.sortType.asc}
                        <AscSvg />
                    {:else}
                        <DescSvg />
                    {/if}
                </div>
            {/if}
            <div data-sort-key={column.sortKey}>
                {util.getColumnLabel(column.sortKey)}
            </div>
            <div
                class="divider"
                onmousedown={(e) => onColSliderMousedown(e, column.sortKey)}
                ondblclick={() => onSliderDblClick(column.sortKey)}
                onkeydown={handleKeyEvent}
                role="button"
                tabindex="-1"
            >
                <div class="line"></div>
            </div>
        </div>
    </div>
{/if}
