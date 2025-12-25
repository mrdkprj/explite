<script lang="ts">
    import { appState, renameState } from "./appStateReducer.svelte";

    let { endEditFileName }: { endEditFileName: () => Promise<void> } = $props();

    const setFocusAndSelect = (node: HTMLInputElement | HTMLTextAreaElement) => {
        node.focus();
        node.setSelectionRange(0, node.value.lastIndexOf("."));
    };

    const onRenameInputKeyDown = (e: KeyboardEvent) => {
        if (!e.target || !(e.target instanceof HTMLInputElement)) return;

        if (e.key === "Enter") {
            e.stopPropagation();
            e.preventDefault();
            endEditFileName();
            return;
        }
    };
</script>

{#if $appState.isInGridView}
    <div class="rename-textarea" style="width:{renameState.rect.width}px;top:{renameState.rect.top}px; left:{renameState.rect.left}px;">
        <textarea
            class="text rename"
            style=" max-width:{renameState.rect.width}px;"
            spellCheck="false"
            onblur={$appState.preventBlur ? undefined : endEditFileName}
            onkeydown={onRenameInputKeyDown}
            bind:value={renameState.newName}
            use:setFocusAndSelect
            autocomplete="one-time-code"
        ></textarea>
    </div>
{:else}
    <input
        type="text"
        class="input rename"
        style="top:{renameState.rect.top}px; left:{renameState.rect.left}px; height:{renameState.rect.height}px"
        spellCheck="false"
        onblur={$appState.preventBlur ? undefined : endEditFileName}
        onkeydown={onRenameInputKeyDown}
        bind:value={renameState.newName}
        use:setFocusAndSelect
        autocomplete="one-time-code"
    />
{/if}
