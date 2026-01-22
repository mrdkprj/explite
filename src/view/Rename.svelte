<script lang="ts">
    import { appState, renameState } from "./appStateReducer.svelte";

    let { endEditFileName }: { endEditFileName: () => Promise<void> } = $props();

    let inputWidth = $state(0);
    let canvas: HTMLCanvasElement;

    const setFocusAndSelect = (node: HTMLInputElement | HTMLTextAreaElement) => {
        node.focus();
        node.setSelectionRange(0, node.value.lastIndexOf("."));
        onRenameInput();
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

    const onRenameInput = () => {
        const _canvas = canvas || (canvas = document.createElement("canvas"));
        const context = _canvas.getContext("2d");
        if (!context) return;
        context.font = 'normal 12px "Segoe UI"';
        const metrics = context.measureText(renameState.newName);
        inputWidth = metrics.width + 5;
    };
</script>

{#if $appState.isInGridView}
    <div class="rename-textarea" style="width:{renameState.rect.width}px;top:{renameState.rect.top}px; left:{renameState.rect.left}px;">
        <textarea
            class="text rename"
            style="max-width:{renameState.rect.width}px;"
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
        style="top:{renameState.rect.top}px; left:{renameState.rect.left}px; height:{renameState.rect.height}px; width:{inputWidth}px;"
        spellCheck="false"
        onblur={$appState.preventBlur ? undefined : endEditFileName}
        onkeydown={onRenameInputKeyDown}
        oninput={onRenameInput}
        bind:value={renameState.newName}
        use:setFocusAndSelect
        autocomplete="one-time-code"
    />
{/if}
