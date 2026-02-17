import { Button } from "antd";
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
  const rows: Cell[][] = Array.from({ length: size }, () => []);
  for (const cell of cells) rows[cell.row].push(cell);

  const cellSize = 45;
  const gap = 8;

  return (
    <div style={{ display: "grid", gap, justifyItems: "center" }}>
      {rows.map((rowCells, r) => (
        <div
          key={r}
          style={{
            display: "flex",
            gap,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {rowCells.map((cell) => {
            const isEmpty = cell.value === ".";
            const isClickable = isEmpty && !disabled;

            const bg =
              cell.value === "B" ? "#28BBF5" :
              cell.value === "R" ? "#FF7B00" :
              "#f0f0f0";

            const color = cell.value === "." ? "#111827" : "white";

            return (
              <Button
                shape="circle"
                onClick={() => isClickable && onCellClick(cell.cellId)}
                disabled={!isClickable}
                style={{
                  width: cellSize,
                  height: cellSize,
                  padding: 0,
                  background: bg,
                  color,
                  fontWeight: 700,
                  opacity: disabled ? 0.65 : 1,
                }}
              >
                {cell.value === "." ? "" : cell.value}
              </Button>

              /*
              <Button
                className="hexBtn"
                onClick={() => isClickable && onCellClick(cell.cellId)}
                disabled={!isClickable}
                style={{
                  width: cellSize,
                  height: cellSize,
                  padding: 0,
                  background: bg,
                  color,
                  fontWeight: 700,
                  opacity: disabled ? 0.65 : 1,
                  border: "none",
                }}
              >
                {cell.value === "." ? "" : cell.value}
              </Button>
              */
            );
          })}
        </div>
      ))}
    </div>
  );
}
