/** Load the column-reorder layer (dnd-kit with it; issue #93). One function,
 *  so DataTable and Explorer share the loaded module through `useLazyModule`. */
export const loadColumnReorder = () => import("./ColumnReorder");
