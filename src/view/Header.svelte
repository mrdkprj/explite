<script lang="ts">
    import BackSvg from "../svg/BackSvg.svelte";
    import FowardSvg from "../svg/FowardSvg.svelte";
    import NewFileSvg from "../svg/NewFileSvg.svelte";
    import NewFolderSvg from "../svg/NewFolderSvg.svelte";
    import PathDividerSvg from "../svg/PathDividerSvg.svelte";
    import ReloadSvg from "../svg/ReloadSvg.svelte";
    import ClearSvg from "../svg/ClearSvg.svelte";
    import ThreeDots from "../svg/ThreeDots.svelte";
    import Display from "../svg/Display.svelte";
    import { appState, dispatch } from "./appStateReducer";
    import { listState } from "./listStateReducer";
    import { handleKeyEvent, HOME, SEPARATOR } from "../constants";

    type Paths = {
        overflownPaths: string[];
        visiblePaths: string[];
    };

    let {
        startSearch,
        endSearch,
        goBack,
        goForward,
        requestLoad,
        reload,
        createItem,
    }: {
        startSearch: () => void;
        endSearch: (refresh: boolean) => Promise<void>;
        goBack: () => Promise<void>;
        goForward: () => Promise<void>;
        requestLoad: (fullPath: string, isFile: boolean, navigation: Mp.Navigation) => void;
        reload: (includeDrive: boolean) => void;
        createItem: (isFile: boolean) => void;
    } = $props();

    let searchInterval = 0;
    let searchInput: HTMLInputElement;
    let canvas: HTMLCanvasElement;
    let pendingPath: string | null = null;

    let pathValue = $state("");
    let pathWidth = $state(0);
    let dialogPosition = $state({ left: 0, top: 0 });
    let showHiddenPaths = $state(false);
    let paths: Paths = $derived.by(() => {
        const padding = 25;
        const separator = 16;
        const _canvas = canvas || (canvas = document.createElement("canvas"));
        const context = _canvas.getContext("2d");
        if (!context) {
            return {
                visiblePaths: $listState.currentDir.paths,
                overflownPaths: [],
            };
        }
        context.font = 'normal 14px "Segoe UI"';
        let width = 200;
        const _visiblePaths: string[] = [];
        const _overflownPaths: string[] = [];

        // Prevent listState update
        const paths = $listState.currentDir.paths.slice();
        paths.reverse().forEach((path, index) => {
            const metrics = context.measureText(path);
            width += metrics.width + padding + separator;
            if (width > pathWidth && index > 0) {
                _overflownPaths.push(path);
            } else {
                _visiblePaths.push(path);
            }
        });

        return {
            visiblePaths: _visiblePaths.reverse(),
            overflownPaths: _overflownPaths.reverse(),
        };
    });

    // Border + 2 icons + 2 dividers + paddings + righ margin + click margin
    const MIN_COMPONENT_WIDTH = 1 + 36 + 16 + 36 + 16 + 20 + 5 + 100;

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
            if ($appState.search.key) {
                startSearch();
            } else {
                endSearch(false);
            }
        }, 300);
    };

    const setPathInputFocus = (node: HTMLInputElement) => {
        pathValue = $listState.currentDir.fullPath == HOME ? "" : $listState.currentDir.fullPath;
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

        const tempPath = $listState.currentDir.paths.slice(0, $listState.currentDir.paths.indexOf(path) + 1).join(SEPARATOR);
        const targetPath = tempPath.endsWith(":") ? `${tempPath}${SEPARATOR}` : tempPath;

        requestLoad(targetPath, false, "PathSelect");
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

    const endPathEdit = () => {
        if (pathValue && $listState.currentDir.fullPath != pathValue) {
            requestLoad(pathValue, false, "Direct");
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
        // extract half of header from clientY
        dialogPosition = { left: e.clientX, top: e.clientY - 15 };
        showHiddenPaths = true;
    };

    const toggleHiddenPathDialog = (e: FocusEvent) => {
        const target = e.relatedTarget as HTMLElement;
        if (target) {
            // Don't hide until path click event is handled
            pendingPath = target.getAttribute("data-path");
            if (pendingPath) return;
        }
        showHiddenPaths = !showHiddenPaths;
    };

    const setPathDialogFocus = (node: HTMLDivElement) => {
        node.focus();
    };
</script>

<div class="header">
    <div class="btns">
        <div class="button {$appState.canGoBack ? '' : 'disabled'}" onclick={goBack} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <BackSvg />
        </div>
        <div class="button {$appState.canGoForward ? '' : 'disabled'}" onclick={goForward} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <FowardSvg />
        </div>
        <div class="button {$listState.currentDir.fullPath == HOME ? 'disabled' : ''}" onclick={() => reload(true)} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <ReloadSvg />
        </div>
        <div
            class="button {$listState.currentDir.fullPath == HOME || $appState.search.searching ? 'disabled' : ''}"
            onclick={() => createItem(true)}
            onkeydown={handleKeyEvent}
            role="button"
            tabindex="-1"
        >
            <NewFileSvg />
        </div>
        <div
            class="button {$listState.currentDir.fullPath == HOME || $appState.search.searching ? 'disabled' : ''}"
            onclick={() => createItem(false)}
            onkeydown={handleKeyEvent}
            role="button"
            tabindex="-1"
        >
            <NewFolderSvg />
        </div>
    </div>
    <div class="path-area" bind:offsetWidth={pathWidth}>
        {#if $appState.pathEditing}
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
                        <Display />
                    </div>
                    <PathDividerSvg />
                    {#if paths.overflownPaths.length}
                        <div class="button path-dots" onclick={showHiddenPathsDialog} onkeydown={handleKeyEvent} role="button" tabindex="-1">
                            <ThreeDots />
                        </div>
                        {#if showHiddenPaths}
                            <div class="hidden-paths" style="top:{dialogPosition.top}px;left{dialogPosition.left};" use:setPathDialogFocus onblur={toggleHiddenPathDialog} tabindex="0" role="button">
                                {#each paths.overflownPaths as path}
                                    <div class="hidden-path-data" data-path={path} onclick={onPathClick} onkeydown={handleKeyEvent} role="button" tabindex="-1">
                                        {path}
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    {/if}
                    {#each paths.visiblePaths as path}
                        <div class="path-data" data-path={path} onclick={onPathClick} onkeydown={handleKeyEvent} role="button" tabindex="-1" style="max-width:{pathWidth - MIN_COMPONENT_WIDTH}px">
                            {path}
                        </div>
                        <PathDividerSvg />
                    {/each}
                    <div class="path-edit" onclick={onPathMarginClick} onkeydown={handleKeyEvent} role="button" tabindex="-1"></div>
                </div>
            </div>
        {/if}
    </div>
    <div class="search-area">
        <input
            class="search-input"
            class:without-clear={!$appState.search.searching}
            spellcheck="false"
            type="text"
            id="search"
            bind:this={searchInput}
            oninput={onSearchInput}
            bind:value={$appState.search.key}
            onfocus={focusSearchInput}
            onkeydown={onSearchInputKeyDown}
            disabled={$listState.currentDir.fullPath == HOME}
            autocomplete="one-time-code"
        />
        {#if $appState.search.searching}
            <div class="clear-area">
                <div class="clear" onclick={() => endSearch(false)} onkeydown={handleKeyEvent} role="button" tabindex="-1">
                    <ClearSvg />
                </div>
            </div>
        {/if}
    </div>
</div>
