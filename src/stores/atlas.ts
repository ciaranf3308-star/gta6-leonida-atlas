import { create } from 'zustand';
import type { Filters, LayerDefinition, Place, Position, UserData } from '../domain/types';
import type { MapBounds } from '../features/map/coordinates';
import type { Isolation } from '../features/map/isolation';
import { EMPTY_USER_DATA } from '../domain/types';
import {
  AtlasDatabase,
  atlasRepository,
  ConflictError,
  replaceAtlasRepository,
  workspaceDatabaseName,
} from '../db/repository';
import { atlasRegistry } from '../plugins/registry';
import { parseBackup } from '../db/backup';

export const DEFAULT_FILTERS: Filters = {
  query: '',
  category: 'all',
  favoritesOnly: false,
  personalOnly: false,
  evidence: 'all',
  collectionId: null,
  countyId: null,
  area: null,
  hideFound: false,
  remainingOnly: false,
  enterableOnly: false,
  lootableOnly: false,
  interiorHouseOnly: false,
  venueType: 'all',
  sortNearest: false,
};
export const useDomainStore = create<{
  places: Place[];
  status: 'loading' | 'ready' | 'error';
  error: string;
  setPlaces: (places: Place[]) => void;
  fail: (error: string) => void;
}>((set) => ({
  places: [],
  status: 'loading',
  error: '',
  setPlaces: (places) => set({ places, status: 'ready', error: '' }),
  fail: (error) => set({ status: 'error', error }),
}));
export const useMapStore = create<{
  selectedId: string | null;
  focus: { position: Position; requestId: number } | null;
  /** Fit the map to these bounds (county picker, "show all"). */
  boundsFocus: { bounds: MapBounds; requestId: number } | null;
  /** Area isolation (v0.14.0): the county/area on the map is lit and
   * named, everything outside it is dimmed. Null = all of Leonida. */
  isolation: Isolation | null;
  layers: LayerDefinition[];
  editorMode: 'none' | 'create' | 'move';
  draftPosition: Position | null;
  /** New-marker preset from the map overlay ("+ Workout spot"). */
  markerKindPreset: 'workout' | 'breakable' | null;
  /** Ask Nylah highlights — ids the last answer pointed at. Never a layer. */
  highlightIds: string[];
  /** The map centre, from the map's own viewport reports — the Find list
   * sorts nearest-first from here. Null until the map reports. */
  mapCenter: Position | null;
  setLayers: (layers: LayerDefinition[]) => void;
  select: (place: Place | null) => void;
  setEditor: (mode: 'none' | 'create' | 'move') => void;
  setPosition: (position: Position) => void;
  setMarkerKindPreset: (kind: 'workout' | 'breakable' | null) => void;
  setBoundsFocus: (bounds: MapBounds) => void;
  setIsolation: (isolation: Isolation | null) => void;
  setHighlights: (ids: string[]) => void;
  clearHighlights: () => void;
  setMapCenter: (center: Position) => void;
}>((set) => ({
  selectedId: null,
  focus: null,
  boundsFocus: null,
  isolation: null,
  layers: [],
  editorMode: 'none',
  draftPosition: null,
  markerKindPreset: null,
  highlightIds: [],
  mapCenter: null,
  setLayers: (layers) => set({ layers }),
  select: (place) => {
    set((state) => ({
      selectedId: place?.id ?? null,
      focus: place?.position
        ? { position: place.position, requestId: (state.focus?.requestId ?? 0) + 1 }
        : null,
      editorMode: 'none',
      draftPosition: null,
    }));
    atlasRegistry.emit('selection', place?.id ?? null);
  },
  setEditor: (editorMode) => set({ editorMode, draftPosition: null }),
  setPosition: (draftPosition) => set({ draftPosition }),
  setMarkerKindPreset: (markerKindPreset) => set({ markerKindPreset }),
  setBoundsFocus: (bounds) =>
    set((state) => ({
      boundsFocus: { bounds, requestId: (state.boundsFocus?.requestId ?? 0) + 1 },
    })),
  setIsolation: (isolation) => set({ isolation }),
  setHighlights: (highlightIds) => set({ highlightIds }),
  clearHighlights: () => set({ highlightIds: [] }),
  setMapCenter: (mapCenter) => set({ mapCenter }),
}));
/**
 * Bottom navigation — the one way around the app. Five labelled tabs for
 * the five real jobs: Map, Find, Layers, Saved, Ask. The panel tabs
 * (Find / Layers / Saved) open the panel; Map closes it; Ask opens the
 * Ask sheet. One sheet at a time: opening a panel tab or Ask closes any
 * place detail on a phone, and picking a place closes the panel and Ask.
 */
