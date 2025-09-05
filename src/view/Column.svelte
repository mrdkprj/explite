<script lang="ts">
    import { handleKeyEvent } from "../constants";
    import AscSvg from "../svg/AscSvg.svelte";
    import DescSvg from "../svg/DescSvg.svelte";
    import { appState, dispatch } from "./appStateReducer";

    let { label, onColSliderMousedown, columnHeaderChanged }: { label: Mp.HeaderLabel; onColSliderMousedown: (e: MouseEvent, key: Mp.SortKey) => void; columnHeaderChanged: () => void } = $props();

    const ROW_LEFT_MARGIN = 10;
    const DETAIL_PADDING = 10;

    const startDragColumn = (e: DragEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        e.stopPropagation();
        dispatch({ type: "startDragColumn", value: e.target.id });
    };

    const onDropColumn = (e: DragEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        const sourceId = $appState.columnDragId;
        dispatch({ type: "endDragColumn" });

        if (!e.target.hasAttribute("data-column")) return;
        if (sourceId == e.target.id) return;

        e.preventDefault();
        e.stopPropagation();

        const headerLabels = structuredClone($appState.headerLabels);

        /* Remove directory label first */
        const dirLabelIndex = headerLabels.findIndex((label) => label.sortKey == "directory");
        const dirLabel = headerLabels.splice(dirLabelIndex, 1)[0];

        const sourceSortKey = atob(sourceId);
        const sourceIndex = headerLabels.findIndex((label) => label.sortKey == sourceSortKey);
        const source = headerLabels.splice(sourceIndex, 1)[0];

        const targetSortKey = atob(e.target.id);
        const targetIndex = headerLabels.findIndex((label) => label.sortKey == targetSortKey);
        const shouldAppend = targetIndex >= sourceIndex;
        headerLabels.splice(shouldAppend ? targetIndex + 1 : targetIndex, 0, source);

        /* Append directory label after name label */
        const nameLabelIndex = headerLabels.findIndex((label) => label.sortKey == "name");
        headerLabels.splice(nameLabelIndex + 1, 0, dirLabel);

        dispatch({ type: "headerLabels", value: headerLabels });
        columnHeaderChanged();
    };
</script>

<div class="col-list-header" style="width: {label.width + ROW_LEFT_MARGIN + DETAIL_PADDING}px;">
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
        <div class="divider nofocus" onmousedown={(e) => onColSliderMousedown(e, label.sortKey)} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <div class="line"></div>
        </div>
    </div>
</div>
