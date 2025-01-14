<script lang="ts">
    import { handleKeyEvent } from "../constants";
    import AscSvg from "../svg/AscSvg.svelte";
    import DescSvg from "../svg/DescSvg.svelte";
    import { appState } from "./appStateReducer";

    let { label, onColSliderMousedown }: { label: Mp.HeaderLabel; onColSliderMousedown: (e: MouseEvent, key: Mp.SortKey) => void } = $props();

    const ROW_LEFT_MARGIN = 10;
    const DETAIL_PADDING = 10;
</script>

<div class="col-list-header" style="width: {label.width + ROW_LEFT_MARGIN + DETAIL_PADDING}px;">
    <div class="list-header-label nofocus" data-sort-key={label.sortKey}>
        {#if $appState.sort.key == label.sortKey}
            <div class="sort-indicator">
                {#if $appState.sort.asc}
                    <AscSvg />
                {:else}
                    <DescSvg />
                {/if}
            </div>
        {/if}
        <div class="nofocus" data-sort-key={label.sortKey}>{label.label}</div>
        <div class="divider nofocus" onmousedown={(e) => onColSliderMousedown(e, label.sortKey)} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <div class="line"></div>
        </div>
    </div>
</div>