export type NavTab = 'map' | 'explore' | 'layers' | 'saved' | 'ask';
export const useUiStore = create<{
  filters: Filters;
  navTab: NavTab;
  /** Ask Nylah sheet open — controlled here so the bottom nav, the panel
   * and place selection can never stack two sheets. */
  askOpen: boolean;
  dialog: 'settings' | 'backup' | null;
  editorOpen: boolean;
  setFilters: (filters: Partial<Filters>) => void;
  resetFilters: () => void;
  setNavTab: (tab: NavTab) => void;
  setAskOpen: (open: boolean) => void;
  setDialog: (dialog: 'settings' | 'backup' | null) => void;
  setEditorOpen: (open: boolean) => void;
}>((set) => ({
  filters: DEFAULT_FILTERS,
  navTab: 'map',
  askOpen: false,
  dialog: null,
  editorOpen: false,
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
  setNavTab: (navTab) => set({ navTab }),
  setAskOpen: (askOpen) => set({ askOpen }),
  setDialog: (dialog) => set({ dialog }),
  setEditorOpen: (editorOpen) => set({ editorOpen }),
}));
export const useUserStore = create<UserData>(() => structuredClone(EMPTY_USER_DATA));
export const useWorkspaceStore = create<{
  workspaceId: string | null;
  switching: boolean;
  revision: number;
}>(() => ({ workspaceId: null, switching: false, revision: 0 }));
export const usePersistenceStore = create<{
  status: 'loading' | 'saved' | 'saving' | 'error';
  error: string;
  offline: boolean;
  ready: boolean;
}>(() => ({
  status: 'loading',
  error: '',
  offline: typeof navigator !== 'undefined' && !navigator.onLine,
  ready: false,
}));

let generation = 0;
let publication = 0;
export async function hydrateUserData() {
  if (useWorkspaceStore.getState().switching || pending) return;
  const requestedGeneration = generation;
  const requestedPublication = ++publication;
  const repository = atlasRepository;
  try {
    const data = await repository.load();
    if (
      requestedGeneration !== generation ||
      requestedPublication !== publication ||
      repository !== atlasRepository
    )
      return;
    useUserStore.setState(data);
    usePersistenceStore.setState({ status: 'saved', error: '', ready: true });
  } catch {
    if (
      requestedGeneration !== generation ||
      requestedPublication !== publication ||
      repository !== atlasRepository
    )
      return;
    usePersistenceStore.setState({
      status: 'error',
      ready: false,
      error:
        'Local storage is unavailable. Check browser storage permissions, then retry. Your existing data has not been reset.',
    });
  }
}
let writeQueue: Promise<unknown> = Promise.resolve();
let pending = 0;

