<script lang="ts">
    import { appState, dispatch } from "./appStateReducer";
    import { listState } from "./listStateReducer";
    import { handleKeyEvent } from "../constants";
    import Launch from "../svg/Launch.svelte";
    import main from "../main";
    import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

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
</script>

<div class="title-bar" data-tauri-drag-region style="user-select: none;">
    <div class="icon-area" data-tauri-drag-region>
        <div class="button" onclick={launchNew} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <Launch />
        </div>
        <div style="margin-left: 10px;">{$listState.files.length ? `${$appState.selection.selectedIds.length} / ${$listState.files.length}` : ""}</div>
    </div>
    <div class="title" data-tauri-drag-region>{$listState.currentDir.paths.length ? $listState.currentDir.paths[$listState.currentDir.paths.length - 1] : ""}</div>
    <div class="window-area">
        <div class="minimize" onclick={minimize} onkeydown={handleKeyEvent} role="button" tabindex="-1">&minus;</div>
        <div class="maximize" onclick={toggleMaximize} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <div class:minbtn={$appState.isMaximized} class:maxbtn={!$appState.isMaximized}></div>
        </div>
        <div class="close" onclick={close} onkeydown={handleKeyEvent} role="button" tabindex="-1">&times;</div>
    </div>
</div>
