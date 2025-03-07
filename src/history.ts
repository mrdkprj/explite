import { path } from "./path";
import util from "./util";

type State = {
    type: "Undo" | "Redo" | "None";
    stack: Mp.FileOperation | undefined;
};

export class History {
    private undoStack: Mp.FileOperation[] = [];
    private redoStack: Mp.FileOperation[] = [];
    private state: State = {
        type: "None",
        stack: undefined,
    };

    push(operation: Mp.FileOperation) {
        this.undoStack.push(operation);
    }

    async undo() {
        const rawStack = this.undoStack.pop();

        if (!rawStack) return rawStack;

        const stack = await this.validate(rawStack);

        if (!stack) return stack;

        this.state = {
            type: "Undo",
            stack,
        };
        this.redoStack.push(stack);

        const operation: Mp.FileOperation = {
            operation: "Copy",
            from: [],
            to: "",
            target: [],
            isFile: true,
        };

        switch (stack.operation) {
            case "Copy": {
                operation.operation = "Delete";
                operation.target = stack.from.map((from) => path.join(stack.to, path.basename(from)));
                break;
            }
            case "Move": {
                operation.operation = "Move";
                operation.from = stack.from.map((from) => path.join(stack.to, path.basename(from)));
                operation.to = path.dirname(stack.from[0]);
                break;
            }
            case "Trash": {
                operation.operation = "Undelete";
                operation.target = stack.target;
                break;
            }
            case "Create": {
                operation.operation = "Delete";
                operation.target = stack.target;
                break;
            }
            case "Rename": {
                operation.operation = "Rename";
                operation.from = [stack.to];
                operation.to = stack.from[0];
                break;
            }
        }

        return operation;
    }

    async redo() {
        const rawStack = this.redoStack.pop();

        if (!rawStack) return rawStack;

        const stack = await this.validate(rawStack);

        if (!stack) return stack;

        this.state = {
            type: "Redo",
            stack,
        };
        this.undoStack.push(stack);

        return stack;
    }

    private async validate(stack: Mp.FileOperation): Promise<Mp.FileOperation | undefined> {
        let validatedStack: Mp.FileOperation | undefined = stack;

        switch (stack.operation) {
            case "Copy":
            case "Move":
            case "Rename": {
                const from = await Promise.all(stack.from.map((a) => a).filter(async (b) => util.exists(b)));
                if (!from.length) {
                    validatedStack = undefined;
                }
                break;
            }
            case "Trash":
            case "Delete": {
                const target = await Promise.all(stack.target.map((a) => a).filter(async (b) => util.exists(b)));
                if (!target.length) {
                    validatedStack = undefined;
                }
                break;
            }
        }

        return validatedStack;
    }

    rollback() {
        if (!this.state.stack) return;

        const stack = this.state.type == "Undo" ? this.redoStack.pop() : this.undoStack.pop();
        if (stack) {
            this.state.type == "Undo" ? this.undoStack.push(stack) : this.redoStack.push(stack);
        }

        this.state = {
            type: "None",
            stack: undefined,
        };
    }
}
