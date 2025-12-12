<script lang="ts">
    import { appState } from "./appStateReducer.svelte";

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
    <div class="rename-textarea" style="width:{$appState.rename.rect.width}px;top:{$appState.rename.rect.top}px; left:{$appState.rename.rect.left}px;">
        <textarea
            class="text rename"
            style=" max-width:{$appState.rename.rect.width}px;"
            spellCheck="false"
            onblur={$appState.preventBlur ? undefined : endEditFileName}
            onkeydown={onRenameInputKeyDown}
            bind:value={$appState.rename.newName}
            use:setFocusAndSelect
            autocomplete="one-time-code"
        ></textarea>
    </div>
{:else}
    <input
        type="text"
        class="input rename"
        style="top:{$appState.rename.rect.top}px; left:{$appState.rename.rect.left}px; height:{$appState.rename.rect.height}px"
        spellCheck="false"
        onblur={$appState.preventBlur ? undefined : endEditFileName}
        onkeydown={onRenameInputKeyDown}
        bind:value={$appState.rename.newName}
        use:setFocusAndSelect
        autocomplete="one-time-code"
    />
{/if}
