import { DEFAULT_LABLES } from "../constants";

type MaxColumnWidths = { [key in Mp.SortKey]: number };
type ColumnState = {
    columnLabels: Mp.ColumnLabel[];
    adjustedWidths: MaxColumnWidths;
};

export const state: ColumnState = $state({
    columnLabels: DEFAULT_LABLES,
    adjustedWidths: { ddate: 0, directory: 0, name: 0, mdate: 0, cdate: 0, size: 0, extension: 0, orig_path: 0 },
    allowMoveColumn: true,
    autoAdjustColumn: false,
});

export { state as columnState };

let canvas: HTMLCanvasElement;

export const calculateColumnWidths = (items: Mp.MediaFile[]) => {
    if (!items.length) {
        state.adjustedWidths = { ddate: 0, directory: 0, name: 0, mdate: 0, cdate: 0, size: 0, extension: 0, orig_path: 0 };
        return;
    }
    const iconWidth = 21;
    const widths: MaxColumnWidths = { ddate: 0, directory: 0, name: 0, mdate: 0, cdate: 0, size: 0, extension: 0, orig_path: 0 };

    const _canvas = canvas || (canvas = document.createElement("canvas"));
    const context = _canvas.getContext("2d");
    if (!context) return widths;

    context.font = 'normal 12px "Segoe UI"';
    items.forEach((item) => {
        const { dir, name, mdateString, cdateString, sizeString, extension, originalPath, ddateString } = item;
        widths.directory = Math.max(widths.directory, context.measureText(dir).width);
        widths.name = Math.max(widths.name, context.measureText(name).width + iconWidth);
        widths.mdate = Math.max(widths.mdate, context.measureText(mdateString).width);
        widths.cdate = Math.max(widths.cdate, context.measureText(cdateString).width);
        widths.size = Math.max(widths.size, context.measureText(sizeString).width);
        widths.extension = Math.max(widths.extension, context.measureText(extension).width);
        widths.orig_path = Math.max(widths.orig_path, context.measureText(originalPath).width);
        widths.ddate = Math.max(widths.ddate, context.measureText(ddateString).width);
    });
    state.adjustedWidths = widths;
};

export const swithWidth = (key: Mp.SortKey) => {
    const column = state.columnLabels.find((label) => label.sortKey == key);
    if (!column) return;
    column.width = state.adjustedWidths[key];
};
