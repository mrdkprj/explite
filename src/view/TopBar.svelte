<script lang="ts">
    import { appState, dispatch, listState } from "./appStateReducer.svelte";
    import { handleKeyEvent, OS } from "../constants";
    import LaunchSvg from "../svg/LaunchSvg.svelte";
    import PrefSvg from "../svg/PrefSvg.svelte";

    let { minimize, toggleMaximize, launchNew, close }: { minimize: () => Promise<void>; toggleMaximize: () => Promise<void>; launchNew: () => Promise<void>; close: () => Promise<void> } = $props();

    const displayPreference = () => {
        dispatch({ type: "togglePreference" });
    };
</script>

<div class="title-bar" data-tauri-drag-region={navigator.userAgent.includes(OS.linux) ? true : null}>
    <div class="icon-area no-drag">
        <div class="button no-drag" class:disabled={$appState.symlinkVisible} onclick={displayPreference} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <PrefSvg />
        </div>
        <div class="button no-drag" onclick={launchNew} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <LaunchSvg />
        </div>
    </div>
    <div class="title" data-tauri-drag-region={navigator.userAgent.includes(OS.linux) ? true : null}>
        {listState.currentDir.paths.length ? listState.currentDir.paths[listState.currentDir.paths.length - 1] : ""}
    </div>
    <div class="window-area">
        <div class="minimize" onclick={minimize} onkeydown={handleKeyEvent} role="button" tabindex="-1">&minus;</div>
        <div class="maximize" onclick={toggleMaximize} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <div class:minbtn={$appState.isMaximized} class:maxbtn={!$appState.isMaximized}></div>
        </div>
        <div class="close" onclick={close} onkeydown={handleKeyEvent} role="button" tabindex="-1">&times;</div>
    </div>
</div>
