type HeaderState = {
    pathEditing: boolean;
    search: SearchState;
};

type SearchState = {
    searching: boolean;
    key: string;
};

const state: HeaderState = $state({
    pathEditing: false,
    search: {
        searching: false,
        key: "",
    },
});

export { state as headerState };

export class HeaderUpdater {
    static resetSearch = () => {
        state.search = { ...state.search, searching: false, key: "" };
    };

    static startSearch = () => {
        state.search = { ...state.search, searching: true, key: state.search.key.trim() };
    };
}
