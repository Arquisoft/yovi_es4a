/**
 * GameHoley.tsx — Variante "Holey Y"
 *
 * Antes de empezar, algunas casillas del tablero se marcan como agujeros
 * permanentemente bloqueados. Los jugadores no pueden colocar piezas en ellas.
 *
 * Implementación:
 *   - Usamos el backend HvH.
 *   - Generamos los agujeros aleatoriamente en el cliente antes de iniciar.
 *   - Bloqueamos esas casillas en el Board pasándolas como celdas `disabled`.
 *   - Si el jugador intenta clickar un agujero, rechazamos el movimiento.
 *   - Los agujeros se muestran visualmente como celdas oscuras en el Board.
 *
 * Número de agujeros: ~10% del total de celdas (mínimo 1, máximo 15% del tablero).
 */

import { useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert } from "antd";

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
  generateHoles,
  hasPlayableCells,
  LOCAL_HVH_TURN_CONFIG,
  LOCAL_HVH_WINNER_PALETTE,
  parseBoardSize,
  parseHvHStarter,
} from "../game/variants";

export default function GameHoley() {
  const [searchParams] = useSearchParams();

  const size = parseBoardSize(searchParams.get("size"));
  const hvhStarter = parseHvHStarter(searchParams.get("hvhstarter"));

  const totalCells = (size * (size + 1)) / 2;
  const [holes, setHoles] = useState<Set<number>>(() => generateHoles(totalCells));
  const holesRef = useRef<Set<number>>(holes);

  const move = useCallback(async (
    gameId: string,
    cellId: number,
  ): Promise<SessionGameMoveResponse<YEN>> => {
    // Rechazar si es un agujero (no debería ocurrir porque el Board lo deshabilita)
    if (holes.has(cellId)) {
      throw new Error("Esa casilla es un agujero y no se puede usar.");
    }
    const result = await hvhMove(gameId, cellId);

    if (result.status.state === "ongoing" && !hasPlayableCells(result.yen, holes)) {
      return {
        ...result,
        status: { state: "finished", winner: null },
      };
    }

    return result;
  }, [holes]);

  const start = useCallback(async (): Promise<SessionGameStartResponse<YEN>> => {
    // Regenerar agujeros al iniciar nueva partida
    const newHoles = generateHoles(totalCells);
    holesRef.current = newHoles;
    setHoles(newHoles);

    await putConfig({ size, hvb_starter: "human", bot_id: null, hvh_starter: hvhStarter });
    return createHvhGame({ size, hvh_starter: hvhStarter });
  }, [size, hvhStarter, totalCells]);

  return (
    <>
      <Alert
        message={`🕳️ ${holes.size} agujero(s) en el tablero — esas casillas están bloqueadas para siempre.`}
        type="info"
        showIcon
        style={{ marginBottom: 8, maxWidth: 600, margin: "0 auto 8px" }}
      />

      <LocalHvHSessionLayout<YEN>
        boardSize={size}
        mode="holey_hvh"
        opponent="Jugador local (Holey)"
        startedBy={hvhStarter}
        disabledCells={holes}
        deps={[size, hvhStarter]}
        start={start}
        move={move}
        shouldCountMove={(turn) => turn === "player0"}
        resultConfig={{
          title: "Juego Y — Holey Y",
          subtitle: `Tamaño: ${size} · ${holes.size} agujero(s) en el tablero`,
          abandonOkText: "Abandonar",
          getResultTitle: () => "Partida finalizada",
          getResultText: (winner) =>
            winner === "player0"
              ? "Player 0 ha ganado."
              : winner === "player1"
                ? "Player 1 ha ganado."
                : "No quedan casillas jugables fuera de los agujeros. La partida terminó en empate.",
        }}
        winnerPalette={LOCAL_HVH_WINNER_PALETTE}
        turnConfig={LOCAL_HVH_TURN_CONFIG}
      />
    </>
  );
}
