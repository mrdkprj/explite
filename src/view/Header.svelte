<script lang="ts">
    import BackSvg from "../svg/BackSvg.svelte";
    import FowardSvg from "../svg/FowardSvg.svelte";
    import UpwardSvg from "../svg/UpwardSvg.svelte";
    import PlusSvg from "../svg/PlusSvg.svelte";
    import NewFileSvg from "../svg/NewFileSvg.svelte";
    import NewFolderSvg from "../svg/NewFolderSvg.svelte";
    import NewSymLinkSvg from "../svg/NewSymLinkSvg.svelte";
    import PathDividerSvg from "../svg/PathDividerSvg.svelte";
    import ReloadSvg from "../svg/ReloadSvg.svelte";
    import ClearSvg from "../svg/ClearSvg.svelte";
    import ThreeDotsSvg from "../svg/ThreeDotsSvg.svelte";
    import DisplaySvg from "../svg/DisplaySvg.svelte";
    import { dispatch, listState, headerState } from "./appStateReducer.svelte";
    import { handleKeyEvent, HOME, RECYCLE_BIN, SEPARATOR } from "../constants";
    import util from "../util";
    import { path } from "../path";

    type Paths = {
        overflownPaths: string[];
        visiblePaths: string[];
        overflown: string;
    };

    let {
        startSearch,
        endSearch,
        goBack,
        goForward,
        goUpward,
        requestLoad,
        reload,
        createItem,
    }: {
        startSearch: () => void;
        endSearch: (refresh: boolean) => Promise<void>;
        goBack: () => void;
        goForward: () => void;
        goUpward: () => void;
        requestLoad: (fullPath: string, isFile: boolean, navigation: Mp.Navigation) => void;
        reload: (includeDrive: boolean) => void;
        createItem: (isFile: boolean, shortcut?: boolean) => void;
    } = $props();

    const COMPONENT_PADDINGS = 20;
    const COMPONENT_RIGHT_MARGIN = 5;
    const DIVIDER_WIDTH = 16;
    // border + display svg + divider + dots svg + divider + paddings + righ margin + click margin min-width
    const MIN_COMPONENT_WIDTH = 1 + 36 + DIVIDER_WIDTH + 36 + DIVIDER_WIDTH + COMPONENT_PADDINGS + COMPONENT_RIGHT_MARGIN + 100;

    let searchInterval = 0;
    let searchInput: HTMLInputElement;
    let canvas: HTMLCanvasElement;
    let pendingPath: string | null = null;

    let pathValue = $state("");
    let pathWidth = $state(0);
    let dropdownPosition = $state({ left: 0, top: 0 });
    let showHiddenPaths = $state(false);
    let showCreateDir = $state(false);
    let paths: Paths = $derived.by(() => {
        const _canvas = canvas || (canvas = document.createElement("canvas"));
        const context = _canvas.getContext("2d");
        if (!context) {
            return {
                visiblePaths: listState.currentDir.paths,
                overflownPaths: [],
                overflown: "",
            };
        }
        context.font = 'normal 14px "Segoe UI"';
        let width = 200;
        const _visiblePaths: string[] = [];
        const _overflownPaths: string[] = [];

        // Prevent listState update
        const paths = listState.currentDir.paths.slice();
        paths.reverse().forEach((path, index) => {
            const metrics = context.measureText(path);
            width += metrics.width + COMPONENT_PADDINGS + COMPONENT_RIGHT_MARGIN + DIVIDER_WIDTH;
            if (width > pathWidth && index > 0) {
                _overflownPaths.push(path);
            } else {
                _visiblePaths.push(path);
            }
        });

        const overflownPaths = _overflownPaths.reverse();

        return {
            visiblePaths: _visiblePaths.reverse(),
            overflownPaths,
            overflown: overflownPaths.join(SEPARATOR),
        };
    });

    const onSearchInputKeyDown = async (e: KeyboardEvent) => {
        if (e.key == "Enter") {
            e.preventDefault();
            e.stopPropagation();
            onSearchInput();
        }

        if (e.key == "Escape") {
            searchInput.blur();
            await endSearch(false);
        }
    };

    const onSearchInput = () => {
        if (searchInterval) {
            window.clearTimeout(searchInterval);
        }
        searchInterval = window.setTimeout(() => {
            if (headerState.search.key) {
                startSearch();
            } else {
                endSearch(false);
            }
        }, 300);
    };

    const setPathInputFocus = (node: HTMLInputElement) => {
        pathValue = listState.currentDir.fullPath == HOME || listState.currentDir.fullPath == RECYCLE_BIN ? "" : listState.currentDir.fullPath;
        node.value = pathValue;
        node.focus();
        node.setSelectionRange(0, pathValue.length);
    };

    const onPathMarginClick = () => {
        dispatch({ type: "pathEditing", value: true });
    };

    const onPathClick = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        const path = pendingPath ?? e.target.getAttribute("data-path");
        if (!path) return;

        if (pendingPath) {
            showHiddenPaths = false;
            pendingPath = null;
        }
        requestLoad(path, false, "PathSelect");
    };

    const onPathInputLeave = () => {
        dispatch({ type: "pathEditing", value: false });
    };

    const onPathInputKeyDown = (e: KeyboardEvent) => {
        if (e.key == "Enter") {
            e.preventDefault();
            e.stopPropagation();
            endPathEdit();
        }
    };

    const endPathEdit = async () => {
        if (pathValue && listState.currentDir.fullPath != pathValue) {
            const isFile = await util.isFile(pathValue);
            requestLoad(pathValue, isFile, "Direct");
        }
        dispatch({ type: "pathEditing", value: false });
    };

    export const focusSearchInput = () => {
        if (!hasSearchInputFocus()) {
            searchInput.focus();
        }

        if (searchInput.value) {
            // clear first
            searchInput.setSelectionRange(0, 0);
            searchInput.setSelectionRange(0, searchInput.value.length);
        }
    };

    export const hasSearchInputFocus = () => {
        return document.activeElement == searchInput;
    };

    const showHiddenPathsDialog = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        dropdownPosition = { left: e.target.offsetLeft, top: e.target.offsetHeight + 15 };
        showHiddenPaths = true;
    };

    const toggleHiddenPathDialog = (e: FocusEvent) => {
        const target = e.relatedTarget as HTMLElement;
        if (target) {
            // Don't hide until path click event is handled
            pendingPath = target.getAttribute("data-path");
            if (pendingPath) return;
        }
        showHiddenPaths = false;
    };

    const setPathDialogFocus = (node: HTMLDivElement) => {
        node.focus();
    };

    const showCreateDirDialog = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        dropdownPosition = { left: e.target.offsetLeft, top: e.target.offsetHeight + 5 };
        showCreateDir = true;
    };

    const setCreateDirDialogFocus = (node: HTMLDivElement) => {
        node.focus();
    };

    const hideCreateDirDialog = () => {
        showCreateDir = false;
    };

    const showSymlinkDialog = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dispatch({ type: "toggleCreateSymlink" });
    };

    const createText = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        createItem(true);
    };

    const createDir = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        createItem(false);
    };

    const dropdownMouseEvent = (e: MouseEvent) => {
        e.preventDefault();
    };

    const buildPaths = (upToCurrent: string[], before?: string) => {
        const current = upToCurrent.length == 1 && upToCurrent[0].endsWith(":") ? upToCurrent[0] + SEPARATOR : upToCurrent.join(SEPARATOR);
        return before ? path.join(before, current) : current;
    };

    const onkeydown = (e: KeyboardEvent) => {
        if (e.key == "Escape") {
            showHiddenPaths = false;
            showCreateDir = false;
        }
    };
