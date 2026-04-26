import { useSearchParams } from "react-router-dom";
import { useState, useCallback, useRef } from "react";
import {
  createHvhGame,
  deleteHvhGame,
  hvhMove,
  putConfig,
  type YEN,
} from "../api/gamey";
import SessionGamePage from "../game/SessionGamePage";
import { getUserSession } from "../utils/session";
import { recordUserGame } from "../api/users";
import "../estilos/VariantVisuals.css";

function parseBoardSize(raw: string | null): number {
  const parsed = Number(raw ?? "7");
  return Number.isFinite(parsed) && parsed >= 2 ? parsed : 7;
}

export default function GameMaster() {
  const [searchParams] = useSearchParams();
  const size = parseBoardSize(searchParams.get("size"));
  
  // State to track pieces left for the current player
  const [piecesLeft, setPiecesLeft] = useState(2);
  const nextPlayerRef = useRef<"player0" | "player1">("player0");

  const start = useCallback(async () => {
    setPiecesLeft(2);
    nextPlayerRef.current = "player0";
    await putConfig({ size, hvb_starter: "human", bot_id: null, hvh_starter: "player0" });
    const res = await createHvhGame({ size, hvh_starter: "player0" });
    return {
        ...res,
        status: { state: "ongoing", next: "player0" } as any
    };
  }, [size]);

  const move = useCallback(async (gameId: string, cellId: number) => {
    const currentPlayer = nextPlayerRef.current;
    const newPiecesLeft = piecesLeft === 2 ? 1 : 2;
    
    // Si quedan piezas por poner (estamos en la primera de las 2), forzamos que el "siguiente" siga siendo el actual
    const nextPlayerOverride = newPiecesLeft === 1 ? (currentPlayer === "player0" ? 0 : 1) : undefined;
    
    const res = await hvhMove(gameId, cellId, undefined, nextPlayerOverride);
    
    if (res.status.state === "finished") return { ...res, status: res.status as any };

    setPiecesLeft(newPiecesLeft);

    if (newPiecesLeft === 1) {
        // Still the same player's turn
        return {
            ...res,
            status: { ...res.status, next: nextPlayerRef.current } as any
        };
    } else {
        // Turn passes
        const next = nextPlayerRef.current === "player0" ? "player1" : "player0";
        nextPlayerRef.current = next;
        return {
            ...res,
            status: { ...res.status, next: next } as any
        };
    }
  }, [piecesLeft]);

  return (
    <SessionGamePage<YEN>
      deps={[size]}
      start={start}
      move={move}
      onGameFinished={async ({ gameId, winner, totalMoves }) => {
        const session = getUserSession();
        if (!session || !winner) return;
        
        await recordUserGame(session.username, {
          gameId,
          mode: "master_hvh",
          result: winner === "player0" ? "won" : "lost",
          boardSize: size,
          totalMoves,
          opponent: "Jugador local (Master Y)",
          startedBy: "player0",
        });
      }}
      onGameAbandoned={async ({ gameId, totalMoves }) => {
        const session = getUserSession();
        if (session) {
          await recordUserGame(session.username, {
            gameId,
            mode: "master_hvh",
            result: "abandoned",
            boardSize: size,
            totalMoves,
            opponent: "Jugador local (Master Y)",
            startedBy: "player0",
          });
        }
        await deleteHvhGame(gameId);
      }}
      resultConfig={{
        title: "Juego Y — Master Y (2 piezas/turno)",
        subtitle: `Tamaño: ${size} · Cada jugador coloca exactly 2 piezas`,
        getResultTitle: () => "Partida finalizada",
        getResultText: (winner) => `${winner === "player0" ? "Player 0" : "Player 1"} ha ganado.`
      }}
      winnerPalette={{
        highlightedWinner: "player0",
        highlightedBackground: "#28bbf532",
        otherWinnerBackground: "#ff7b0033",
      }}
      turnConfig={{
        textPrefix: `Master`,
        turns: {
          player0: { label: "Player 0", color: "#28BBF5" },
          player1: { label: "Player 1", color: "#FF7B00" },
        },
      }}
      turnIndicatorExtra={
        <div className={`moves-indicator move-active`} style={{ marginLeft: 8, display: "inline-flex" }}>
          <span>⚡</span> {piecesLeft} mov.
        </div>
      }
    />
  );
}
