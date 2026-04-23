import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { message, Typography } from "antd";

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
} from "../game/variants";
import AuthModal from "./registroLogin/AuthModal";
import "../estilos/VariantVisuals.css";

const { Text } = Typography;

type TurnPlayer = "player0" | "player1";

function flipCoin(): TurnPlayer {
  return Math.random() < 0.5 ? "player0" : "player1";
}

function describePlayer(player: TurnPlayer): string {
  return player === "player0" ? "Player 0 (Azul)" : "Player 1 (Naranja)";
}

export default function GameFortuneCoin() {
  const [searchParams] = useSearchParams();
  const size = parseBoardSize(searchParams.get("size"));
  const [isFlipping, setIsFlipping] = useState(false);

  const {
    authModalOpen,
    savingPendingGame,
    canOfferGuestSave,
    registerFinishedGame,
    registerAbandonedGame,
    handleGuestSaveRequested,
    handleLoginSuccess,
    closeAuthModal,
  } = useLocalVariantGameSave({
    boardSize: size,
    mode: "fortune_coin_hvh",
    opponent: "Jugador local (Fortune Moneda)",
    startedBy: "random",
    deleteGame: deleteHvhGame,
  });

  const animateCoin = useCallback(() => {
    setIsFlipping(true);
    window.setTimeout(() => setIsFlipping(false), 600);
  }, []);

  const start = useCallback(async (): Promise<SessionGameStartResponse<YEN>> => {
    const initialTurn = flipCoin();
    animateCoin();

    await putConfig({
      size,
      hvb_starter: "human",
      bot_id: null,
      hvh_starter: initialTurn,
    });

    const game = await createHvhGame({ size, hvh_starter: initialTurn });
    message.info(`🪙 Moneda lanzada: empieza ${describePlayer(initialTurn)}`);

    if (game.status.state === "ongoing") {
      return {
        ...game,
        status: { state: "ongoing", next: initialTurn },
      };
    }

    return game;
  }, [animateCoin, size]);

  const move = useCallback(async (
    gameId: string,
    cellId: number,
  ): Promise<SessionGameMoveResponse<YEN>> => {
    animateCoin();

    const nextPlayer = flipCoin();
    const nextPlayerOverride = nextPlayer === "player0" ? 0 : 1;
    const result = await hvhMove(gameId, cellId, undefined, nextPlayerOverride);

    if (result.status.state === "finished") {
      return result;
    }

    message.info(`🪙 Moneda lanzada: siguiente turno para ${describePlayer(nextPlayer)}`);
    return {
      ...result,
      status: { state: "ongoing", next: nextPlayer },
    };
  }, [animateCoin]);

  return (
    <>
      <SessionGamePage<YEN>
        deps={[size]}
        start={start}
        move={move}
        shouldCountMove={(turn) => turn === "player0"}
        onGameFinished={async ({ gameId, winner, totalMoves }) => {
          await registerFinishedGame(gameId, winner, totalMoves);
        }}
        onGameAbandoned={async ({ gameId, totalMoves }) => {
          await registerAbandonedGame(gameId, totalMoves);
        }}
        canOfferGuestSave={canOfferGuestSave}
        onGuestSaveRequested={handleGuestSaveRequested}
        guestSaveLoading={savingPendingGame}
        resultConfig={createLocalHvHResultConfig(
          "Juego Y - Fortune Moneda",
          size,
          "random",
          "Cada turno depende de una moneda",
        )}
        winnerPalette={LOCAL_HVH_WINNER_PALETTE}
        turnConfig={{
          ...LOCAL_HVH_TURN_CONFIG,
          textPrefix: "Moneda:",
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
            <div className={`coin-container ${isFlipping ? "coin-flipping" : ""}`}>
              🪙
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Lanzando...
            </Text>
          </div>
        }
      />

      <AuthModal
        open={authModalOpen}
        onClose={closeAuthModal}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}
