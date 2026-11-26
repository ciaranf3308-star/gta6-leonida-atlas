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
import { parseBackupFileWithDrops, parseBackupV4 } from '../db/backup';
import { exportAiIndex } from '../db/ai-index';
import { importAtlasBackup } from '../db/backup-import';
import { useAiIndexStore } from '../features/categorise/store';
import { useCompletionLogStore } from '../features/completion/log-store';

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
  markerKindPreset: 'workout' | 'breakable' | 'vehicle-loot' | null;
  /** Ask Nylah highlights — ids the last answer pointed at. Never a layer. */
  highlightIds: string[];
  /** The map centre, from the map's own viewport reports — the Find list
   * sorts nearest-first from here. Null until the map reports. */
  mapCenter: Position | null;
  setLayers: (layers: LayerDefinition[]) => void;
  select: (place: Place | null) => void;
  /** Move the camera to a position WITHOUT selecting anything — the
   * sheet-close recenter (v0.30.0): the focus had centred the place
   * above the sheet, so after the sheet closes it sits under the top
   * chrome and the pin clamp hides it. setFocus re-flies it to the
   * centre of the visible band while the reveal (or its layer) keeps
   * the pin on screen. Bumps the focus requestId like select() does,
   * so MapView's focus effect runs again. */
  setFocus: (position: Position | null) => void;
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
  setFocus: (position) => {
    set((state) => ({
      focus: position
        ? { position, requestId: (state.focus?.requestId ?? 0) + 1 }
        : null,
    }));
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
 * Bottom navigation — the one way around the app. Four labelled tabs
 * for the four real jobs (v0.32 step 5): Map, Collections, Progress,
 * Ask. Find is a search overlay on the Map tab (the map search pill
 * and `/`), and the map filter is a contextual sheet over the map —
 * neither is a nav tab. One sheet at a time: opening a tab, Find, or
 * the filter sheet closes any place detail on a phone, and picking a
 * place closes the tab panel and Ask.
 */
export type NavTab = 'map' | 'collections' | 'progress' | 'ask';
export const useUiStore = create<{
  filters: Filters;
  navTab: NavTab;
  /** Ask Nylah sheet open — controlled here so the bottom nav, the panel
   * and place selection can never stack two sheets. */
  askOpen: boolean;
  /** Find search overlay open (Map tab). Separate from navTab: Find is
   * a search over the map, not a section of the app. */
  findOpen: boolean;
  /** Contextual map-filter sheet open (Map tab) — layer toggles and
   * narrowing filters only, no stats, no paragraphs. */
  filterSheetOpen: boolean;
  dialog: 'settings' | 'backup' | null;
  editorOpen: boolean;
  setFilters: (filters: Partial<Filters>) => void;
  resetFilters: () => void;
  setNavTab: (tab: NavTab) => void;
  setAskOpen: (open: boolean) => void;
  setFindOpen: (open: boolean) => void;
  setFilterSheetOpen: (open: boolean) => void;
  setDialog: (dialog: 'settings' | 'backup' | null) => void;
  setEditorOpen: (open: boolean) => void;
}>((set) => ({
  filters: DEFAULT_FILTERS,
  navTab: 'map',
  askOpen: false,
  findOpen: false,
  filterSheetOpen: false,
  dialog: null,
  editorOpen: false,
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
  setNavTab: (navTab) => set({ navTab }),
  setAskOpen: (askOpen) => set({ askOpen }),
  setFindOpen: (findOpen) => set({ findOpen }),
  setFilterSheetOpen: (filterSheetOpen) => set({ filterSheetOpen }),
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
    findOpen: false,
    filterSheetOpen: false,
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
  // The AI index lives in its own IndexedDB database, not in the
  // user-data database — attach a read-only snapshot here. No
  // writes: safe while the indexing job is running, and the file is
  // validated before it is handed to the download, so a half-written
  // batch can never produce a corrupt backup.
  const ai = await exportAiIndex();
  // v0.32 step 3 (backup v4): the completion log, reconciliation,
  // enrichments, corrections and sold state ride along with the v3
  // sections. The repository's export stays v3 (repository.ts is
  // step 2's file); the store assembles v4 from it. Screenshots are
  // NOT in the file — the images stay on this device (addendum line
  // 518) — and neither are research requests (addendum line 725: v4
  // gains exactly enrichments, corrections, personalItemState).
  // Step 7 adds the card matcher sections (cardMatches,
  // matcherAttempts, matcherRejections) for the same reason the
  // completion log rides along: a confirmed match is shipped data.
  const { records, reconciliation } = await atlasRepository.loadCompletion();
  const personalItemState = await atlasRepository.loadPersonalItemStates();
  const [enrichments, corrections] = await Promise.all([
    atlasRepository.enrichments.toArray(),
    atlasRepository.corrections.toArray(),
  ]);
  const [cardMatches, matcherAttempts, matcherRejections] = await Promise.all([
    atlasRepository.loadCardMatches(),
    atlasRepository.loadMatcherAttempts(),
    atlasRepository.loadMatcherRejections(),
  ]);
  assertWorkspace(workspaceId, expectedGeneration);
  return parseBackupV4({
    ...backup,
    version: 4,
    aiCategories: ai.aiCategories,
    aiIndexJob: ai.aiIndexJob,
    completionRecords: records,
    reconciliation,
    enrichments,
    corrections,
    personalItemState,
    cardMatches,
    matcherAttempts,
    matcherRejections,
  });
}

export async function importWorkspaceBackup(
  workspaceId: string | null,
  value: unknown,
): Promise<void> {
  const expectedGeneration = generation;
  assertWorkspace(workspaceId, expectedGeneration);
  // v4 files parse as v4 (completion log, reconciliation, the three
  // addendum tables); v1–v3 files parse as before and migrate on
  // import (importAtlasBackup triggers the completion migration after
  // visited/explored land). The WithDrops parse also reports the
  // completion records the file carried that could not be trusted
  // (DESIGN §11 drop-and-count) — they travel with the import so the
  // migration log and the import result can carry the count.
  const { backup, droppedCompletionRecords } = parseBackupFileWithDrops(value);
  // The import is one honest operation across both stores: the AI
  // half merges first, then the user-data half imports, and if the
  // user-data half fails the AI half is rolled back to its
  // pre-import snapshot (see db/backup-import.ts). Only after both
  // halves are persisted — and the stores reloaded from the
  // databases — may the caller say the import succeeded.
  // (A holder object, not a let: TypeScript cannot see a closure
  // assignment across an await, so a plain variable reads as null
  // after saveLocal returns.)
  const importResult: { failure?: string } = {};
  const saved = await saveLocal(async () => {
    assertWorkspace(workspaceId, expectedGeneration);
    try {
      await importAtlasBackup(backup, { droppedCompletionRecords });
    } catch (error) {
      importResult.failure =
        error instanceof Error ? error.message : 'Could not import the backup.';
      throw error;
    }
  });
  assertWorkspace(workspaceId, expectedGeneration);
  if (!saved)
    throw new Error(
      importResult.failure &&
        importResult.failure.includes('could not be rolled back')
        ? importResult.failure
        : usePersistenceStore.getState().error ||
          importResult.failure ||
          'Could not import the backup.',
    );
  // Step 6: the import wrote the completion log (and ran the v3
  // migration for v1–v3 files) — the log store re-reads it, so the
  // map, journal and Progress move to the restored state in the same
  // operation. The user store above already reloaded the old tables.
  await useCompletionLogStore.getState().refresh();
  await useAiIndexStore.getState().reloadFromDatabase();
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
