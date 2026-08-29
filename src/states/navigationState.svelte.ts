import { HOME, RECYCLE_BIN } from "../constants";
import path from "../path";
import util from "../util";
import { listState, ListUpdater } from "./listState.svelte";

type NavigationState = {
    back: Mp.NavigationHistory[];
    forward: Mp.NavigationHistory[];
    readonly canGoBack: boolean;
    readonly canGoForward: boolean;
    readonly canGoUpward: boolean;
};

export const state = $state<NavigationState>({
    back: [],
    forward: [],
    get canGoBack() {
        return this.back.length;
    },
    get canGoForward() {
        return this.forward.length;
    },
    get canGoUpward() {
        return !!path.dirname(listState.currentDir.fullPath) && listState.currentDir.fullPath != HOME && listState.currentDir.fullPath != RECYCLE_BIN;
    },
});
export { state as navigationState };

export class Navigation {
    static tryGoBack() {
        return state.canGoBack ? state.back[state.back.length - 1] : null;
    }

    static afterGoBack(selection: Mp.ItemSelection) {
        state.forward.push({ fullPath: listState.currentDir.fullPath, selection });
        return state.back.pop();
    }

    static tryGoForward() {
        return state.canGoForward ? state.forward[state.forward.length - 1] : null;
    }

    static afterGoForward(selection: Mp.ItemSelection) {
        state.back.push({ fullPath: listState.currentDir.fullPath, selection });
        return state.forward.pop();
    }

    static afterNavigate(navigation: Mp.Navigation, selection: Mp.ItemSelection) {
        state.forward.pop();
        state.back.push({ fullPath: listState.currentDir.fullPath, selection });
        if (navigation == "PathSelect") {
            return state.back.find((navhistory) => navhistory.fullPath == listState.currentDir.fullPath);
        } else {
            return undefined;
        }
    }

    static invalidate(removedMountPoints: string[]) {
        // If any paths of removed drive exist in history, clear history
        const invalidBackHistory = state.back.filter((history) => removedMountPoints.includes(util.getRootDirectory(history.fullPath)));
        if (invalidBackHistory.length) {
            state.back.length = 0;
        }

        const invalidForwardHistory = state.forward.filter((history) => removedMountPoints.includes(util.getRootDirectory(history.fullPath)));
        if (invalidForwardHistory.length) {
            state.forward.length = 0;
        }
    }

    static navigateUntil(navigation: Mp.Navigation, fullPath: string) {
        const target = navigation == "Back" ? $state.snapshot(state.back) : $state.snapshot(state.forward);
        target.reverse();
        for (const history of target) {
            if (history.fullPath == fullPath) {
                break;
            }

            const currenthistory = navigation == "Back" ? this.afterGoBack(history.selection) : this.afterGoForward(history.selection);

            if (currenthistory) {
                ListUpdater.changeDirectory(currenthistory.fullPath);
            }
        }
    }
}
