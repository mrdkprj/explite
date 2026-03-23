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

        // We would use e.relatedTarget to detect if the drag is still inside the drop target,
        // but it is always null in WebKit. https://bugs.webkit.org/show_bug.cgi?id=66547
        // Instead, we track all of the targets of dragenter events in a set, and remove them
        // in dragleave. When the set becomes empty, we've left the drop target completely.
        // We must also remove any elements that are no longer in the DOM, because dragleave
        // events will never be fired for these. This can happen, for example, with drop
        // indicators between items, which disappear when the drop target changes

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