/** Drain accepted writes before changing databases; never display a previous identity's data. */
export function switchLocalWorkspace(workspaceId: string | null): Promise<void> {
  const name = workspaceDatabaseName(workspaceId);
  const current = useWorkspaceStore.getState();
  if (
    !current.switching &&
    current.workspaceId === workspaceId &&
    usePersistenceStore.getState().ready
  )
    return Promise.resolve();
  const requestedGeneration = ++generation;
  useWorkspaceStore.setState({ switching: true, revision: requestedGeneration });
  usePersistenceStore.setState({ status: 'loading', ready: false, error: '' });
  useUserStore.setState(structuredClone(EMPTY_USER_DATA));
  useUiStore.setState({
    dialog: null,
    editorOpen: false,
    filters: DEFAULT_FILTERS,
    navTab: 'map',
    askOpen: false,
  });
  useMapStore.setState({ selectedId: null, focus: null, boundsFocus: null, isolation: null, editorMode: 'none', draftPosition: null, markerKindPreset: null, highlightIds: [] });
  const operation = writeQueue.then(async () => {
    const previous = atlasRepository;
    const repository = previous.name === name ? previous : new AtlasDatabase(name);
    replaceAtlasRepository(repository);
    if (previous !== repository) previous.close();
    useWorkspaceStore.setState({ workspaceId });
    try {
      const data = await repository.load();
      if (requestedGeneration !== generation) return;
      useUserStore.setState(data);
      useWorkspaceStore.setState({ switching: false });
      usePersistenceStore.setState({ status: 'saved', ready: true, error: '' });
    } catch (error) {
      if (requestedGeneration === generation) {
        useWorkspaceStore.setState({ switching: false });
        usePersistenceStore.setState({
          status: 'error',
          ready: false,
          error: 'Could not open this workspace. Check browser storage permissions and retry.',
        });
      }
      throw error;
    }
  });
  // A failed switch must not poison subsequent transitions or local writes.
  writeQueue = operation.catch(() => undefined);
  return operation;
}

export async function deleteLocalWorkspace(workspaceId: string): Promise<void> {
  const name = workspaceDatabaseName(workspaceId);
  const operation = writeQueue.then(async () => {
    if (name === atlasRepository.name) throw new Error('Cannot delete an active workspace.');
    await new AtlasDatabase(name).delete();
  });
  writeQueue = operation.catch(() => undefined);
  await operation;
}

function assertWorkspace(workspaceId: string | null, expectedGeneration: number): void {
  const state = useWorkspaceStore.getState();
  if (
    state.switching ||
    state.workspaceId !== workspaceId ||
    generation !== expectedGeneration ||
    !usePersistenceStore.getState().ready
  )
    throw new Error(
      'The active workspace changed or is unavailable. Retry from the current account.',
    );
}

export async function exportWorkspaceBackup(workspaceId: string | null) {
  const expectedGeneration = generation;
  assertWorkspace(workspaceId, expectedGeneration);
  await writeQueue;
  assertWorkspace(workspaceId, expectedGeneration);
  const backup = await atlasRepository.exportBackup();
  assertWorkspace(workspaceId, expectedGeneration);
  return backup;
}

export async function importWorkspaceBackup(
  workspaceId: string | null,
  value: unknown,
): Promise<void> {
  const expectedGeneration = generation;
  assertWorkspace(workspaceId, expectedGeneration);
  const backup = parseBackup(value);
  const saved = await saveLocal(async () => {
    assertWorkspace(workspaceId, expectedGeneration);
    await atlasRepository.importBackup(backup);
  });
  assertWorkspace(workspaceId, expectedGeneration);
  if (!saved)
    throw new Error(usePersistenceStore.getState().error || 'Could not import the backup.');
}

/** Serialize local writes; publish success only after the transaction and reload complete. */
export function saveLocal(action: () => Promise<void>): Promise<boolean> {
  if (useWorkspaceStore.getState().switching || !usePersistenceStore.getState().ready)
    return Promise.resolve(false);
  const requestedGeneration = generation;
  const repository = atlasRepository;
  publication++;
  pending++;
  usePersistenceStore.setState({ status: 'saving', error: '' });
  const operation = writeQueue.then(async () => {
    try {
      await action();
      const data = await repository.load();
      pending--;
      if (requestedGeneration !== generation) return false;
      useUserStore.setState(data);
      usePersistenceStore.setState({
        status: pending ? 'saving' : 'saved',
        error: '',
        ready: true,
      });
      atlasRegistry.emit('saved', undefined);
      return true;
    } catch (error) {
      pending--;
      if (useWorkspaceStore.getState().switching) return false;
      usePersistenceStore.setState({
        status: 'error',
        error:
          error instanceof ConflictError
            ? 'A newer version exists in another tab or import. Preserve your draft and reload the saved version before editing again.'
            : 'Could not save to this device. Free storage or check permissions, then retry. Existing data is preserved.',
      });
      return false;
    }
  });
  writeQueue = operation;
  return operation;
}
