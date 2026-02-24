type ClipState = {
    startId: string;
    clipping: boolean;
    moved: boolean;
    clipAreaStyle: string;
    clipStartPosition: Mp.Position;
    inverseX: boolean;
    inverseY: boolean;
};

const state: ClipState = $state({
    startId: "",
    clipAreaStyle: "",
    clipping: false,
    clipStartPosition: {
        x: 0,
        y: 0,
    },
    moved: false,
    inverseX: false,
    inverseY: false,
});

export { state as clipState };

export class ClipUpdater {
    static startClip = (startId: string, position: Mp.Position) => {
        state.startId = startId;
        state.clipping = true;
        state.moved = false;
        state.clipStartPosition = { y: position.y, x: position.x };
        state.clipAreaStyle = `width:0px; height:0px; top:${position.y}px; left:${position.x}px;`;
    };

    static moveClip = (x: number, y: number) => {
        const moveX = x - state.clipStartPosition.x;
        const moveY = y - state.clipStartPosition.y;
        const scaleX = moveX >= 0 ? 1 : -1;
        const scaleY = moveY >= 0 ? 1 : -1;
        const width = Math.abs(moveX);
        const height = Math.abs(moveY);
        const moved = Math.abs(moveX) > 10 || Math.abs(moveY) > 10;
        const inverseX = scaleX > 0;
        const inverseY = scaleY > 0;
        if (!state.moved && moved) {
            state.moved = true;
            state.clipAreaStyle = `transform:scale(${scaleX}, ${scaleY}); width:${width}px; height:${height}px; top:${state.clipStartPosition.y}px; left:${state.clipStartPosition.x}px;`;
            state.inverseX = inverseX;
            state.inverseY = inverseY;
        } else {
            ((state.clipAreaStyle = `transform:scale(${scaleX}, ${scaleY}); width:${width}px; height:${height}px; top:${state.clipStartPosition.y}px; left:${state.clipStartPosition.x}px;`),
                (state.inverseX = inverseX));
            state.inverseY = inverseY;
        }
    };
    static endClip = () => {
        state.clipping = false;
        state.moved = false;
        state.startId = "";
    };
}
