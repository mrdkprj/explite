<script lang="ts">
    import { tick } from "svelte";
    import BackSvg from "../svg/BackSvg.svelte";
    import FowardSvg from "../svg/FowardSvg.svelte";
    import NewFileSvg from "../svg/NewFileSvg.svelte";
    import NewFolderSvg from "../svg/NewFolderSvg.svelte";
    import PathDividerSvg from "../svg/PathDividerSvg.svelte";
    import ReloadSvg from "../svg/ReloadSvg.svelte";
    import ClearSvg from "../svg/ClearSvg.svelte";
    import { appState, dispatch } from "./appStateReducer";
    import main from "../main";
    import { handleKeyEvent, SEPARATOR } from "../constants";

    let {
        onSearched,
        endSearch,
        goBack,
        goForward,
        requestLoad,
        select,
        reload,
        suspendWatch,
    }: {
        onSearched: (e: Mp.SearchResult) => void;
        endSearch: () => void;
        goBack: () => void;
        goForward: () => void;
        requestLoad: (fullPath: string, isFile: boolean, navigation: Mp.Navigation) => void;
        select: (id: string) => Promise<void>;
        reload: () => void;
        suspendWatch: () => void;
    } = $props();

    let pathValue = $state("");
    let searchInterval = 0;
    let searchInput: HTMLInputElement;

    const onSearchInputKeyDown = (e: KeyboardEvent) => {
        if (e.key == "Enter") {
            e.preventDefault();
            e.stopPropagation();
            onSearchInput();
        }

        if (e.key == "Escape") {
            searchInput.blur();
            endSearch();
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
                endSearch();
            }
        }, 300);
    };

    export const startSearch = async () => {
        dispatch({ type: "clearCopyCut" });
        dispatch({ type: "startSearch" });
        suspendWatch();
        const result = await main.onSearchRequest({ dir: $appState.currentDir.fullPath, key: $appState.search.key.trim(), refresh: false });
        onSearched(result);
    };

    const setPathInputFocus = (node: HTMLInputElement) => {
        pathValue = $appState.currentDir.fullPath == "Home" ? "" : $appState.currentDir.fullPath;
        node.value = pathValue;
        node.focus();
        node.setSelectionRange(0, pathValue.length);
    };

    const onPathMarginClick = () => {
        dispatch({ type: "pathEditing", value: true });
    };

    const onPathClick = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        const path = e.target.getAttribute("data-path");
        if (!path) return;

        const fullPath = $appState.currentDir.fullPath;
        const tempPath = fullPath.substring(0, fullPath.indexOf(path) + path.length);
        const targetPath = tempPath.endsWith(":") ? `${tempPath}${SEPARATOR}` : tempPath;

        requestLoad(targetPath, false, "Direct");
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
        if (pathValue && $appState.currentDir.fullPath != pathValue) {
            requestLoad(pathValue, false, "Direct");
        }
        dispatch({ type: "pathEditing", value: false });
    };

    const addItem = async (isFile: boolean) => {
        dispatch({ type: "showNewItem", value: { isFile } });
        await tick();
        await select("tempid");

        const selectedElement = document.getElementById("temp-name-id");
        if (!selectedElement) {
            dispatch({ type: "hideNewItem" });
            return;
        }

        const fileName = selectedElement.getAttribute("data-name") ?? "";
        const rect = selectedElement.getBoundingClientRect();

        dispatch({
            type: "beginEditNewItem",
            value: {
                rect: {
                    top: rect.top - 2,
                    left: rect.left - 2,
                    width: rect.width,
                    height: rect.height,
                    origWidth: rect.width,
                },
                inputValue: fileName,
            },
        });

        dispatch({ type: "preventBlur", value: false });
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
</script>

<div class="header">
    <div class="btns">
        <div class="button {$appState.canUndo ? '' : 'disabled'}" onclick={goBack} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <BackSvg />
        </div>
        <div class="button {$appState.canRedo ? '' : 'disabled'}" onclick={goForward} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <FowardSvg />
        </div>
        <div class="button {$appState.currentDir.fullPath != 'Home' ? '' : 'disabled'}" onclick={reload} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <ReloadSvg />
        </div>
        <div class="button {$appState.currentDir.fullPath != 'Home' ? '' : 'disabled'}" onclick={() => addItem(true)} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <NewFileSvg />
        </div>
        <div class="button {$appState.currentDir.fullPath != 'Home' ? '' : 'disabled'}" onclick={() => addItem(false)} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <NewFolderSvg />
        </div>
    </div>
    <div class="path-area">
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
            <div class="path">
                {#each $appState.currentDir.paths as path}
                    <div class="path-data" data-path={path} onclick={onPathClick} onkeydown={handleKeyEvent} role="button" tabindex="-1">{path}</div>
                    <PathDividerSvg />
                {/each}
                <div class="path-edit" onclick={onPathMarginClick} onkeydown={handleKeyEvent} role="button" tabindex="-1"></div>
            </div>
        {/if}
    </div>
    <div class="search-area">
        <input
            type="text"
            id="search"
            spellcheck="false"
            bind:this={searchInput}
            oninput={onSearchInput}
            bind:value={$appState.search.key}
            onfocus={focusSearchInput}
            onkeydown={onSearchInputKeyDown}
            disabled={$appState.currentDir.fullPath == "Home"}
            autocomplete="one-time-code"
        />
        {#if $appState.search.searching}
            <div class="clear" onclick={endSearch} onkeydown={handleKeyEvent} role="button" tabindex="-1">
                <ClearSvg />
            </div>
        {/if}
    </div>
</div>
