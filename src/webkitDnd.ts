import { OS } from "./constants";

export default class WebkitDnd {
    private manage = false;
    private dragOverElements = new Set<Element>();

    constructor(agent: string) {
        this.manage = agent.includes(OS.linux);
    }

    add(element: Element) {
        if (!this.manage) return;
        this.dragOverElements.add(element);
    }

    delete(element: Element) {
        if (!this.manage) return;
        this.dragOverElements.delete(element);
    }

    onDragLeave(element: Element, currentTarget: Node | undefined) {
        if (!this.manage) return;
        this.delete(element);

        if (!currentTarget) return;

        for (let element of this.dragOverElements) {
            if (!currentTarget.contains(element)) {
                this.dragOverElements.delete(element);
            }
        }
    }

    clear() {
        if (!this.manage) return;
        this.dragOverElements.clear();
    }

    isDrop() {
        return this.manage ? this.dragOverElements.size == 0 : false;
    }
}
