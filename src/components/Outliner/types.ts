import type { CSSProperties } from "react";

export type BulletId = string;

export interface Bullet {
  id: BulletId;
  /** Markdown source. */
  content: string;
  /** When true, children are hidden. */
  collapsed?: boolean;
  children?: Bullet[];
}

export type OutlinerValue = Bullet[];

/** Path through the tree, expressed as indices from root to bullet. */
export type BulletPath = number[];

/** Flattened entry produced by `flatVisible`. */
export interface FlatBullet {
  id: BulletId;
  bullet: Bullet;
  depth: number;
  hasChildren: boolean;
  path: BulletPath;
}

export interface OutlinerProps {
  value: OutlinerValue;
  onChange: (next: OutlinerValue) => void;
  /** Read-only mode (no edit, no tree ops). Default false. */
  readOnly?: boolean;
  /** Mint a new bullet id when the user creates a bullet.
   *  Default: `crypto.randomUUID()`. */
  generateId?: () => BulletId;
  /** Called when user clicks a [[wiki link]]. Receives the link name. */
  onWikiLinkClick?: (name: string) => void;
  /** Resolve a ((block-id)) to its bullet content (markdown).
   *  Return null to render a "missing reference" placeholder. */
  resolveBlockRef?: (id: BulletId) => string | null;
  className?: string;
  style?: CSSProperties;
}
