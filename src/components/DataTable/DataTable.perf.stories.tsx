import type { Story } from "@ladle/react";
import { useState } from "react";
import { DataTable } from "./DataTable";
import type { ColumnDef } from "./types";

export default { title: "Perf/DataTable" };

// Deterministic 10k-row grid for the perf probes (scripts/perf/scenarios/
// datatable.mjs): sortable + filterable + resizable, so sort clicks, filter
// keystrokes, and column-resize steps can be measured. Doubles as a manual
// stress story. Never use Math.random here — numbers must be reproducible.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Row {
  name: string;
  team: string;
  score: number;
  active: boolean;
}

const TEAMS = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];

function seedRows(count: number): Row[] {
  const rand = mulberry32(7);
  return Array.from({ length: count }, (_, i) => ({
    name: `Row ${i} ${Math.floor(rand() * 1e6).toString(36)}`,
    team: TEAMS[Math.floor(rand() * TEAMS.length)] as string,
    score: Math.floor(rand() * 10_000),
    active: rand() > 0.5,
  }));
}

const columns: ColumnDef<Row>[] = [
  { id: "name", header: "Name", accessor: "name", sortable: true, edit: { type: "text" } },
  { id: "team", header: "Team", accessor: "team", sortable: true },
  { id: "score", header: "Score", accessor: "score", align: "end", sortable: true },
  { id: "active", header: "Active", accessor: "active" },
];

/** 10k rows, sortable/filterable/resizable — the perf-probe target. */
export const PerfGrid: Story = () => {
  const [data] = useState<Row[]>(() => seedRows(10_000));
  return (
    <div data-perf-ready="">
      <DataTable data={data} columns={columns} height={480} filterableColumns />
    </div>
  );
};
