<script lang="ts">
    import DriveSvg from "../svg/DriveSvg.svelte";
    import FolderSvg from "../svg/FolderSvg.svelte";
    import DirDesktop from "../svg/DirDesktop.svelte";
    import DirDocuments from "../svg/DirDocuments.svelte";
    import DirDownloads from "../svg/DirDownloads.svelte";
    import DirMusic from "../svg/DirMusic.svelte";
    import DirImage from "../svg/DirImage.svelte";
    import DirVideo from "../svg/DirVideo.svelte";
    import { appState, dispatch } from "./appStateReducer";
    import { listState } from "./listStateReducer";
    import { handleKeyEvent, HOME } from "../constants";
    import main from "../main";

    let { requestLoad, changeFavorites }: { requestLoad: (fullPath: string, isFile: boolean, navigation: Mp.Navigation) => void; changeFavorites: () => void } = $props();

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

    const startDragFavorite = (e: DragEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        e.stopPropagation();
        dispatch({ type: "startDrag", value: { id: e.target.getAttribute("data-id") ?? "", type: "Favorite" } });
    };

    const onDropFavorite = (e: DragEvent) => {
        if ($appState.dragHandler != "Favorite") return;
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        const sourceId = $appState.dragTargetId;
        const targetId = e.target.getAttribute("data-id") ?? "";
        dispatch({ type: "endDrag" });

        if (!e.target.classList.contains("fav")) return;
        if (sourceId == e.target.id) return;

        e.preventDefault();
        e.stopPropagation();

        const favorites = structuredClone($appState.favorites);

        const sourceIndex = favorites.findIndex((label) => label.id == sourceId);
        const source = favorites.splice(sourceIndex, 1)[0];

        const targetIndex = favorites.findIndex((label) => label.id == targetId);
        const shouldAppend = targetIndex >= sourceIndex;
        favorites.splice(shouldAppend ? targetIndex + 1 : targetIndex, 0, source);
        dispatch({ type: "changeFavorites", value: favorites });
        changeFavorites();
    };
</script>

<div class="left" style="flex-basis: {$appState.leftWidth}px">
    <div class="left-content" ondragover={(e) => e.preventDefault()} role="button" tabindex="-1">
        {#each $appState.favorites as favorite}
            <div
                data-id={favorite.id}
                data-full-path={favorite.fullPath}
                class="fav"
                class:current={favorite.fullPath == $listState.currentDir.fullPath}
                onclick={onDriveClick}
                onkeydown={handleKeyEvent}
                oncontextmenu={onFavoriteContextMenu}
                ondragstart={startDragFavorite}
                ondrop={onDropFavorite}
                role="button"
                tabindex="-1"
                draggable="true"
            >
                <div class="icon folder">
                    {#if favorite.fileType == "Desktop"}
                        <DirDesktop />
                    {:else if favorite.fileType == "Documents"}
                        <DirDocuments />
                    {:else if favorite.fileType == "Downloads"}
                        <DirDownloads />
                    {:else if favorite.fileType == "Music"}
                        <DirMusic />
                    {:else if favorite.fileType == "Pictures"}
                        <DirImage />
                    {:else if favorite.fileType == "Videos"}
                        <DirVideo />
                    {:else}
                        <FolderSvg />
                    {/if}
                </div>
                <div class="name">{favorite.name}</div>
            </div>
        {/each}
    </div>
    <div class="left-content">
        <div data-full-path={HOME} class="disk" onclick={onDriveClick} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <div class="icon">
                <DriveSvg />
            </div>
            <div class="name">PC</div>
        </div>
        {#each $appState.drives as disk}
            <div data-full-path={disk.path} class="disk" class:current={disk.path == $listState.currentDir.fullPath} onclick={onDriveClick} onkeydown={handleKeyEvent} role="button" tabindex="-1">
                <div class="icon">
                    <DriveSvg />
                </div>
                <div class="name">{disk.name}({disk.label})</div>
            </div>
        {/each}
    </div>
    <div class="divider" onmousedown={onAreaSliderMousedown} onkeydown={handleKeyEvent} role="button" tabindex="-1">
        <div class="line"></div>
    </div>
</div>
