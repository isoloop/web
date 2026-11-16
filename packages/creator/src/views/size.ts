/** A widget's size in the grid (M3e plan, decision 17). */
export type ViewSize = 's' | 'm' | 'l';

export const VIEW_SIZES: readonly ViewSize[] = ['s', 'm', 'l'];

/**
 * Each size's height in CSS pixels and how many grid columns it spans. The
 * view sets its own height; the page's grid reads `columns`.
 */
export const SIZE: Readonly<Record<ViewSize, { height: number; columns: number }>> = {
  s: { height: 140, columns: 1 },
  m: { height: 220, columns: 2 },
  l: { height: 320, columns: 3 },
};
