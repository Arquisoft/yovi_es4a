/**
 * GameTabu.tsx — Variante "Tabu Y"
 *
 * Prohibido colocar ficha en una casilla adyacente a la última ficha
 * colocada por el oponente.
 *
 * Implementación:
 *   - Usamos el backend HvH.
 *   - Rastreamos el `lastOpponentCellId` localmente.
 *   - Calculamos las celdas adyacentes a esa celda y las marcamos como
 *     deshabilitadas pasando una lista de `blockedCells` a la UI.
 *   - Si el jugador intenta clickar una celda prohibida, la ignoramos
 *     (Board ya la marca disabled, así que no llega el evento).
 *
 * Las adyacencias se calculan con la misma lógica baricéntrica del backend.
 */

import { useRef, useState, useCallback } from "react";
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
  getAdjacentCells,
  hasPlayableCells,
  LOCAL_HVH_PLAYER_LABELS,
  LOCAL_HVH_WINNER_PALETTE,
  parseBoardSize,
  parseHvHStarter,
} from "../../game/variants";

type TurnPlayer = "player0" | "player1";

export default function GameTabu() {
  const [searchParams] = useSearchParams();

  const size = parseBoardSize(searchParams.get("size"));
  const hvhStarter = parseHvHStarter(searchParams.get("hvhstarter"));

  const lastMoveByPlayerRef = useRef<Record<TurnPlayer, number | null>>({
    player0: null,
    player1: null,
  });
  const currentPlayerRef = useRef<TurnPlayer>("player0");

  const [tabuCells, setTabuCells] = useState<Set<number>>(new Set());

  const move = useCallback(async (
    gameId: string,
    cellId: number,
  ): Promise<SessionGameMoveResponse<YEN>> => {
    const player = currentPlayerRef.current;
    const opponent: TurnPlayer = player === "player0" ? "player1" : "player0";

    const result = await hvhMove(gameId, cellId);

    // Registrar la jugada del jugador actual
    lastMoveByPlayerRef.current[player] = cellId;

    if (result.status.state === "ongoing") {
      currentPlayerRef.current = opponent;
      // Las celdas tabú para el próximo turno son las adyacentes a la jugada del jugador actual
      const newTabu = getAdjacentCells(cellId, size);
      setTabuCells(newTabu);

      if (!hasPlayableCells(result.yen, newTabu)) {
        return {
          ...result,
          status: { state: "finished", winner: null },
        };
      }
    } else {
      setTabuCells(new Set());
    }

    return result;
  }, [size]);

  const start = useCallback(async (): Promise<SessionGameStartResponse<YEN>> => {
    lastMoveByPlayerRef.current = { player0: null, player1: null };
    currentPlayerRef.current = "player0";
    setTabuCells(new Set());

    await putConfig({ size, hvb_starter: "human", bot_id: null, hvh_starter: hvhStarter });
    return createHvhGame({ size, hvh_starter: hvhStarter });
  }, [size, hvhStarter]);

  return (
    <LocalHvHSessionLayout<YEN>
      boardSize={size}
      mode="tabu_hvh"
      opponent="Jugador local (Tabu)"
      startedBy={hvhStarter}
      disabledCells={tabuCells}
      deps={[size, hvhStarter]}
      start={start}
      move={move}
      shouldCountMove={(turn) => turn === "player0"}
      resultConfig={{
        title: "Juego Y — Tabu Y",
        subtitle: `Tamaño: ${size} · No puedes jugar adyacente al rival`,
        abandonOkText: "Abandonar",
        getResultTitle: () => "Partida finalizada",
        getResultText: (winner) =>
          winner === "player0"
            ? "Player 0 ha ganado."
            : winner === "player1"
              ? "Player 1 ha ganado."
              : "Ningún jugador tiene movimientos válidos. La partida terminó en empate.",
      }}
      winnerPalette={LOCAL_HVH_WINNER_PALETTE}
      turnConfig={{
        textPrefix: `🚫 ${tabuCells.size} casilla(s) prohibida(s) — turno:`,
        turns: {
          player0: { label: LOCAL_HVH_PLAYER_LABELS.player0, color: "#28BBF5" },
          player1: { label: LOCAL_HVH_PLAYER_LABELS.player1, color: "#FF7B00" },
        },
      }}
    />
  );
}
