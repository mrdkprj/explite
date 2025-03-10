<script lang="ts">
    import DriveSvg from "../svg/DriveSvg.svelte";
    import FolderSvg from "../svg/FolderSvg.svelte";
    import { appState, dispatch } from "./appStateReducer";
    import { listState } from "./listStateReducer";
    import { handleKeyEvent, HOME } from "../constants";
    import main from "../main";

    let { requestLoad }: { requestLoad: (fullPath: string, isFile: boolean, navigation: Mp.Navigation) => void } = $props();

    const onAreaSliderMousedown = (e: MouseEvent) => {
        e.preventDefault();
        dispatch({ type: "startSlide", value: { target: "Area", startX: e.clientX } });
    };

    const onFavoriteContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        const hoverFavoriteId = e.target.getAttribute("data-id") ?? "";
        dispatch({ type: "hoverFavoriteId", value: hoverFavoriteId });
        main.openFavContextMenu({ x: e.screenX, y: e.screenY });
    };

    const onDriveClick = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        const fullPath = e.target.getAttribute("data-full-path");
        if (!fullPath) return;
        requestLoad(fullPath, false, "Direct");
    };
</script>

<div class="left" style="width: {$appState.leftWidth}px">
    <div class="left-content">
        {#each $appState.favorites as favorite}
            <div
                data-id={favorite.id}
                data-full-path={favorite.fullPath}
                class="fav"
                class:current={favorite.fullPath == $listState.currentDir.fullPath}
                onclick={onDriveClick}
                onkeydown={handleKeyEvent}
                oncontextmenu={onFavoriteContextMenu}
                role="button"
                tabindex="-1"
            >
                <div>
                    <FolderSvg />
                </div>
                <div>{favorite.name}</div>
            </div>
        {/each}
    </div>
    <div class="left-content">
        <div data-full-path={HOME} class="disk" onclick={onDriveClick} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <div>
                <DriveSvg />
            </div>
            <div>PC</div>
        </div>
        {#each $appState.disks as disk}
            <div data-full-path={disk.path} class="disk" class:current={disk.path == $listState.currentDir.fullPath} onclick={onDriveClick} onkeydown={handleKeyEvent} role="button" tabindex="-1">
                <div>
                    <DriveSvg />
                </div>
                <div>{disk.name}({disk.label})</div>
            </div>
        {/each}
    </div>
    <div class="divider" onmousedown={onAreaSliderMousedown} onkeydown={handleKeyEvent} role="button" tabindex="-1">
        <div class="line"></div>
    </div>
</div>
