<script lang="ts">
    // import { handleKeyEvent } from "../constants";
    import { dispatch, listState } from "./appStateReducer.svelte";
    import path from "../path";
    import util from "../util";
    // import { scale } from "svelte/transition";
    import Dialog from "./Dialog.svelte";
    import { DIALOG_COLORS } from "../constants";

    let {
        getSymlinkTargetItem,
        createSymlink,
    }: {
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

    const setKeyboardFocus = (node: HTMLDivElement) => {
        node.focus();
    };

    const next = async () => {
        const found = await util.exists(symlinkTarget);
        if (found) {
            symlinkName = path.basename(symlinkTarget);
            page = 1;
        } else {
            await util.showErrorMessage("Selected item does not exist");
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

<Dialog title={"Create Symlink"} overlayOffet={50} width={540} height={200} {close} colors={DIALOG_COLORS}>
    {#snippet content()}
        {#if page == 0}
            <div class="dialog-item-block">
                <div class="dialog-item">Target item:</div>
                <div class="dialog-item">
                    <input type="text" bind:value={symlinkTarget} use:setKeyboardFocus />
                    <button class="dialog-btn-md" style="margin-right: 3px;" onclick={() => getSymlinkTarget(false)}>File</button>
                    <button class="dialog-btn-md" onclick={() => getSymlinkTarget(true)}>Folder</button>
                </div>
            </div>
        {:else}
            <div class="dialog-item-block">
                <div class="dialog-item">Symlink name:</div>
                <div>
                    <input type="text" bind:value={symlinkName} />
                </div>
            </div>
        {/if}
    {/snippet}
    {#snippet action()}
        {#if page == 0}
            <button class="dialog-btn-lg" onclick={next} disabled={!symlinkTarget}>Next</button>
            <button class="dialog-btn-lg" onclick={close}>Cancel</button>
        {:else}
            <button class="dialog-btn-lg" onclick={create} disabled={!symlinkName}>Done</button>
            <button class="dialog-btn-lg" onclick={close}>Cancel</button>
        {/if}
    {/snippet}
</Dialog>

<style>
    input[type="text"] {
        border: 1px solid #ccc;
        outline-color: #ccc;
        width: 100%;
        margin-right: 10px;
        line-height: 25px;
        text-indent: 5px;
    }
</style>
