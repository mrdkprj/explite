<script lang="ts">
    import Json from "../svg/JsonSvg.svelte";
    import { handleKeyEvent } from "../constants";
    import { dispatch, settings } from "./appStateReducer.svelte";

    let {
        preferenceChanged,
        openSettingsAsJson,
        clearColumnHistory,
    }: { preferenceChanged: (isAppMenuItemChanged: boolean) => void; openSettingsAsJson: () => Promise<void>; clearColumnHistory: () => void } = $props();

    let theme = $state($state.snapshot(settings.data.theme));
    let appMenuItems = $state($state.snapshot(settings.data.appMenuItems));
    let allowMoveColumn = $state($state.snapshot(settings.data.allowMoveColumn));
    let useOSIcon = $state($state.snapshot(settings.data.useOSIcon));
    let rememberColumns = $state($state.snapshot(settings.data.rememberColumns));

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
        clearColumnHistory();
    };

    const onkeydown = (e: KeyboardEvent) => {
        if (e.key == "Escape") {
            dispatch({ type: "togglePreference" });
        }
    };

    const isAppMenuItemChanged = (newAppMenuItems: Mp.AppMenuItem[]): boolean => {
        if (newAppMenuItems.length != settings.data.appMenuItems.length) return true;

        return newAppMenuItems.some(
            (item, index) => settings.data.appMenuItems[index].label != item.label || settings.data.appMenuItems[index].path != item.path || settings.data.appMenuItems[index].target != item.target,
        );
    };

    const close = (save: boolean) => {
        if (save) {
            const newAppMenuItems = appMenuItems.filter((item) => item.path != "");
            const appMenuItemChanged = isAppMenuItemChanged(newAppMenuItems);
            dispatch({ type: "setPreference", value: { theme, appMenuItems: appMenuItems.filter((item) => item.path != ""), allowMoveColumn, useOSIcon, rememberColumns } });
            preferenceChanged(appMenuItemChanged);
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

<div class="dialog-overlay" {onkeydown} role="button" tabindex="-1" use:setKeyboardFocus>
    <div class="dialog-container">
        <div class="dialog-header">
            <div class="pref-json" onclick={openSettings} onkeydown={handleKeyEvent} role="button" tabindex="-1"><Json /></div>
            <div class="dialog-close" onclick={() => close(false)} onkeydown={handleKeyEvent} role="button" tabindex="-1">&times;</div>
        </div>
        <div class="dialog">
            <div class="dialog-title-block">Theme</div>
            <div class="dialog-item-block">
                <select class="dialog-select" name="theme" bind:value={theme}>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                </select>
            </div>
            <div class="dialog-separator"></div>

            <div class="dialog-title-block">View</div>
            <div class="dialog-item-block"></div>
            <div class="dialog-item">
                <input id="rememberColumns" type="checkbox" bind:checked={rememberColumns} /><label for="rememberColumns">Remember column settings</label>
            </div>
            <div class="dialog-item">
                <button class="dialog-btn-md" onclick={removeHistory} disabled={!rememberColumns}>Remove history</button>
            </div>
            <div class="dialog-item">
                <input id="allowMoveColumn" type="checkbox" bind:checked={allowMoveColumn} /><label for="allowMoveColumn">Allow column move</label>
            </div>
            <div class="dialog-item">
                <input id="useOSFileIcon" type="checkbox" bind:checked={useOSIcon} /><label for="useOSFileIcon">Use PNG icons</label>
            </div>

            <div class="dialog-separator"></div>

            <div class="dialog-title-block">Menu</div>
            <div class="dialog-item-block">
                <div class="dialog-item">
                    <div>Manage application menu items</div>
                </div>
                <div class="dialog-item">
                    <div class="pref-buttons">
                        <div><button class="btn-md" onclick={addMenuItem}>Add</button></div>
                    </div>
                </div>
                <div class="dialog-item">
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
                                        <select name="target" class="dialog-select pref-target" bind:value={item.target}>
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

            <div class="dialog-separator"></div>

            <div class="dialog-item-block dialog-action">
                <button class="dialog-btn-lg" onclick={() => close(true)}>Apply</button>
                <button class="dialog-btn-lg" onclick={() => close(false)}>Close</button>
            </div>
        </div>
    </div>
</div>

<style scoped>
    .dialog-container {
        background-color: var(--main-bgcolor);
        color: var(--menu-color);
        display: flex;
        width: 540px;
        height: 560px;
        flex-direction: column;
        box-shadow: 7px 5px 5px var(--dialog-shadow);
        outline: 1px solid var(--dialog-border-color);
        border-radius: 8px;
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

    input[type="text"] {
        border: none;
        line-height: 20px;
        width: calc(100% - 11px);
    }
</style>
