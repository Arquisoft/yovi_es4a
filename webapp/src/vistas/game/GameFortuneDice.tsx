import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createHvhGame,
  hvhMove,
  putConfig,
  type YEN,
} from "../../api/gamey";
import LocalHvHSessionLayout from "../../game/LocalHvHSessionLayout";
import type {
  SessionGameMoveResponse,
  SessionGameStartResponse,
} from "../../game/useSessionGame";
import {
  createLocalHvHResultConfig,
  LOCAL_HVH_TURN_CONFIG,
  LOCAL_HVH_WINNER_PALETTE,
  parseBoardSize,
  parseHvHStarter,
} from "../../game/variants";
import "../../estilos/VariantVisuals.css";

type TurnPlayer = "player0" | "player1";

function oppositePlayer(player: TurnPlayer): TurnPlayer {
  return player === "player0" ? "player1" : "player0";
}

function rollDice(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % 6) + 1;
}

export default function GameFortuneDice() {
  const [searchParams] = useSearchParams();

  const size = parseBoardSize(searchParams.get("size"));
  const hvhStarter = parseHvHStarter(searchParams.get("hvhstarter"));
  const [diceValue, setDiceValue] = useState(() => rollDice());
  const [piecesLeft, setPiecesLeft] = useState(diceValue);

  const currentPlayerRef = useRef<TurnPlayer>("player0");
  const piecesLeftRef = useRef(diceValue);
  const rollTimerRef = useRef<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const showRoll = useCallback((value: number) => {
    if (rollTimerRef.current !== null) {
      window.clearTimeout(rollTimerRef.current);
    }

    setIsRolling(true);
    setDiceValue(value);
    rollTimerRef.current = window.setTimeout(() => {
      setIsRolling(false);
      rollTimerRef.current = null;
    }, 600);
  }, []);

  useEffect(() => () => {
    if (rollTimerRef.current !== null) {
      window.clearTimeout(rollTimerRef.current);
    }
  }, []);

  const start = useCallback(async (): Promise<SessionGameStartResponse<YEN>> => {
    await putConfig({
      size,
      hvb_starter: "human",
      bot_id: null,
      hvh_starter: hvhStarter,
    });

    const game = await createHvhGame({ size, hvh_starter: hvhStarter });
    const firstRoll = rollDice();

    piecesLeftRef.current = firstRoll;
    showRoll(firstRoll);
    setPiecesLeft(firstRoll);

    if (game.status.state === "ongoing") {
      currentPlayerRef.current = (game.status.next ?? "player0") as TurnPlayer;
      return {
        ...game,
        status: { state: "ongoing", next: currentPlayerRef.current },
      };
    }

    return game;
  }, [hvhStarter, showRoll, size]);

  const move = useCallback(async (
    gameId: string,
    cellId: number,
  ): Promise<SessionGameMoveResponse<YEN>> => {
    const currentPlayer = currentPlayerRef.current;
    const nextPlayerOverride =
      piecesLeftRef.current > 1 ? (currentPlayer === "player0" ? 0 : 1) : undefined;

    const result = await hvhMove(gameId, cellId, undefined, nextPlayerOverride);

    if (result.status.state === "finished") {
      return result;
    }

    piecesLeftRef.current -= 1;

    if (piecesLeftRef.current > 0) {
      setPiecesLeft(piecesLeftRef.current);
      return {
        ...result,
        status: { state: "ongoing", next: currentPlayer },
      };
    }

    const nextPlayer = oppositePlayer(currentPlayer);
    const nextRoll = rollDice();

    currentPlayerRef.current = nextPlayer;
    piecesLeftRef.current = nextRoll;
    showRoll(nextRoll);
    setPiecesLeft(nextRoll);

    return {
      ...result,
      status: { state: "ongoing", next: nextPlayer },
    };
  }, [showRoll]);

  return (
    <LocalHvHSessionLayout<YEN>
      boardSize={size}
      mode="fortune_dice_hvh"
      opponent="Jugador local (Fortune Dado)"
      startedBy={hvhStarter}
      deps={[size, hvhStarter]}
      start={start}
      move={move}
      shouldCountMove={(turn) => turn === "player0"}
      resultConfig={createLocalHvHResultConfig(
        "Juego Y - Fortune Dado",
        size,
        hvhStarter,
        "Las piezas por turno dependen del dado",
      )}
      winnerPalette={LOCAL_HVH_WINNER_PALETTE}
      turnConfig={{
        ...LOCAL_HVH_TURN_CONFIG,
        textPrefix: "Dado:",
      }}
      turnIndicatorExtra={
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            marginLeft: 8,
          }}
        >
          <div className={`dice-container ${isRolling ? "dice-rolling" : ""}`}>
            {diceValue}
          </div>
          <div className="moves-indicator move-active">
            {piecesLeft} piezas
          </div>
        </div>
      }
    />
  );
}
