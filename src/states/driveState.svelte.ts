export type DriveState = {
    drives: Mp.DriveInfo[];
    favorites: Mp.MediaFile[];
    leftWidth: number;
    hoverFavoriteId: string;
};

export const state: DriveState = $state({
    drives: [],
    favorites: [],
    leftWidth: 250,
    hoverFavoriteId: "",
});

export { state as driveState };

export const updateDrives = (drives: Mp.DriveInfo[] | undefined) => {
    if (drives) {
        state.drives = drives;
    }
};
