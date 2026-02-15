import type { Cell } from "./yen";

type Props = {
  size: number;
  cells: Cell[];
  disabled?: boolean;
  onCellClick: (cellId: number) => void;
};

function cellLabel(v: string) {
  if (v === ".") return "";
  return v;
}

export default function Board({ size, cells, disabled = false, onCellClick }: Props) {
  // Agrupar por fila
  const rows: Cell[][] = Array.from({ length: size }, () => []);
  for (const cell of cells) rows[cell.row].push(cell);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((rowCells, r) => (
        <div key={r} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* indentación para forma triangular */}
          <div style={{ width: (size - r - 1) * 18 }} />
          {rowCells.map((cell) => {
            const isEmpty = cell.value === ".";
            const isClickable = isEmpty && !disabled;

            const bg =
              cell.value === "B" ? "#2563eb" :
              cell.value === "R" ? "#dc2626" :
              "#e5e7eb";

            const color = cell.value === "." ? "#111827" : "white";

            return (
              <button
                key={cell.cellId}
                onClick={() => isClickable && onCellClick(cell.cellId)}
                disabled={!isClickable}
                title={`cellId=${cell.cellId} coords=(${cell.coords.x},${cell.coords.y},${cell.coords.z})`}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: bg,
                  color,
                  cursor: isClickable ? "pointer" : "not-allowed",
                  opacity: disabled && isEmpty ? 0.6 : 1,
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  userSelect: "none",
                }}
              >
                {cellLabel(cell.value)}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
