import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createHvhGame,
  deleteHvhGame,
  hvhMove,
  putConfig,
  type YEN,
} from "../api/gamey";
import SessionGamePage from "../game/SessionGamePage";
import type {
  SessionGameMoveResponse,
  SessionGameStartResponse,
} from "../game/useSessionGame";
import useLocalVariantGameSave from "../game/useLocalVariantGameSave";
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

function rollDice(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % 6) + 1;
}

export default function GameFortuneDice() {
  const [searchParams] = useSearchParams();

  const size = parseBoardSize(searchParams.get("size"));
  const hvhStarter = parseHvHStarter(searchParams.get("hvhstarter"));

  const currentPlayerRef = useRef<TurnPlayer>("player0");
  const piecesLeftRef = useRef(rollDice());

  const [diceValue, setDiceValue] = useState(piecesLeftRef.current);
  const [piecesLeft, setPiecesLeft] = useState(piecesLeftRef.current);
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    setIsRolling(true);
    const timer = setTimeout(() => setIsRolling(false), 600);
    return () => clearTimeout(timer);
  }, [diceValue]);

  const { registerFinishedGame, registerAbandonedGame } =
    useLocalVariantGameSave({
      boardSize: size,
      mode: "fortune_dice_hvh",
      opponent: "Jugador local (Fortune Dado)",
      startedBy: hvhStarter,
      deleteGame: deleteHvhGame,
    });

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
    setDiceValue(firstRoll);
    setPiecesLeft(firstRoll);

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
    setDiceValue(nextRoll);
    setPiecesLeft(nextRoll);

    return {
      ...result,
      status: { state: "ongoing", next: nextPlayer },
    };
  }, []);

  return (
    <SessionGamePage<YEN>
      deps={[size, hvhStarter]}
      start={start}
      move={move}
      shouldCountMove={(turn) => turn === "player0"}
      onGameFinished={async ({ gameId, winner, totalMoves }) => {
        await registerFinishedGame(gameId, winner, totalMoves);
      }}
      onGameAbandoned={async ({ gameId, totalMoves }) => {
        await registerAbandonedGame(gameId, totalMoves);
      }}
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
