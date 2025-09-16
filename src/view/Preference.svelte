<script lang="ts">
    import Json from "../svg/Json.svelte";
    import { handleKeyEvent } from "../constants";
    import { appState, dispatch } from "./appStateReducer";

    let {
        preferenceChanged,
        openSettingsAsJson,
        clearHeaderHistory,
    }: { preferenceChanged: (isAppMenuItemChanged: boolean) => void; openSettingsAsJson: () => Promise<void>; clearHeaderHistory: () => void } = $props();

    const originalTheme = $appState.theme;
    const originalAppMenuItems = $appState.appMenuItems;
    const originalAllowMoveColumn = $appState.allowMoveColumn;
    let theme = $state($appState.theme);
    let appMenuItems = $state($appState.appMenuItems);
    let allowMoveColumn = $state($appState.allowMoveColumn);

    const addMenuItem = () => {
        appMenuItems.push({
            label: "",
            path: "",
            target: "File",
        });
    };

    const removeMenuItem = (index: number) => {
        appMenuItems.splice(index, 1);
    };

    const removeHistory = () => {
        clearHeaderHistory();
    };

    const onkeydown = (e: KeyboardEvent) => {
        if (e.key == "Escape") {
            dispatch({ type: "togglePreference" });
        }
    };

    const isAppMenuItemChanged = (newAppMenuItems: Mp.AppMenuItem[]): boolean => {
        if (newAppMenuItems.length != originalAppMenuItems.length) return true;

        return newAppMenuItems.some(
            (item, index) => originalAppMenuItems[index].label != item.label || originalAppMenuItems[index].path != item.path || originalAppMenuItems[index].target != item.target,
        );
    };

    const close = (save: boolean) => {
        if (save) {
            const newAppMenuItems = appMenuItems.filter((item) => item.path != "");
            const appMenuItemChanged = isAppMenuItemChanged(newAppMenuItems);
            dispatch({ type: "setPreference", value: { theme, appMenuItems: appMenuItems.filter((item) => item.path != ""), allowMoveColumn } });
            preferenceChanged(appMenuItemChanged);
        } else {
            dispatch({ type: "setPreference", value: { theme: originalTheme, appMenuItems: originalAppMenuItems, allowMoveColumn: originalAllowMoveColumn } });
        }

        dispatch({ type: "togglePreference" });
    };

    const setKeyboardFocus = (node: HTMLDivElement) => {
        node.focus();
    };

    const openSettings = async () => {
        await openSettingsAsJson();
    };
</script>

