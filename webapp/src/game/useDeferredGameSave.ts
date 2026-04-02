import { useRef, useState } from "react";
import { App } from "antd";

import {
  recordUserGame,
  type RecordUserGameRequest,
} from "../api/users";
import type { FinishedGamePayload } from "./SessionGamePage";
import { getUserSession } from "../utils/session";

type UseDeferredGameSaveResult = {
  authModalOpen: boolean;
  savingPendingGame: boolean;
  pendingFinishedGame: RecordUserGameRequest | null;
  canOfferGuestSave: boolean;
  saveGameForCurrentSession: (payload: RecordUserGameRequest) => Promise<void>;
  registerFinishedGame: (payload: RecordUserGameRequest | null) => Promise<void>;
  handleGuestSaveRequested: (_payload: FinishedGamePayload) => void;
  handleLoginSuccess: () => Promise<void>;
  closeAuthModal: () => void;
};

export default function useDeferredGameSave(): UseDeferredGameSaveResult {
  const { message } = App.useApp();

  const savedGameIdsRef = useRef<Set<string>>(new Set());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [savingPendingGame, setSavingPendingGame] = useState(false);
  const [pendingFinishedGame, setPendingFinishedGame] =
    useState<RecordUserGameRequest | null>(null);

  async function saveGameForCurrentSession(payload: RecordUserGameRequest) {
    const session = getUserSession();

    if (!session)
      throw new Error("No hay ninguna sesión iniciada.");

    if (savedGameIdsRef.current.has(payload.gameId))
      return;

    await recordUserGame(session.username, payload);
    savedGameIdsRef.current.add(payload.gameId);
  }

  async function registerFinishedGame(payload: RecordUserGameRequest | null) {
    if (!payload)
      return;
    if (savedGameIdsRef.current.has(payload.gameId))
      return;

    const session = getUserSession();

    if (session) {
      await saveGameForCurrentSession(payload);
      return;
    }

    setPendingFinishedGame(payload);
  }

  function handleGuestSaveRequested(_payload: FinishedGamePayload) {
    if (!pendingFinishedGame)
      return;
    setAuthModalOpen(true);
  }

  async function handleLoginSuccess() {
    if (!pendingFinishedGame)
      return;

    try {
      setSavingPendingGame(true);
      await saveGameForCurrentSession(pendingFinishedGame);
      message.success("La partida se ha guardado correctamente en tu cuenta.");
      setPendingFinishedGame(null);
      setAuthModalOpen(false);
    }
    catch (err: any) {
      message.error(
        err?.message ?? "No se pudo guardar la partida en tu cuenta."
      );
    }
    finally {
      setSavingPendingGame(false);
    }
  }

  function closeAuthModal() {
    setAuthModalOpen(false);
  }

  return {
    authModalOpen,
    savingPendingGame,
    pendingFinishedGame,
    canOfferGuestSave: !getUserSession() && !!pendingFinishedGame,
    saveGameForCurrentSession,
    registerFinishedGame,
    handleGuestSaveRequested,
    handleLoginSuccess,
    closeAuthModal,
  };
}