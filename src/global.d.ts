declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// cytoscape-fcose ships no types; it's a Cytoscape extension registered via
// `cytoscape.use(fcose)`. Only used by the Phase 2 `lab/` prototype (removed in
// Task 3.3 if Cytoscape loses).
declare module "cytoscape-fcose" {
  import type cytoscape from "cytoscape";

  const ext: cytoscape.Ext;
  export default ext;
}
