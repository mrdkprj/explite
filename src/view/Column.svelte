<script lang="ts">
    import { handleKeyEvent } from "../constants";
    import AscSvg from "../svg/AscSvg.svelte";
    import DescSvg from "../svg/DescSvg.svelte";
    import { appState, columnState, dispatch } from "./appStateReducer.svelte";

    let { label, onColumnHeaderClick, columnHeaderChanged }: { label: Mp.ColumnLabel; onColumnHeaderClick: (e: MouseEvent) => void; columnHeaderChanged: () => void } = $props();

    const ROW_LEFT_MARGIN = 10;
    const DETAIL_PADDING = 10;

    const onColSliderMousedown = (e: MouseEvent, key: Mp.SortKey) => {
        e.preventDefault();
        e.stopPropagation();
        dispatch({ type: "startSlide", value: { target: key, startX: e.clientX } });
    };

    const onSliderDblClick = (key: Mp.SortKey) => {
        dispatch({ type: "useCalculatedWidths", value: key });
    };

    const startDragColumn = (e: DragEvent) => {
        if (!$appState.allowMoveColumn) return;
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        e.stopPropagation();
        dispatch({ type: "startDrag", value: { id: e.target.id, type: "Column" } });
    };

    const onDropColumn = (e: DragEvent) => {
        if (!$appState.allowMoveColumn) return;
        if ($appState.dragHandler != "Column") return;
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        const sourceId = $appState.dragTargetId;
        dispatch({ type: "endDrag" });

        if (!e.target.hasAttribute("data-column")) return;
        if (sourceId == e.target.id) return;

        e.preventDefault();
        e.stopPropagation();

        const columnLabels = $state.snapshot(columnState.columnLabels);

        /* Remove directory label first */
        const dirLabelIndex = columnLabels.findIndex((label) => label.sortKey == "directory");
        const dirLabel = columnLabels.splice(dirLabelIndex, 1)[0];

        const sourceSortKey = atob(sourceId);
        const sourceIndex = columnLabels.findIndex((label) => label.sortKey == sourceSortKey);
        const source = columnLabels.splice(sourceIndex, 1)[0];

        const targetSortKey = atob(e.target.id);
        const targetIndex = columnLabels.findIndex((label) => label.sortKey == targetSortKey);
        const shouldAppend = targetIndex >= sourceIndex;
        columnLabels.splice(shouldAppend ? targetIndex + 1 : targetIndex, 0, source);

        /* Append directory label after name label */
        const nameLabelIndex = columnLabels.findIndex((label) => label.sortKey == "name");
        columnLabels.splice(nameLabelIndex + 1, 0, dirLabel);

        dispatch({ type: "columnLabels", value: columnLabels });
        columnHeaderChanged();
    };
</script>

<div class="col-list-header" onmouseup={onColumnHeaderClick} style="width: {label.width + ROW_LEFT_MARGIN + DETAIL_PADDING}px;" role="button" tabindex="-1">
    <div
        class="list-header-label nofocus"
        data-sort-key={label.sortKey}
        id={btoa(label.sortKey)}
        data-column
        draggable="true"
        ondragover={(e) => e.preventDefault()}
        ondragstart={startDragColumn}
        ondrop={onDropColumn}
        role="button"
        tabindex="-1"
    >
        {#if $appState.sort.key == label.sortKey}
            <div class="sort-indicator">
                {#if $appState.sort.asc}
                    <AscSvg />
                {:else}
                    <DescSvg />
                {/if}
            </div>
        {/if}
        <div class="nofocus" style="pointer-events: none;" data-sort-key={label.sortKey}>
            {label.label}
        </div>
        <div
            class="divider nofocus"
            onmousedown={(e) => onColSliderMousedown(e, label.sortKey)}
            ondblclick={() => onSliderDblClick(label.sortKey)}
            onkeydown={handleKeyEvent}
            role="button"
            tabindex="-1"
        >
            <div class="line"></div>
        </div>
    </div>
</div>
