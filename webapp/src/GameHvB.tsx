import { useMemo, useState } from "react";
import { humanVsBotMove, newGame, type YEN } from "./api/gamey";
import Board from "./game/Board";
import { parseYenToCells } from "./game/yen";

export default function GameHvB() {
  const [size, setSize] = useState(7);
  const [botId, setBotId] = useState("random_bot");

  const [yen, setYen] = useState<YEN | null>(null);
  const [statusText, setStatusText] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const cells = useMemo(() => {
    if (!yen) return [];
    return parseYenToCells(yen);
  }, [yen]);

  async function handleNewGame() {
    setError("");
    setStatusText("");
    setLoading(true);
    try {
      const r = await newGame(size);
      setYen(r.yen);
      setStatusText("Game created. Your move.");
      setGameOver(false);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleCellClick(cellId: number) {
    if (!yen || gameOver) return;

    setError("");
    setLoading(true);
    try {
      const r = await humanVsBotMove(botId, yen, cellId);
      setYen(r.yen);

      const human = `Human: cell ${r.human_move.cell_id}`;
      const bot = r.bot_move ? `Bot: cell ${r.bot_move.cell_id}` : "Bot: (no move)";
      const st = r.status.state === "finished"
        ? `Finished — winner: ${r.status.winner}`
        : `Ongoing — next: ${r.status.next}`;

      setStatusText(`${human} | ${bot} | ${st}`);
      setGameOver(r.status.state === "finished");
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: "system-ui", maxWidth: 1000, margin: "0 auto" }}>
      <h1>Y — Human vs Bot</h1>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <label>
          Size:
          <input
            type="number"
            min={2}
            value={size}
            onChange={(e) => setSize(parseInt(e.target.value, 10))}
            style={{ marginLeft: 8, width: 90 }}
            disabled={loading}
          />
        </label>

        <label>
          Bot ID:
          <input
            value={botId}
            onChange={(e) => setBotId(e.target.value)}
            style={{ marginLeft: 8, width: 180 }}
            disabled={loading}
          />
        </label>

        <button onClick={handleNewGame} disabled={loading} style={{ padding: "10px 14px", borderRadius: 10 }}>
          {loading ? "Working..." : "New game"}
        </button>
      </div>

      {error && (
        <div style={{ color: "#b91c1c", marginBottom: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {statusText && (
        <div style={{ marginBottom: 12, color: "#111827" }}>
          {statusText}
        </div>
      )}

      {!yen ? (
        <p>Create a new game to start.</p>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <Board
            size={yen.size}
            cells={cells}
            disabled={loading || gameOver}
            onCellClick={handleCellClick}
          />

          <details>
            <summary>Debug: current YEN</summary>
            <pre style={{ background: "#f6f6f6", padding: 12, borderRadius: 8, overflowX: "auto" }}>
              {JSON.stringify(yen, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
