<script lang="ts">
    import { appState, dispatch, listState } from "./appStateReducer.svelte";
    import { GRID_ITEM_WIDTH, handleKeyEvent, HOME, RECYCLE_BIN } from "../constants";
    import ListSvg from "../svg/ListSvg.svelte";
    import TileSvg from "../svg/TileSvg.svelte";

    let { clientWidth }: { clientWidth: number | undefined } = $props();

    const MB = 1024;
    const GB = 1.049e6;

    const toggleViewMode = () => {
        dispatch({ type: "toggleGridView", value: !$appState.isInGridView });
        if (clientWidth) {
            const chunkSize = $appState.isInGridView ? Math.floor(clientWidth / GRID_ITEM_WIDTH) : -1;
            dispatch({ type: "chunkSize", value: chunkSize });
        }
    };

    let fileCount = $derived.by(() => {
        if (!listState.files.length) return "";

        const fileCount = `${$appState.selection.selectedIds.length} / ${listState.files.length}`;

        return fileCount;
    });

    let fileSize = $derived.by(() => {
        if (!listState.files.length) return "";

        if (!$appState.selection.selectedIds.length) return "";

        const files = listState.files.filter((file) => $appState.selection.selectedIds.includes(file.id) && file.isFile);

        if (!files.length) return "";

        const size = files.map((file) => file.size).reduce((prev, current) => prev + current, 0);

        if (size >= GB) {
            return `${new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3, maximumFractionDigits: 2, roundingPriority: "morePrecision" }).format(size / GB)} GB`;
        }

        if (size >= MB) {
            return `${new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3, maximumFractionDigits: 2, roundingPriority: "morePrecision" }).format(size / MB)} MB`;
        }

        return `${new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3, maximumFractionDigits: 2, roundingPriority: "morePrecision" }).format(size)} KB`;
    });
</script>

<div class="bottom-bar">
    <div class="info-area">
        <div class="file-count">{fileCount}</div>
        <div class="file-size">{fileSize}</div>
    </div>
    <div class="mode-area">
        {#if $appState.isInGridView}
            <div
                class="button"
                class:disabled={listState.currentDir.fullPath == HOME || listState.currentDir.fullPath == RECYCLE_BIN}
                onclick={toggleViewMode}
                onkeydown={handleKeyEvent}
                role="button"
                tabindex="-1"
            >
                <ListSvg />
            </div>
        {:else}
            <div
                class="button"
                class:disabled={listState.currentDir.fullPath == HOME || listState.currentDir.fullPath == RECYCLE_BIN}
                onclick={toggleViewMode}
                onkeydown={handleKeyEvent}
                role="button"
                tabindex="-1"
            >
                <TileSvg />
            </div>
        {/if}
    </div>
</div>

<style>
    .bottom-bar {
        height: 25px;
        width: 100%;
        display: flex;
        justify-content: space-between;
        padding-bottom: 1px;
    }

    .info-area {
        display: flex;
        align-items: center;
        font-size: 12px;
        margin-left: 10px;
    }

    .mode-area {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 10px;
    }

    .file-count {
        margin-right: 15px;
    }

    .mode-area .button {
        padding: 3px 4px;
    }

    .mode-area .button:hover {
        outline: 1px solid var(--selection-border-color);
        background-color: var(--selection-bgcolor);
    }
</style>
