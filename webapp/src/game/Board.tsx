import { Button } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Cell } from "./yen";
import "../estilos/Cell.css";

type Props = {
  size: number;
  cells: Cell[];
  disabled?: boolean;
  onCellClick: (cellId: number) => void;
};

export default function Board({ size, cells, disabled = false, onCellClick }: Props) {
  const rows: Cell[][] = Array.from({ length: size }, () => []);
  for (const cell of cells) rows[cell.row].push(cell);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [availableWidth, setAvailableWidth] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateWidth = () => {
      setAvailableWidth(node.clientWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(node);
    window.addEventListener("resize", updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  const { cellSize, gap } = useMemo(() => {
    const horizontalPadding = 8;
    const safeWidth = Math.max(availableWidth - horizontalPadding, 0);

    const computedGap = safeWidth < 420 ? 4 : safeWidth < 768 ? 6 : 8;

    const minCellSize =
      safeWidth < 420 ? 22 :
      safeWidth < 768 ? 28 :
      32;

    const maxCellSize =
      safeWidth < 420 ? 38 : 50;

    const computedCellSize =
      size > 0
        ? Math.floor((safeWidth - (size - 1) * computedGap) / size)
        : maxCellSize;

    return {
      gap: computedGap,
      cellSize: Math.max(
        minCellSize,
        Math.min(maxCellSize, computedCellSize || maxCellSize)
      ),
    };
  }, [availableWidth, size]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "grid",
          gap,
          justifyItems: "center",
          width: "fit-content",
          maxWidth: "100%",
        }}
      >
        {rows.map((rowCells, r) => (
          <div
            key={r}
            style={{
              display: "flex",
              gap,
              alignItems: "center",
              justifyContent: "center",
              maxWidth: "100%",
            }}
          >
            {rowCells.map((cell) => {
              const isEmpty = cell.value === ".";
              const isClickable = isEmpty && !disabled;
              const isHint = cell.hint === true;

              const bg =
                isHint
                  ? "#52c41a"
                  : cell.value === "B"
                    ? "#28BBF5"
                    : cell.value === "R"
                      ? "#FF7B00"
                      : "#e8e8e8";

              return (
                <Button
                  key={cell.cellId}
                  className={`hexBtn${isHint ? " hexBtn--hint" : ""}`}
                  aria-label={`cell-${cell.cellId}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isClickable) onCellClick(cell.cellId);
                  }}
                  disabled={!isClickable}
                  style={{
                    width: cellSize,
                    minWidth: cellSize,
                    height: cellSize,
                    padding: 0,
                    background: bg,
                    color: isHint ? "white" : cell.value === "." ? "#111827" : "white",
                    fontWeight: 700,
                    fontSize: cellSize < 26 ? 10 : cellSize < 34 ? 12 : 14,
                    opacity: disabled && !isHint ? 0.65 : 1,
                    border: "none",
                    boxShadow: "none",
                  }}
                >
                  <span className="hexBtn__content">
                    {cell.value === "." ? "" : cell.value}
                  </span>
                </Button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}