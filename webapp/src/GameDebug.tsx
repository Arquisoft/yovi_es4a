import { useState } from "react";
import { newGame, humanVsBotMove, type YEN } from "./api/gamey";

export default function GameDebug() {
  const [size, setSize] = useState(5);
  const [botId, setBotId] = useState("random_bot");
  const [cellId, setCellId] = useState(0);

  const [yen, setYen] = useState<YEN | null>(null);
  const [log, setLog] = useState("");
  const [error, setError] = useState("");

  async function onNew() {
    setError("");
    try {
      const r = await newGame(size);
      setYen(r.yen);
      setLog(`New game created. size=${size}`);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }

  async function onMove() {
    if (!yen) {
      setError("Create a game first.");
      return;
    }
    setError("");
    try {
      const r = await humanVsBotMove(botId, yen, cellId);
      setYen(r.yen);
      setLog(
        `Human: cell=${r.human_move.cell_id} coords=${JSON.stringify(r.human_move.coords)}\n` +
          (r.bot_move
            ? `Bot: cell=${r.bot_move.cell_id} coords=${JSON.stringify(r.bot_move.coords)}\n`
            : "Bot: (no move)\n") +
          `Status: ${JSON.stringify(r.status)}`
      );
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", maxWidth: 960 }}>
      <h2>Human vs Bot — Communication test</h2>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label>
          Size:
          <input
            type="number"
            min={2}
            value={size}
            onChange={(e) => setSize(parseInt(e.target.value, 10))}
            style={{ marginLeft: 8, width: 80 }}
          />
        </label>

        <label>
          Bot ID:
          <input value={botId} onChange={(e) => setBotId(e.target.value)} style={{ marginLeft: 8, width: 180 }} />
        </label>

        <button onClick={onNew}>New game</button>
      </div>

      <hr />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label>
          cellId:
          <input
            type="number"
            min={0}
            value={cellId}
            onChange={(e) => setCellId(parseInt(e.target.value, 10))}
            style={{ marginLeft: 8, width: 100 }}
          />
        </label>

        <button onClick={onMove} disabled={!yen}>
          Play (human + bot)
        </button>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <h3>Log</h3>
      <pre style={{ background: "#f6f6f6", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap" }}>{log}</pre>

      <h3>Current YEN</h3>
      <pre style={{ background: "#f6f6f6", padding: 12, borderRadius: 8, overflowX: "auto" }}>
        {yen ? JSON.stringify(yen, null, 2) : "No game yet"}
      </pre>
    </div>
  );
}
