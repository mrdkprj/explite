<script lang="ts">
    import { handleKeyEvent } from "../constants";
    import { dispatch } from "./appStateReducer";
    import { listState } from "./listStateReducer";
    import { path } from "../path";
    import util from "../util";

    let {
        showErrorMessage,
        getSymlinkTargetItem,
        createSymlink,
    }: {
        showErrorMessage: (message: string) => Promise<void>;
        getSymlinkTargetItem: (currentDir: string, folder: boolean) => Promise<string | null>;
        createSymlink: (path: string, linkPath: string) => Promise<void>;
    } = $props();
    let symlinkTarget = $state("");
    let symlinkName = $state("");
    let page = $state(0);

    const getSymlinkTarget = async (folder: boolean) => {
        let item = await getSymlinkTargetItem($listState.currentDir.fullPath, folder);
        if (item) {
            symlinkTarget = item;
        }
    };
    const onkeydown = (e: KeyboardEvent) => {
        if (e.key == "Escape") {
            dispatch({ type: "toggleCreateSymlink" });
        }
    };

    const setKeyboardFocus = (node: HTMLDivElement) => {
        node.focus();
    };

    const next = async () => {
        const found = await util.exists(symlinkTarget);
        if (found) {
            symlinkName = path.basename(symlinkTarget);
            page = 1;
        } else {
            await showErrorMessage("Selected item does not exist");
        }
    };

    const create = async () => {
        const fullPath = path.join($listState.currentDir.fullPath, symlinkName);
        await createSymlink(fullPath, symlinkTarget);
        close();
    };

    const close = () => {
        dispatch({ type: "toggleCreateSymlink" });
    };
</script>

<div class="sym-overlay" {onkeydown} role="button" tabindex="-1" use:setKeyboardFocus>
    <div class="sym-container">
        <div class="sym-header">
            <div class="sym-close" onclick={close} onkeydown={handleKeyEvent} role="button" tabindex="-1">&times;</div>
        </div>
        <div class="sym">
            <div class="sym-title-block">Create Symlink</div>
            {#if page == 0}
                <div class="sym-item-block">
                    <div class="sym-item">Target item:</div>
                    <div class="sym-item">
                        <input type="text" bind:value={symlinkTarget} />
                        <button class="sym-btn-md" style="margin-right: 3px;" onclick={() => getSymlinkTarget(false)}>File</button>
                        <button class="sym-btn-md" onclick={() => getSymlinkTarget(true)}>Folder</button>
                    </div>
                </div>
                <div class="sym-separator"></div>
                <div class="sym-action">
                    <button class="sym-btn-lg" onclick={next} disabled={!symlinkTarget}>Next</button>
                    <button class="sym-btn-lg" onclick={close}>Cancel</button>
                </div>
            {:else}
                <div class="sym-item-block">
                    <div class="sym-item">Symlink name:</div>
                    <div>
                        <input type="text" bind:value={symlinkName} />
                    </div>
                </div>
                <div class="sym-separator"></div>
                <div class="sym-action">
                    <button class="sym-btn-lg" onclick={create} disabled={!symlinkName}>Done</button>
                    <button class="sym-btn-lg" onclick={close}>Cancel</button>
                </div>
            {/if}
        </div>
    </div>
</div>

<style scoped>
    .sym-overlay {
        background-color: transparent;
        width: 100%;
        height: calc(100% - 50px);
        display: flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        z-index: 9999;
    }
    .sym-container {
        background-color: var(--main-bgcolor);
        color: var(--menu-color);
        display: flex;
        width: 540px;
        height: 540px;
        flex-direction: column;
        box-shadow: 7px 5px 5px var(--dialog-shadow);
        outline: 1px solid var(--dialog-border-color);
        border-radius: 8px;
    }
    .sym-header {
        width: 100%;
        height: 30px;
        display: flex;
        justify-content: flex-end;
        align-items: center;
    }

    .sym {
        width: calc(100% - 40px);
        height: calc(100% - 30px);
        overflow: auto;
        padding: 0 20px 20px 20px;
    }
    .sym-item-block {
        font-size: 14px;
        margin-bottom: 10px;
    }
    .sym-separator {
        height: 1px;
        border-top: 1px solid #ccc;
        margin: 20px 0 10px 0;
    }
    .sym-item {
        display: flex;
        align-items: center;
        margin-bottom: 5px;
    }
    .sym-title-block {
        font-size: 16px;
        font-weight: bold;
        margin: 0 0 10px 0;
    }

    .sym button {
        background-color: var(--button-bgcolor);
        color: var(--button-color);
        border: 1px solid #ccc;
        border-radius: 4px;
    }
    .sym button:disabled {
        visibility: hidden;
    }
    .sym button:not(:disabled):hover {
        background-color: #e1e4ed;
    }
    .sym-action {
        display: flex;
        align-items: center;
        justify-content: flex-end;
    }
    .sym-btn-md {
        padding: 5px;
    }

    .sym-btn-lg {
        padding: 8px;
    }

    .sym-action button:first-child {
        margin-right: 10px;
    }

    .sym-close {
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
    .sym-close:hover {
        background-color: var(--close-hover-bgcolor);
        color: var(--close-hover-color);
    }
    input[type="text"] {
        border: 1px solid #ccc;
        outline-color: #ccc;
        line-height: 20px;
        width: 100%;
        margin-right: 10px;
        line-height: 25px;
        text-indent: 5px;
    }
</style>
