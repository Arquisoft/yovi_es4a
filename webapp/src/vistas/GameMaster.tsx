import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createHvhGame,
  hvhMove,
  putConfig,
  type YEN,
} from "../api/gamey";
import LocalHvHSessionLayout from "../game/LocalHvHSessionLayout";
import type {
  SessionGameMoveResponse,
  SessionGameStartResponse,
} from "../game/useSessionGame";
import {
  createLocalHvHResultConfig,
  LOCAL_HVH_TURN_CONFIG,
  LOCAL_HVH_WINNER_PALETTE,
  parseBoardSize,
  parseHvHStarter,
} from "../game/variants";
import "../estilos/VariantVisuals.css";

type TurnPlayer = "player0" | "player1";

function oppositePlayer(player: TurnPlayer): TurnPlayer {
  return player === "player0" ? "player1" : "player0";
}

export default function GameMaster() {
  const [searchParams] = useSearchParams();

  const size = parseBoardSize(searchParams.get("size"));
  const hvhStarter = parseHvHStarter(searchParams.get("hvhstarter"));

  const [piecesLeft, setPiecesLeft] = useState(2);
  const currentPlayerRef = useRef<TurnPlayer>("player0");

  const start = useCallback(async (): Promise<SessionGameStartResponse<YEN>> => {
    setPiecesLeft(2);

    await putConfig({
      size,
      hvb_starter: "human",
      bot_id: null,
      hvh_starter: hvhStarter,
    });

    const game = await createHvhGame({ size, hvh_starter: hvhStarter });
    if (game.status.state === "ongoing") {
      currentPlayerRef.current = (game.status.next ?? "player0") as TurnPlayer;
      return {
        ...game,
        status: { state: "ongoing", next: currentPlayerRef.current },
      };
    }

    return game;
  }, [hvhStarter, size]);

  const move = useCallback(async (
    gameId: string,
    cellId: number,
  ): Promise<SessionGameMoveResponse<YEN>> => {
    const currentPlayer = currentPlayerRef.current;
    const remainingAfterMove = piecesLeft === 2 ? 1 : 2;

    const nextPlayerOverride =
      remainingAfterMove === 1 ? (currentPlayer === "player0" ? 0 : 1) : undefined;

    const result = await hvhMove(gameId, cellId, undefined, nextPlayerOverride);

    if (result.status.state === "finished") {
      return result;
    }

    setPiecesLeft(remainingAfterMove);

    if (remainingAfterMove === 1) {
      return {
        ...result,
        status: { state: "ongoing", next: currentPlayer },
      };
    }

    const nextPlayer = oppositePlayer(currentPlayer);
    currentPlayerRef.current = nextPlayer;
    return {
      ...result,
      status: { state: "ongoing", next: nextPlayer },
    };
  }, [piecesLeft]);

  return (
    <LocalHvHSessionLayout<YEN>
      boardSize={size}
      mode="master_hvh"
      opponent="Jugador local (Master Y)"
      startedBy={hvhStarter}
      deps={[size, hvhStarter]}
      start={start}
      move={move}
      shouldCountMove={(turn) => turn === "player0"}
      resultConfig={createLocalHvHResultConfig(
        "Juego Y - Master Y",
        size,
        hvhStarter,
        "Cada turno obliga a colocar 2 piezas",
      )}
      winnerPalette={LOCAL_HVH_WINNER_PALETTE}
      turnConfig={{
        ...LOCAL_HVH_TURN_CONFIG,
        textPrefix: "Master:",
      }}
      turnIndicatorExtra={
        <div
          className="moves-indicator move-active"
          style={{ marginLeft: 8, display: "inline-flex" }}
        >
          <span>⚡</span> {piecesLeft} mov.
        </div>
      }
    />
  );
}
