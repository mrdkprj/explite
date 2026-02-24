import { settings } from "./settingsState.svelte";

export type SlideState = {
    target: "Area" | Mp.SortKey;
    initial: number;
    startX: number;
    sliding: boolean;
};

export const state: SlideState = $state({
    target: "Area",
    initial: 0,
    sliding: false,
    startX: 0,
});

export { state as slideState };

export class SlidUpdater {
    static startSlide = (columns: Mp.Column[], target: "Area" | Mp.SortKey, startX: number) => {
        const width = target == "Area" ? settings.data.leftAreaWidth : columns.filter((column) => column.sortKey == target)[0].width;
        state.sliding = true;
        state.target = target;
        state.initial = width;
        state.startX = startX;
    };

    static endSlide = () => {
        state.sliding = false;
        state.target = "Area";
    };
}
