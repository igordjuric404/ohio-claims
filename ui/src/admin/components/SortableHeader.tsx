import { useState, useMemo } from "react";

export type SortDir = "asc" | "desc";
export type SortState = { col: string; dir: SortDir };

export function useSort<T>(items: T[], defaultCol: string, defaultDir: SortDir = "desc") {
  const [sort, setSort] = useState<SortState>({ col: defaultCol, dir: defaultDir });

  const toggle = (col: string) => {
    setSort(prev =>
      prev.col === col
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { col, dir: "desc" }
    );
  };

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      const va = (a as any)[sort.col];
      const vb = (b as any)[sort.col];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        return sort.dir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va);
      const sb = String(vb);
      return sort.dir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return arr;
  }, [items, sort.col, sort.dir]);

  return { sorted, sort, toggle };
}

export function SortTh({
  col,
  label,
  sort,
  onToggle,
  className,
}: {
  col: string;
  label: string;
  sort: SortState;
  onToggle: (col: string) => void;
  className?: string;
}) {
  const active = sort.col === col;
  const arrow = active ? (sort.dir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th
      className={`sortable-th ${active ? "sort-active" : ""} ${className ?? ""}`}
      onClick={() => onToggle(col)}
    >
      {label}{arrow}
    </th>
  );
}
