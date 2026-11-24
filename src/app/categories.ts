import type { Category } from '../domain/types';

/** Kinds of places — the "Kind" picker in Find and the marker editor. */
export const CATEGORIES: { id: Category | 'all'; name: string }[] = [
  { id: 'all', name: 'All kinds' },
  { id: 'region', name: 'Regions' },
  { id: 'landmark', name: 'Landmarks' },
  { id: 'nature', name: 'Nature' },
  { id: 'transport', name: 'Transport' },
  { id: 'business', name: 'Businesses' },
  { id: 'personal', name: 'My markers' },
];
