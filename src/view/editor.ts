type EditType = "Edit" | "Undo" | "Redo";
type Edition = {
    id: string;
    newValue: string;
    oldValue: string;
    isFile: boolean;
};

class Editor {
    private undoStack: Edition[] = [];
    private redoStack: Edition[] = [];
    private type: EditType = "Edit";
    data: Mp.RenameData = { id: "", name: "", isFile: true };

    begin(id: string, name: string, isFile: boolean) {
        this.type = "Edit";
        const stack: Edition = {
            id,
            newValue: "",
            oldValue: name,
            isFile,
        };

        this.undoStack.push(stack);

        this.data = this.toRenameData(id, name, isFile);
    }

    update(newName: string) {
        this.data.name = newName;
    }

    end() {
        if (this.type != "Edit") return;

        const stack = this.undoStack.pop();

        if (!stack) return;

        stack.newValue = this.data.name;

        this.undoStack.push(stack);
        this.data = this.toRenameData(stack.id, stack.newValue, stack.isFile);
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    undo() {
        const stack = this.undoStack.pop();

        if (!stack) throw new Error("Failed to undo");

        this.type = "Undo";

        this.redoStack.push(stack);

        this.data = this.toRenameData(stack.id, stack.oldValue, stack.isFile);
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    redo() {
        const stack = this.redoStack.pop();

        if (!stack) throw new Error("Failed to redo");

        this.type = "Redo";

        this.undoStack.push(stack);

        this.data = this.toRenameData(stack.id, stack.newValue, stack.isFile);
    }

    private rollbackEdit() {
        const stack = this.undoStack.pop();

        if (!stack) return;

        this.data = this.toRenameData(stack.id, stack.oldValue, stack.isFile);
    }

    rollback() {
        if (this.type == "Edit") {
            return this.rollbackEdit();
        }

        const from = this.type == "Undo" ? this.redoStack : this.undoStack;
        const to = this.type == "Undo" ? this.undoStack : this.redoStack;

        const stack = from.pop();

        if (!stack) return;

        to.push(stack);

        this.data = this.toRenameData(stack.id, stack.oldValue, stack.isFile);
    }

    private toRenameData(id: string, name: string, isFile: boolean): Mp.RenameData {
        return {
            id,
            name,
            isFile,
        };
    }
}

const editor = new Editor();
export default editor;
