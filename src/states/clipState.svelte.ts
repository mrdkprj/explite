export type ClipState = {
    startId: string;
    clipping: boolean;
    moved: boolean;
    clipAreaStyle: string;
    clipPosition: ClipPosition;
    inverseX: boolean;
    inverseY: boolean;
};

export type ClipPosition = {
    startX: number;
    startY: number;
};

export const state: ClipState = $state({
    startId: "",
    clipAreaStyle: "",
    clipping: false,
    clipPosition: {
        startX: 0,
        startY: 0,
    },
    moved: false,
    inverseX: false,
    inverseY: false,
});

export { state as clipState };

export const startClip = (startId: string, position: ClipPosition) => {
    state.startId = startId;
    state.clipping = true;
    state.moved = false;
    state.clipPosition = { startY: position.startY, startX: position.startX };
    state.clipAreaStyle = `width=0px; height=0px; top=${position.startY}px; left=${position.startX}`;
};

export const moveClip = (x: number, y: number) => {
    const moveX = x - state.clipPosition.startX;
    const moveY = y - state.clipPosition.startY;
    const scaleX = moveX >= 0 ? 1 : -1;
    const scaleY = moveY >= 0 ? 1 : -1;
    const width = Math.abs(moveX);
    const height = Math.abs(moveY);
    const moved = Math.abs(moveX) > 10 || Math.abs(moveY) > 10;
    const inverseX = scaleX > 0;
    const inverseY = scaleY > 0;
    if (!state.moved && moved) {
        state.moved = true;
        state.clipAreaStyle = `transform:scale(${scaleX}, ${scaleY}); width:${width}px; height:${height}px; top:${state.clipPosition.startY}px; left:${state.clipPosition.startX}px;`;
        state.inverseX = inverseX;
        state.inverseY = inverseY;
    } else {
        (state.clipAreaStyle = `transform:scale(${scaleX}, ${scaleY}); width:${width}px; height:${height}px; top:${state.clipPosition.startY}px; left:${state.clipPosition.startX}px;`),
            (state.inverseX = inverseX);
        state.inverseY = inverseY;
    }
};

export const endClip = () => {
    state.clipping = false;
    state.moved = false;
    state.startId = "";
};