</script>

<div class="header">
    <div class="btns">
        <div class="button {headerState.canGoBack ? '' : 'disabled'}" onclick={goBack} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <BackSvg />
        </div>
        <div class="button {headerState.canGoForward ? '' : 'disabled'}" onclick={goForward} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <FowardSvg />
        </div>
        <div class="button {headerState.canGoUpward ? '' : 'disabled'}" onclick={goUpward} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <UpwardSvg />
        </div>
        <div class="button {listState.currentDir.fullPath == HOME ? 'disabled' : ''}" onclick={() => reload(true)} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <ReloadSvg />
        </div>
        <div
            class="button {listState.currentDir.fullPath == HOME || headerState.search.searching ? 'disabled' : ''}"
            class:btn-active={showCreateDir}
            onclick={showCreateDirDialog}
            onkeydown={handleKeyEvent}
            role="button"
            tabindex="-1"
        >
            <PlusSvg />
            {#if showCreateDir}
                <div
                    class="header-dropdown"
                    style="top:{dropdownPosition.top}px;left:{dropdownPosition.left}px;"
                    use:setCreateDirDialogFocus
                    onblur={hideCreateDirDialog}
                    {onkeydown}
                    tabindex="0"
                    role="button"
                >
                    <div class="dropdown-data" onclick={createText} onmousedown={dropdownMouseEvent} onmouseup={dropdownMouseEvent} onkeydown={handleKeyEvent} role="button" tabindex="-1">
                        <div class="label-icon"><NewFileSvg /></div>
                        Text File
                    </div>
                    <div class="dropdown-data" onclick={createDir} onmousedown={dropdownMouseEvent} onmouseup={dropdownMouseEvent} onkeydown={handleKeyEvent} role="button" tabindex="-1">
                        <div class="label-icon"><NewFolderSvg /></div>
                        Directory
                    </div>
                    <div class="dropdown-data" onclick={showSymlinkDialog} onmousedown={dropdownMouseEvent} onmouseup={dropdownMouseEvent} onkeydown={handleKeyEvent} role="button" tabindex="-1">
                        <div class="label-icon"><NewSymLinkSvg /></div>
                        Shortcut
                    </div>
                </div>
            {/if}
        </div>
    </div>
    <div class="path-area" bind:offsetWidth={pathWidth}>
        {#if headerState.pathEditing}
            <input
                class="path-input"
                spellcheck="false"
                type="text"
                id="path"
                use:setPathInputFocus
                onblur={onPathInputLeave}
                bind:value={pathValue}
                onkeydown={onPathInputKeyDown}
                autocomplete="one-time-code"
            />
        {:else}
            <div class="path-holder">
                <div class="path">
                    <div class="display">
                        <DisplaySvg />
                    </div>
                    <PathDividerSvg />
                    {#if paths.overflownPaths.length}
                        <div class="button path-dots" class:btn-active={showHiddenPaths} onclick={showHiddenPathsDialog} onkeydown={handleKeyEvent} role="button" tabindex="-1">
                            <ThreeDotsSvg />
                        </div>
                        {#if showHiddenPaths}
                            <div
                                class="header-dropdown"
                                style="top:{dropdownPosition.top}px;left:{dropdownPosition.left}px;"
                                use:setPathDialogFocus
                                onblur={toggleHiddenPathDialog}
                                {onkeydown}
                                tabindex="0"
                                role="button"
                            >
                                {#each paths.overflownPaths as hiddenPath, index}
                                    {#if !util.isWsl(hiddenPath)}
                                        <div
                                            class="dropdown-data"
                                            data-path={buildPaths(paths.overflownPaths.slice(0, index + 1))}
                                            onclick={onPathClick}
                                            onkeydown={handleKeyEvent}
                                            role="button"
                                            tabindex="-1"
                                        >
                                            {hiddenPath}
                                        </div>
                                    {/if}
                                {/each}
                            </div>
                        {/if}
                    {/if}
                    {#each paths.visiblePaths as visiblePath, index}
                        {#if !util.isWsl(visiblePath)}
                            <div
                                class="path-data"
                                data-path={buildPaths(paths.visiblePaths.slice(0, index + 1), paths.overflown)}
                                onclick={onPathClick}
                                onkeydown={handleKeyEvent}
                                role="button"
                                tabindex="-1"
                                style="max-width:{pathWidth - MIN_COMPONENT_WIDTH}px"
                            >
                                {visiblePath}
                            </div>
                            <PathDividerSvg />
                        {/if}
                    {/each}
                    <div class="path-edit" onclick={onPathMarginClick} onkeydown={handleKeyEvent} role="button" tabindex="-1"></div>
                </div>
            </div>
        {/if}
    </div>
    <div class="search-area">
        <input
            class="search-input"
            class:without-clear={!headerState.search.searching}
            spellcheck="false"
            type="text"
            id="search"
            bind:this={searchInput}
            oninput={onSearchInput}
            bind:value={headerState.search.key}
            onfocus={focusSearchInput}
            onkeydown={onSearchInputKeyDown}
            disabled={listState.currentDir.fullPath == HOME}
            autocomplete="one-time-code"
        />
        {#if headerState.search.searching}
            <div class="clear-area">
                <div class="clear" onclick={() => endSearch(false)} onkeydown={handleKeyEvent} role="button" tabindex="-1">
                    <ClearSvg />
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .header {
        width: 100%;
        height: 50px;
        display: flex;
        justify-content: flex-start;
        align-items: center;
        box-shadow: 0px 1px 5px 1px var(--menu-shadow);
        background-color: var(--menu-bgcolor);
        z-index: 980;
        position: relative;
    }

    .path-area {
        flex: 1 1 0;
        height: 36px;
        margin: 0px 10px;
        max-width: calc(100% - 380px);
        width: calc(100% - 250px);
        min-width: 100px;
        display: flex;
        overflow: hidden;
        justify-content: end;
        border-radius: 5px;
    }

    .path-holder {
        flex: 1 1 auto;
    }

    .path {
        width: 100%;
        height: 32px;
        border-radius: 5px;
        font-family: var(--font);
        border: 2px solid transparent;
        display: flex;
        align-items: center;
        background-color: var(--path-bgcolor);
        cursor: default;
    }

    .path .display {
        padding: 5px 10px;
    }

    .path-data:first-child {
        margin-left: 10px;
    }

    .path-data {
        padding: 5px 10px;
        margin-right: 5px;
        white-space: nowrap;
        font-size: 14px;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .path-data:hover {
        background-color: var(--path-hover-color);
        border-radius: 4px;
    }

    .header-dropdown {
        position: absolute;
        z-index: 1000;
        background-color: var(--dialog-bgcolor);
        outline: 1px solid var(--dialog-border-color);
        border-radius: 5px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: start;
        padding: 0 5px 5px 5px;
        box-shadow: 3px 4px 5px var(--dialog-shadow);
    }

    .dropdown-data {
        position: relative;
        padding: 5px 10px;
        width: calc(100% - 20px);
        margin: 5px 0 0 0;
        font-size: 14px;
        white-space: nowrap;
        display: flex;
        align-items: center;
    }

    .dropdown-data .label-icon {
        margin-right: 10px;
        display: flex;
    }

    .path-dots {
        padding: 5px 10px;
        display: flex;
        align-items: center;
        height: 19px;
    }

    .path-dots:hover,
    .dropdown-data:hover {
        background-color: var(--path-hover-color);
        border-radius: 4px;
    }

    .path-edit {
        flex: 1 1 auto;
        height: 100%;
        min-width: 100px;
    }

    .path-input {
        line-height: 20px;
        white-space: nowrap;
        font-family: var(--font);
        font-size: 14px;
        padding: 0 5px 0 0;
        border-radius: 5px;
    }

    .header input,
    .header input:disabled {
        width: 100%;
        height: 30px;
        border-top-left-radius: 5px;
        border-bottom-left-radius: 5px;
        font-family: var(--font);
        border: 2px solid transparent;
        text-indent: 5px;
        font-size: 14px;
        background-color: var(--input-bgcolor);
        border-bottom: 2px solid transparent;
        color: var(--input-color);
    }

    .header .path-input:focus {
        outline: 1px solid var(--input-focus-outline);
        border-bottom: 2px solid var(--input-bottom-border);
    }

    .header .search-input:focus {
        outline: none;
    }

    .search-area {
        height: 36px;
        width: calc(100% - 430px);
        max-width: 250px;
        margin-left: 10px;
        margin-right: 10px;
        display: flex;
    }

    .search-area:has(> input:focus) {
        outline: 1px solid var(--input-focus-outline);
        border-bottom: 2px solid var(--input-bottom-border);
        border-radius: 5px;
    }

    .clear-area {
        width: 45px;
        height: 100%;
        background-color: var(--input-bgcolor);
        border-top-right-radius: 5px;
        border-bottom-right-radius: 5px;
        display: flex;
        align-items: center;
    }

    .clear {
        width: 25px;
        height: 25px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--input-bgcolor);
    }

    .clear:hover {
        background-color: var(--input-hover-color);
    }

    .without-clear {
        border-top-right-radius: 5px;
        border-bottom-right-radius: 5px;
    }
</style>
