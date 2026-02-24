type DriveState = {
    drives: Mp.DriveInfo[];
    hoverFavoriteId: string;
};

const state: DriveState = $state({
    drives: [],
    hoverFavoriteId: "",
});

export { state as driveState };

export class DriveUpdater {
    static updateDrives = (drives: Mp.DriveInfo[] | undefined) => {
        if (drives) {
            state.drives = drives;
        }
    };
}
