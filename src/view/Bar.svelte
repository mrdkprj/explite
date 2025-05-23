<script lang="ts">
    import { appState, dispatch } from "./appStateReducer";
    import { listState } from "./listStateReducer";
    import { handleKeyEvent, OS } from "../constants";
    import Launch from "../svg/Launch.svelte";
    import main from "../main";
    import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

    const MB = 1024;
    const GB = 1.049e6;

    const minimize = async () => {
        await WebviewWindow.getCurrent().minimize();
    };

    const toggleMaximize = async () => {
        await main.toggleMaximize(WebviewWindow.getCurrent());
        dispatch({ type: "isMaximized", value: !$appState.isMaximized });
    };

    const launchNew = async () => {
        await main.launchNew();
    };

    const close = async () => {
        await main.closeWindow(WebviewWindow.getCurrent());
    };

    let fileSize = $derived.by(() => {
        if (!$listState.files.length) return "";

        const fileCount = `${$appState.selection.selectedIds.length} / ${$listState.files.length}`;

        if (!$appState.selection.selectedIds.length) return fileCount;

        const size = $listState.files
            .filter((file) => $appState.selection.selectedIds.includes(file.id) && file.isFile)
            .map((file) => file.size)
            .reduce((prev, current) => prev + current, 0);

        if (size == 0) return "";

        if (size >= GB) {
            return `${fileCount} ${new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3, maximumFractionDigits: 2, roundingPriority: "morePrecision" }).format(size / GB)} GB`;
        }

        if (size >= MB) {
            return `${fileCount} ${new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3, maximumFractionDigits: 2, roundingPriority: "morePrecision" }).format(size / MB)} MB`;
        }

        return `${fileCount} ${new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3, maximumFractionDigits: 2, roundingPriority: "morePrecision" }).format(size)} KB`;
    });
</script>

<div class="title-bar" data-tauri-drag-region={navigator.userAgent.includes(OS.linux) ? true : null}>
    <div class="icon-area">
        <div class="button" onclick={launchNew} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <Launch />
        </div>
        <div class="file-count">{fileSize}</div>
    </div>
    <div class="title" data-tauri-drag-region={navigator.userAgent.includes(OS.linux) ? true : null}>
        {$listState.currentDir.paths.length ? $listState.currentDir.paths[$listState.currentDir.paths.length - 1] : ""}
    </div>
    <div class="window-area">
        <div class="minimize" onclick={minimize} onkeydown={handleKeyEvent} role="button" tabindex="-1">&minus;</div>
        <div class="maximize" onclick={toggleMaximize} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <div class:minbtn={$appState.isMaximized} class:maxbtn={!$appState.isMaximized}></div>
        </div>
        <div class="close" onclick={close} onkeydown={handleKeyEvent} role="button" tabindex="-1">&times;</div>
    </div>
</div>
