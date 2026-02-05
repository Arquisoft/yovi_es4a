export interface HexCoord {
    x: number;
    y: number;
    z: number;
}

export type Player = 'P1' | 'P2' | null;

export interface CellData {
    coords: HexCoord;
    player: Player;
}