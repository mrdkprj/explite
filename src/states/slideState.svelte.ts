import { driveState } from "./driveState.svelte";

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

export const startSlide = (headerLabels: Mp.ColumnLabel[], target: "Area" | Mp.SortKey, startX: number) => {
    const width = target == "Area" ? driveState.leftWidth : headerLabels.filter((label) => label.sortKey == target)[0].width;
    state.sliding = true;
    state.target = target;
    state.initial = width;
    state.startX = startX;
};

export const endSlide = () => {
    state.sliding = false;
    state.target = "Area";
};
