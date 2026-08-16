// Shared drag-and-drop context. Wrap a subtree in `SfDndProvider` so every
// swiss-function widget in it joins one dnd-kit runtime (no nested contexts),
// and the host can drop its own draggables onto a widget's rows/nodes via each
// widget's `onExternalDrop`. Without a provider, widgets render their own
// context exactly as before.

export {
  regionIdOf,
  SF_REGION_KEY,
  type SfDndRegion,
  type SfDndRegistry,
  useSfDnd,
  useSfDndRegion,
} from "./context";
export { SfDndProvider, type SfDndProviderProps } from "./SfDndProvider";
