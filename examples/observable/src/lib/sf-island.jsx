/** @jsxImportSource react */
// Experiment 3/5 (issue #52): one React instance for embedded swiss-function.
//
// Framework transpiles inline ```jsx blocks with jsxImportSource hardcoded to
// "npm:react" (jsDelivr, unpinned), while node_modules imports resolve through
// its node channel to the locally installed react. Mixing the two puts two
// React copies in one tree and breaks hooks. The pragma above makes esbuild
// emit `react/jsx-runtime` as a bare import for THIS module, so everything
// here (JSX runtime, react-dom, swiss-function's react peer) resolves to the
// same local node_modules react.
import {useMemo, useState} from "react";
import {createRoot} from "react-dom/client";
// sf-bundle.js is produced by scripts/bundle-sf.mjs: the package's deep
// entries can't be consumed directly because Framework's node bundler drops
// the secondary chunk created by a dynamic import() inside the package.
import {Button, Field, Input, DatePicker, DataTable} from "./sf-bundle.js";

function Playground() {
  const [count, setCount] = useState(0);
  const [date, setDate] = useState(null);
  return (
    <div style={{display: "grid", gap: "calc(var(--sf-unit) * 2)", maxWidth: "48rem"}}>
      <div style={{display: "flex", gap: "var(--sf-unit)", alignItems: "center"}}>
        <Button variant="primary" onClick={() => setCount((c) => c + 1)}>
          Clicked {count} times
        </Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
      </div>
      <Field orientation="vertical">
        <Field.Label>Email</Field.Label>
        <Input type="email" placeholder="jane@example.org" />
        <Field.Description>Hooks state above proves a single React instance.</Field.Description>
      </Field>
      <Field orientation="vertical">
        <Field.Label>Value date</Field.Label>
        <DatePicker value={date} onChange={setDate} />
        <Field.Description>The popup calendar exercises portals and focus management.</Field.Description>
      </Field>
    </div>
  );
}

export function mountPlayground(node) {
  const root = createRoot(node);
  root.render(<Playground />);
  return () => root.unmount();
}

function ResultsTable({rows, columns}) {
  const cols = useMemo(
    () =>
      columns.map((c) => ({
        id: c,
        header: c,
        accessor: c,
        cell: c === "ts" ? ({value}) => (value instanceof Date ? value.toISOString().slice(0, 19) : String(value)) : undefined,
      })),
    [columns]
  );
  return (
    <div style={{height: "24rem"}}>
      <DataTable data={rows} columns={cols} />
    </div>
  );
}

// Mounts a DataTable over materialized rows; returns an update function so a
// reactive js block can push fresh query results into the same root.
export function mountResultsTable(node, columns) {
  const root = createRoot(node);
  return {
    update(rows) {
      root.render(<ResultsTable rows={rows} columns={columns} />);
    },
    dispose() {
      root.unmount();
    },
  };
}
