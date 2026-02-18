<script lang="ts">
    import DriveSvg from "../svg/DriveSvg.svelte";
    import FolderSvg from "../svg/FolderSvg.svelte";
    import RecycleSvg from "../svg/RecycleSvg.svelte";
    import DirDesktopSvg from "../svg/DirDesktopSvg.svelte";
    import DirDocumentsSvg from "../svg/DirDocumentsSvg.svelte";
    import DirDownloadsSvg from "../svg/DirDownloadsSvg.svelte";
    import DirMusicSvg from "../svg/DirMusicSvg.svelte";
    import DirImageSvg from "../svg/DirImageSvg.svelte";
    import DirVideoSvg from "../svg/DirVideoSvg.svelte";
    import LinuxSvg from "../svg/LinuxSvg.svelte";
    import { appState, dispatch, driveState, listState } from "./appStateReducer.svelte";
    import { handleKeyEvent, HOME, RECYCLE_BIN } from "../constants";

    let {
        requestLoad,
        changeFavorites,
        onFavoriteContextMenu,
    }: { requestLoad: (fullPath: string, isFile: boolean, navigation: Mp.Navigation) => void; changeFavorites: () => void; onFavoriteContextMenu: (e: MouseEvent) => Promise<void> } = $props();

    const onContextMenu = async (e: MouseEvent) => {
        e.preventDefault();
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        const hoverFavoriteId = e.target.getAttribute("data-id") ?? "";
        dispatch({ type: "hoverFavoriteId", value: hoverFavoriteId });
        await onFavoriteContextMenu(e);
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

        const favorites = $state.snapshot(driveState.favorites);

        const sourceIndex = favorites.findIndex((label) => label.id == sourceId);
        const source = favorites.splice(sourceIndex, 1)[0];

        const targetIndex = favorites.findIndex((label) => label.id == targetId);
        const shouldAppend = targetIndex >= sourceIndex;
        favorites.splice(shouldAppend ? targetIndex + 1 : targetIndex, 0, source);
        dispatch({ type: "changeFavorites", value: favorites });
        changeFavorites();
    };
</script>

<div class="left" style="flex-basis: {driveState.leftWidth}px">
    <div class="left-content" ondragover={(e) => e.preventDefault()} role="button" tabindex="-1">
        {#each driveState.favorites as favorite}
            <div
                data-id={favorite.id}
                data-full-path={favorite.fullPath}
                class="fav"
                class:current={favorite.fullPath == listState.currentDir.fullPath}
                onclick={onDriveClick}
                onkeydown={handleKeyEvent}
                oncontextmenu={onContextMenu}
                ondragstart={startDragFavorite}
                ondrop={onDropFavorite}
                role="button"
                tabindex="-1"
                draggable="true"
            >
                <div class="icon folder">
                    {#if favorite.fileType == "Desktop"}
                        <DirDesktopSvg />
                    {:else if favorite.fileType == "Documents"}
                        <DirDocumentsSvg />
                    {:else if favorite.fileType == "Downloads"}
                        <DirDownloadsSvg />
                    {:else if favorite.fileType == "Music"}
                        <DirMusicSvg />
                    {:else if favorite.fileType == "Pictures"}
                        <DirImageSvg />
                    {:else if favorite.fileType == "Videos"}
                        <DirVideoSvg />
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
            <div class="name">{HOME}</div>
        </div>
        {#each driveState.drives as disk}
            <div data-full-path={disk.path} class="disk" class:current={disk.path == listState.currentDir.fullPath} onclick={onDriveClick} onkeydown={handleKeyEvent} role="button" tabindex="-1">
                {#if disk.virtual}
                    <div class="icon">
                        <LinuxSvg />
                    </div>
                    <div class="name">{disk.name}</div>
                {:else}
                    <div class="icon">
                        <DriveSvg />
                    </div>
                    <div class="name">{disk.name}({disk.label})</div>
                {/if}
            </div>
        {/each}
    </div>
    <div class="recycle-bin">
        <div data-full-path={RECYCLE_BIN} class="disk" class:current={RECYCLE_BIN == listState.currentDir.fullPath} onclick={onDriveClick} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <div class="icon">
                <RecycleSvg />
            </div>
            <div class="name">{RECYCLE_BIN}</div>
        </div>
    </div>
</div>
