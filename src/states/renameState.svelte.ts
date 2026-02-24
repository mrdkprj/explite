type RenameState = {
    renaming: boolean;
    newName: string;
    oldName: string;
    fullPath: string;
    rect: Mp.PartialRect;
    targetUUID: string;
};

const state: RenameState = $state({
    renaming: false,
    oldName: "",
    newName: "",
    fullPath: "",
    rect: {
        top: 0,
        left: 0,
        width: 0,
        height: 0,
    },
    targetUUID: "",
});

export { state as renameState };

export class RenameUpdater {
    static startRename = (rect: Mp.PartialRect, oldName: string, fullPath: string, uuid: string) => {
        state.renaming = true;
        state.rect = rect;
        state.oldName = oldName;
        state.newName = oldName;
        state.fullPath = fullPath;
        state.targetUUID = uuid;
    };

    static endRename = () => {
        state.renaming = false;
        state.targetUUID = "";
    };
}
