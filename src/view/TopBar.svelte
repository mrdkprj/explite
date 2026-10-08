<script lang="ts">
    import { listState, settings } from "./appStateReducer.svelte";
    import { handleKeyEvent } from "../constants";
    import LaunchSvg from "../svg/LaunchSvg.svelte";
    import TabControl from "./TabControl.svelte";
    import util from "../util";
    import { IPCBase } from "../ipc";

    const ipc = new IPCBase();

    let {
        label,
        minimize,
        toggleMaximize,
        openInNew,
        close,
    }: { label: string; minimize: () => Promise<void>; toggleMaximize: () => Promise<void>; openInNew: (tab: boolean, fullPath?: string) => Promise<void>; close: () => Promise<void> } = $props();

    let mayDragWindow = false;

    const onmousedown = async (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        if (e.target.classList.contains("drag-region")) {
            mayDragWindow = true;
        }
    };

    const dragWindow = (e: DragEvent) => {
        e.preventDefault();
        if (mayDragWindow) {
            ipc.invoke("tab_request", { name: "startDrag" });
            mayDragWindow = false;
        }
    };

    const onmouseup = () => {
        mayDragWindow = false;
    };

    const onDblClick = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        if (e.target.classList.contains("drag-region")) {
            toggleMaximize();
        }
    };
</script>

<div
    class="title-bar"
    class:no-bottom-border={settings.data.tabMode}
    draggable="true"
    {onmousedown}
    {onmouseup}
    ondblclick={onDblClick}
    ondragstart={dragWindow}
    onkeydown={handleKeyEvent}
    role="button"
    tabindex="-1"
>
    <div class="titlebar-drag-region"></div>
    <div class="titlebar-left" class:drag-region={util.isLinux()}>
        <div class="icon-area">
            <div style="width:20px;height:20px;" class:drag-region={util.isLinux()} {onmousedown} {onmouseup} onkeydown={handleKeyEvent} role="button" tabindex="-1"></div>
            {#if !settings.data.tabMode}
                <div class="button no-drag" onclick={() => openInNew(false)} onkeydown={handleKeyEvent} role="button" tabindex="-1">
                    <LaunchSvg />
                </div>
            {/if}
        </div>
    </div>
    <div class="titlebar-center" class:drag-region={util.isLinux()} class:align-center={!settings.data.tabMode} class:align-bottom={settings.data.tabMode}>
        {#if settings.data.tabMode}
            <TabControl {label} addTab={() => openInNew(true)} />
        {:else}
            <div class="title" class:drag-region={util.isLinux()} {onmousedown} {onmouseup} ondragstart={dragWindow} draggable="true" role="button" tabindex="-1">
                {listState.currentDir.paths.length ? listState.currentDir.paths[listState.currentDir.paths.length - 1] : ""}
            </div>
        {/if}
    </div>
    <div class="titlebar-right" class:drag-region={util.isLinux()} class:app-draggable={settings.data.tabMode}></div>
    <div class="window-area">
        <div class="minimize" onclick={minimize} onkeydown={handleKeyEvent} role="button" tabindex="-1">&minus;</div>
        <div class="maximize" onclick={toggleMaximize} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <div class:minbtn={settings.data.isMaximized} class:maxbtn={!settings.data.isMaximized}></div>
        </div>
        <div class="close" onclick={close} onkeydown={handleKeyEvent} role="button" tabindex="-1">&times;</div>
    </div>
</div>

<style>
    .no-bottom-border {
        border-bottom: none;
    }

    .align-center {
        align-items: center;
        width: 60%;
    }

    .align-bottom {
        align-items: flex-end;
        width: 80%;
        flex: 1 1 auto;
        max-width: stretch;
        max-width: -webkit-fill-available;
        justify-content: flex-start;
    }

    .app-draggable {
        justify-content: flex-start;
        width: 10%;
        -webkit-app-region: drag;
    }
</style>
