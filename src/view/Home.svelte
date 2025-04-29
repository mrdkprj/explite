<script lang="ts">
    import { appState } from "./appStateReducer";
    import { listState } from "./listStateReducer";
    import LargeDriveSvg from "../svg/LargeDriveSvg.svelte";
    import { handleKeyEvent } from "../constants";
    import { t } from "../translation/useTranslation";

    let { requestLoad }: { requestLoad: (fullPath: string, isFile: boolean, navigation: Mp.Navigation) => void } = $props();

    const onDriveClick = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        const fullPath = e.target.getAttribute("data-full-path");
        if (!fullPath) return;
        requestLoad(fullPath, false, "Direct");
    };
</script>

<div class="container">
    {#each $appState.drives as disk}
        <div data-full-path={disk.path} class="ldisk" class:current={disk.path == $listState.currentDir.fullPath} ondblclick={onDriveClick} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <div class="icon">
                <LargeDriveSvg />
            </div>
            <div class="info" data-full-path={disk.path}>
                <div>{disk.name}({disk.label})</div>
                <div class="bar">
                    <div class="used" style="width: {Math.floor(((disk.total - disk.available) / disk.total) * 100)}%"></div>
                </div>
                <div>
                    {t("availableSpace")}&nbsp;
                    {new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3, roundingMode: "floor" }).format(disk.available / 1.074e9)} GB/{new Intl.NumberFormat("en-US", {
                        maximumSignificantDigits: 3,
                        roundingMode: "floor",
                    }).format(disk.total / 1.074e9)} GB
                </div>
            </div>
        </div>
    {/each}
</div>

<style>
    .container {
        display: flex;
        padding: 25px 25px;
        row-gap: 10px;
        flex-wrap: wrap;
    }
    .ldisk {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: start;
        font-size: 13px;
        font-family: var(--font);
        cursor: pointer;
        min-width: 280px;
    }
    .ldisk:hover {
        background-color: var(--selection-bgcolor);
    }
    .icon {
        margin: 0 10px;
    }
    .info {
        display: flex;
        flex-direction: column;
        height: 100%;
        justify-content: space-between;
        align-items: flex-start;
        flex: 1 1 auto;
    }
    .info div {
        pointer-events: none;
    }
    .bar {
        width: 90%;
        height: 10px;
        outline: 1px solid;
    }
    .used {
        width: 50%;
        height: 100%;
        background-color: #9191f5;
    }
</style>
