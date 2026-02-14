<script lang="ts">
    import { handleKeyEvent } from "../constants";
    import { dispatch, listState } from "./appStateReducer.svelte";
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
        let item = await getSymlinkTargetItem(listState.currentDir.fullPath, folder);
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
        const fullPath = path.join(listState.currentDir.fullPath, symlinkName);
        await createSymlink(fullPath, symlinkTarget);
        close();
    };

    const close = () => {
        dispatch({ type: "toggleCreateSymlink" });
    };
</script>

<div class="dialog-overlay" {onkeydown} role="button" tabindex="-1" use:setKeyboardFocus>
    <div class="dialog-container">
        <div class="dialog-header">
            <div class="dialog-close" onclick={close} onkeydown={handleKeyEvent} role="button" tabindex="-1">&times;</div>
        </div>
        <div class="dialog">
            <div class="dialog-title-block">Create Symlink</div>
            {#if page == 0}
                <div class="dialog-item-block">
                    <div class="dialog-item">Target item:</div>
                    <div class="dialog-item">
                        <input type="text" bind:value={symlinkTarget} />
                        <button class="dialog-btn-md" style="margin-right: 3px;" onclick={() => getSymlinkTarget(false)}>File</button>
                        <button class="dialog-btn-md" onclick={() => getSymlinkTarget(true)}>Folder</button>
                    </div>
                </div>
                <div class="dialog-separator"></div>
                <div class="dialog-action">
                    <button class="dialog-btn-lg" onclick={next} disabled={!symlinkTarget}>Next</button>
                    <button class="dialog-btn-lg" onclick={close}>Cancel</button>
                </div>
            {:else}
                <div class="dialog-item-block">
                    <div class="dialog-item">Symlink name:</div>
                    <div>
                        <input type="text" bind:value={symlinkName} />
                    </div>
                </div>
                <div class="dialog-separator"></div>
                <div class="dialog-action">
                    <button class="dialog-btn-lg" onclick={create} disabled={!symlinkName}>Done</button>
                    <button class="dialog-btn-lg" onclick={close}>Cancel</button>
                </div>
            {/if}
        </div>
    </div>
</div>

<style scoped>
    .dialog-container {
        background-color: var(--main-bgcolor);
        color: var(--menu-color);
        display: flex;
        width: 540px;
        height: 200px;
        flex-direction: column;
        box-shadow: 7px 5px 5px var(--dialog-shadow);
        outline: 1px solid var(--dialog-border-color);
        border-radius: 8px;
    }

    .dialog-action button:first-child {
        margin-right: 10px;
    }

    input[type="text"] {
        border: 1px solid #ccc;
        outline-color: #ccc;
        width: 100%;
        margin-right: 10px;
        line-height: 25px;
        text-indent: 5px;
    }
</style>