<div class="pref-overlay" {onkeydown} role="button" tabindex="-1" use:setKeyboardFocus>
    <div class="pref-container">
        <div class="pref-header">
            <div class="pref-json" onclick={openSettings} onkeydown={handleKeyEvent} role="button" tabindex="-1"><Json /></div>
            <div class="pref-close" onclick={() => close(false)} onkeydown={handleKeyEvent} role="button" tabindex="-1">&times;</div>
        </div>
        <div class="pref">
            <div class="pref-title-block">Theme</div>
            <div class="pref-item-block">
                <select class="pref-select" name="theme" bind:value={theme}>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                </select>
            </div>
            <div class="pref-separator"></div>
            <div class="pref-title-block">Column</div>
            <div class="pref-item-block">
                <div class="pref-item">
                    <input id="allowMoveColumn" type="checkbox" bind:checked={allowMoveColumn} /><label for="allowMoveColumn">Allow column move</label>
                </div>
                <div class="pref-item">
                    <button class="pref-btn-md" onclick={removeHistory}>Remove history</button>
                </div>
            </div>
            <div class="pref-separator"></div>
            <div class="pref-title-block">Menu</div>
            <div class="pref-item-block">
                <div class="pref-item">
                    <div>Manage application menu items</div>
                </div>
                <div class="pref-item">
                    <div class="pref-buttons">
                        <div><button class="btn-md" onclick={addMenuItem}>Add</button></div>
                    </div>
                </div>
                <div class="pref-item">
                    <div class="pref-table">
                        <div class="pref-row">
                            <div class="pref-cell"><div class="pref-content"></div></div>
                            <div class="pref-cell"><div class="pref-content">Label</div></div>
                            <div class="pref-cell"><div class="pref-content">Application Path</div></div>
                            <div class="pref-cell"><div class="pref-content">Target</div></div>
                        </div>
                        {#each appMenuItems as item, index}
                            <div class="pref-row">
                                <div class="pref-cell"><div class="pref-content"><button onclick={() => removeMenuItem(index)}>-</button></div></div>
                                <div class="pref-cell"><input type="text" class="pref-content" contenteditable="plaintext-only" bind:value={item.label} /></div>
                                <div class="pref-cell"><input type="text" class="pref-content" contenteditable="plaintext-only" bind:value={item.path} /></div>
                                <div class="pref-cell">
                                    <div class="pref-content no-padding">
                                        <select name="target" class="pref-select pref-target" bind:value={item.target}>
                                            <option value="File">File</option>
                                            <option value="Folder">Folder</option>
                                            <option value="Both">Both</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
            <div class="pref-separator"></div>
            <div class="pref-item-block pref-action">
                <button class="pref-btn-lg" onclick={() => close(true)}>Apply</button>
                <button class="pref-btn-lg" onclick={() => close(false)}>Close</button>
            </div>
        </div>
    </div>
</div>

<style scoped>
    .pref-overlay {
        background-color: transparent;
        width: 100%;
        height: calc(100% - 50px);
        display: flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        z-index: 9999;
    }
    .pref-container {
        background-color: var(--main-bgcolor);
        color: var(--menu-color);
        display: flex;
        width: 540px;
        height: 540px;
        flex-direction: column;
        box-shadow: 7px 5px 5px #8f7c7c;
        outline: 1px solid #ccc;
        border-radius: 8px;
    }
    .pref-header {
        width: 100%;
        height: 30px;
        display: flex;
        justify-content: flex-end;
        align-items: center;
    }
    .pref-json {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 45px;
        position: relative;
    }
    .pref-json:hover {
        background-color: var(--button-hover-color);
    }
    .pref {
        width: calc(100% - 40px);
        height: calc(100% - 30px);
        overflow: auto;
        padding: 0 20px 20px 20px;
    }
    .pref-item-block {
        font-size: 14px;
        margin-bottom: 10px;
    }
    .pref-separator {
        height: 1px;
        border-top: 1px solid #ccc;
        margin: 20px 0 10px 0;
    }
    .pref-item {
        display: flex;
        align-items: center;
        margin-bottom: 5px;
    }
    .pref-title-block {
        font-size: 16px;
        font-weight: bold;
        margin: 0 0 10px 0;
    }
    .pref-table {
        display: table;
        width: 100%;
    }
    .pref-row {
        display: table-row;
        border-bottom: 1px solid #ccc;
        background-color: var(--button-bgcolor);
    }
    .pref-row:first-child {
        position: sticky;
        top: 0;
        left: 0;
        background-color: #f1ebeb;
    }
    .pref-row:first-child .pref-cell {
        border-top: 1px solid #ccc;
    }
    .pref-row:first-child .pref-cell .pref-content {
        margin: 0 10px;
    }
    .pref-cell {
        display: table-cell;
        border-left: 1px solid #ccc;
        border-bottom: 1px solid #ccc;
        user-select: none;
        white-space: nowrap;
        margin: 5px;
    }
    .pref-cell:last-child {
        border-right: 1px solid #ccc;
    }
    .pref-content {
        padding: 5px;
        color: black;
    }
    .pref-content.no-padding {
        padding: 0;
    }
    .pref-select {
        width: 90%;
        padding: 5px 0 5px 5px;
        border-radius: 4px;
        border-color: #ccc;
        background-color: var(--button-bgcolor);
        color: var(--button-color);
    }
    .pref-select:focus {
        outline: none;
    }
    .pref-select.pref-target {
        width: 100%;
        outline: none;
        border: none;
        height: 100%;
    }
    .pref button {
        background-color: var(--button-bgcolor);
        color: var(--button-color);
        border: 1px solid #ccc;
        border-radius: 4px;
    }
    .pref button:hover {
        background-color: #e1e4ed;
    }
    .pref-action {
        display: flex;
        align-items: center;
        justify-content: space-around;
    }
    .pref-btn-md {
        padding: 5px;
    }
    .pref-btn-lg {
        padding: 8px;
    }

    .pref-close {
        align-items: center;
        display: flex;
        justify-content: center;
        width: 45px;
        height: 100%;
        text-align: center;
        user-select: none;
        -webkit-user-select: none;
        position: relative;
        -webkit-app-region: no-drag;
        line-height: 35px;
    }
    .pref-close:hover {
        background-color: var(--close-hover-bgcolor);
        color: var(--close-hover-color);
    }
    input[type="text"] {
        border: none;
        line-height: 20px;
        width: calc(100% - 11px);
    }
</style>
