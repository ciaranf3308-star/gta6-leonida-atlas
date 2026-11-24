import { useState, type CSSProperties } from 'react';
import { Bookmark, Check, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { atlasRepository } from '../../db/repository';
import {
  saveLocal,
  useMapStore,
  usePersistenceStore,
  useUiStore,
  useUserStore,
} from '../../stores/atlas';
import type { Collection } from '../../domain/types';

export function SavedPlaces({
  progress,
}: {
  progress: { layerId: string; name: string; total: number; found: number }[];
}) {
  const collections = useUserStore((s) => s.collections);
  const favorites = useUserStore((s) => s.favorites);
  const markers = useUserStore((s) => s.markers);
  const visited = useUserStore((s) => s.visited);
  const ready = usePersistenceStore((s) => s.ready);
  const filters = useUiStore((s) => s.filters);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Collection | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  function show(kind: 'favorites' | 'personal' | 'all', id: string | null = null) {
    useUiStore.getState().resetFilters();
    useUiStore.getState().setFilters({
      favoritesOnly: kind === 'favorites',
      personalOnly: kind === 'personal',
      collectionId: id,
    });
    useUiStore.getState().setNavTab('explore');
  }
  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const collection = editing
      ? { ...editing, name: trimmed, updatedAt: now }
      : {
          id: `collection:${crypto.randomUUID()}`,
          name: trimmed,
          placeIds: [],
          createdAt: now,
          updatedAt: now,
        };
    if (
      await saveLocal(() =>
        editing
          ? atlasRepository.renameCollection(editing.id, trimmed)
          : atlasRepository.saveCollection(collection),
      )
    ) {
      setName('');
      setEditing(null);
    }
  }
  return (
    <div className="library-view">
      <button className="library-row" onClick={() => show('favorites')}>
        <Star size={19} />
        <span>Favorites</span>
        <span>{favorites.length}</span>
      </button>
      <button className="library-row" onClick={() => show('personal')}>
        <Bookmark size={19} />
        <span>My markers</span>
        <span>{markers.length}</span>
      </button>
      <div className="section-label">
        Progress <span>{visited.length}</span>
      </div>
      <p className="empty-state">
        Mark places as found from their details. Progress is per layer — turn a layer on, then
        use “Only places I haven’t found” to chase the last ones.
      </p>
      {progress
        .filter((row) => row.total > 0)
        .map((row) => {
          const percent = row.total ? Math.round((row.found / row.total) * 100) : 0;
          return (
            <button
              className="library-row"
              key={row.layerId}
              onClick={() => {
                useMapStore.getState().setLayers(
                  useMapStore
                    .getState()
                    .layers.map((layer) =>
                      layer.id === row.layerId ? { ...layer, visible: true } : layer,
                    ),
                );
                useUiStore.getState().resetFilters();
                useUiStore
                  .getState()
                  .setFilters({ remainingOnly: true, collectionId: null });
                useUiStore.getState().setNavTab('explore');
              }}
            >
              <span className="progress-name">
                {row.name}
                <small>
                  {row.found} of {row.total} found · {percent}%
                </small>
              </span>
              <span className="progress-wrap" aria-hidden="true">
                <span
                  className="progress-bar"
                  style={{ '--progress': `${percent}%` } as CSSProperties}
                />
              </span>
            </button>
          );
        })}
      <div className="section-label">
        Collections <span>{collections.length}</span>
      </div>
      <form
        className="collection-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="sr-only" htmlFor="collection-name">
          Collection name
        </label>
        <input
          id="collection-name"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={editing ? 'Rename collection' : 'New collection'}
          disabled={!ready}
        />
        <button
          className="icon-button"
          aria-label={editing ? 'Save collection name' : 'Create collection'}
          disabled={!name.trim() || !ready}
        >
          {editing ? <Check size={18} /> : <Plus size={18} />}
        </button>
      </form>
      {editing && (
        <button
          className="text-button"
          onClick={() => {
            setEditing(null);
            setName('');
          }}
        >
          Cancel rename
        </button>
      )}
      {!collections.length && (
        <p className="empty-state">
          Keep your next route, discoveries or photo spots together. Create a collection, then add
          places from their details.
        </p>
      )}
      {collections.map((c) => (
        <div className="collection-row" key={c.id}>
          <button className="collection-open" onClick={() => show('all', c.id)}>
            <Bookmark size={17} />
            <span>
              {c.name}
              <small>
                {c.placeIds.length} places ·{' '}
                {c.placeIds.filter((id) => visited.some((v) => v.placeId === id)).length} found
              </small>
            </span>
          </button>
          <button
            className="icon-button"
            aria-label={`Rename ${c.name}`}
            onClick={() => {
              setEditing(c);
              setName(c.name);
            }}
          >
            <Pencil size={15} />
          </button>
          <button
            className="icon-button danger"
            aria-label={`Delete ${c.name}`}
            onClick={() => setDeleting(c.id)}
          >
            <Trash2 size={15} />
          </button>
          {deleting === c.id && (
            <div className="delete-confirm">
              <span>Delete this collection? Places and notes are kept.</span>
              <button
                className="text-button danger"
                onClick={async () => {
                  if (await saveLocal(() => atlasRepository.deleteCollection(c.id))) {
                    setDeleting(null);
                    if (filters.collectionId === c.id)
                      useUiStore.getState().setFilters({ collectionId: null });
                  }
                }}
              >
                Delete collection
              </button>
              <button className="text-button" onClick={() => setDeleting(null)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
