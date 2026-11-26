/**
 * Search-split UI state (DESIGN §6.5, step 4) — the zustand slice
 * for the three independent search modes plus the selected area.
 *
 * Separate by construction: geo query, POI query + reveal set, and
 * the selected area are independent fields, and every clear action
 * touches exactly one of them. Layers live in the map store
 * (src/stores/atlas.ts) and are never written from here — clearing
 * search can never disable a layer. Selecting an area is map state,
 * not search state: clearing search never deselects the area.
 */
import { create } from 'zustand';
import {
  clearAllSearch,
  clearGeoSearch,
  clearPoiSearch,
  createSearchSplitState,
  revealPoiResult,
  type SearchSplitState,
} from '../domain/search';

export interface SearchSplitStore extends SearchSplitState {
  /** Geo search panel open (from the area selector). */
  geoOpen: boolean;
  /** Selected area node id, or null for all of Leonida. */
  selectedAreaId: string | null;
  /** Area page sheet open. Separate from the selection: picking a
   *  place closes the page (one sheet at a time) while the area —
   *  and its isolation — stay put. */
  areaPageOpen: boolean;
  setGeoQuery: (query: string) => void;
  setGeoOpen: (open: boolean) => void;
  clearGeo: () => void;
  setPoiQuery: (query: string) => void;
  clearPoi: () => void;
  /** Reveal exactly one POI record (§3.3) — nothing else appears. */
  revealRecord: (recordId: string) => void;
  /** Clear both search queries — reveals, area and layers untouched. */
  clearSearch: () => void;
  selectArea: (areaId: string | null) => void;
  setAreaPageOpen: (open: boolean) => void;
}

export const useSearchSplitStore = create<SearchSplitStore>()((set) => ({
  ...createSearchSplitState(),
  geoOpen: false,
  selectedAreaId: null,
  areaPageOpen: false,
  setGeoQuery: (query) => set((state) => ({ ...state, geo: { query } })),
  setGeoOpen: (geoOpen) => set({ geoOpen }),
  clearGeo: () => set((state) => clearGeoSearch(state)),
  setPoiQuery: (query) =>
    set((state) => ({ ...state, poi: { ...state.poi, query } })),
  clearPoi: () => set((state) => clearPoiSearch(state)),
  revealRecord: (recordId) => set((state) => revealPoiResult(state, recordId)),
  clearSearch: () => set((state) => clearAllSearch(state)),
  selectArea: (selectedAreaId) =>
    set({ selectedAreaId, areaPageOpen: selectedAreaId !== null }),
  setAreaPageOpen: (areaPageOpen) => set({ areaPageOpen }),
}));
