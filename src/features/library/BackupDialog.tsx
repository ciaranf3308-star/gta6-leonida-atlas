import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import type { Backup } from '../../domain/types';
import { atlasRepository } from '../../db/repository';
import { MAX_BACKUP_BYTES, parseBackup } from '../../db/backup';
import {
  saveLocal,
  usePersistenceStore,
  useWorkspaceStore,
} from '../../stores/atlas';
import { useAiIndexStore } from '../categorise/store';
import { downloadAtlasBackup } from '../backup/atlas-backup';
import { Modal } from '../../app/Modal';

/** "1 AI-sorted place", "3 AI-sorted places" — the counts in this dialog are user-facing. */
function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? singular : plural}`;
}

export default function BackupDialog({ onClose }: { onClose: () => void }) {
  const ready = usePersistenceStore((s) => s.ready);
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const [preview, setPreview] = useState<Backup | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function exportData() {
    setError('');
    setMessage('');
    try {
      const result = await downloadAtlasBackup(workspaceId);
      setMessage(
        `Backup downloaded — ${count(result.aiCategories, 'AI-sorted place')}, ` +
          `${count(result.markers, 'marker')}, ${count(result.notes, 'note')}, ` +
          `${count(result.favorites, 'saved place')}. Store it somewhere safe — ` +
          `your OpenAI key is never in the file.`,
      );
    } catch {
      setError('Could not read local data for export. Retry after checking storage.');
    }
  }
  async function inspect(file: File | undefined) {
    setPreview(null);
    setError('');
    setMessage('');
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setError('This file exceeds the 10 MB backup limit.');
      return;
    }
    try {
      setPreview(parseBackup(JSON.parse(await file.text())));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Invalid backup file. No data was changed.',
      );
    }
  }
  async function merge() {
    if (!preview) return;
    setBusy(true);
    const ok = await saveLocal(() => atlasRepository.importBackup(preview));
    if (ok) {
      // The markers/notes half is in; now merge the AI index the same
      // way — corrections win, confirmed beats suggested, "not sure"
      // never overwrites a type. Safe while the job runs: the merge
      // keeps the live job's status, so a restore never pauses or
      // stops a run in progress.
      const ai = useAiIndexStore
        .getState()
        .mergeImportedAi(preview.aiCategories, preview.aiIndexJob);
      setBusy(false);
      setPreview(null);
      setMessage(
        `Backup merged. AI index: ${ai.added.toLocaleString()} new, ` +
          `${ai.updated.toLocaleString()} updated, ` +
          `${ai.keptLocal.toLocaleString()} kept as yours. ` +
          `${count(preview.markers.length, 'marker')}, ` +
          `${count(preview.notes.length, 'note')}, ` +
          `${count(preview.favorites.length, 'saved place')}. ` +
          `Your local data is saved.`,
      );
    } else {
      setBusy(false);
      setError('Import failed. Existing data is preserved. Retry after checking storage.');
    }
  }
  return (
    <Modal title="Your local backup" onClose={onClose}>
      <p className="panel-intro">
        Export everything yours — favorites, collections, notes, markers and the AI index (the
        sorted &ldquo;?&rdquo; places and how far the job got). No account is needed, and your
        OpenAI key is never in the file. The job saves after every batch on this phone — back
        up to keep it forever, past a wipe, a browser-data clear, a PWA uninstall or a new phone.
      </p>
      <button className="button primary" disabled={!ready} onClick={() => void exportData()}>
        <Download size={18} />
        Export backup
      </button>
      <section className="detail-section">
        <label className="file-label" htmlFor="backup-file">
          <Upload size={18} />
          Import a backup
        </label>
        <input
          id="backup-file"
          type="file"
          accept=".json,application/json"
          disabled={!ready || busy}
          onChange={(e) => void inspect(e.target.files?.[0])}
        />
        <p className="help-text">
          Versioned JSON · up to 10 MB. Review the contents before merging. Existing entries are
          kept; newer matching entries are updated.
        </p>
      </section>
      {preview && (
        <section className="backup-preview" aria-label="Backup preview">
          <h3>Ready to merge</h3>
          <p>
            {count(preview.aiCategories.length, 'AI-sorted place')} ·{' '}
            {count(preview.aiIndexJob.attemptedPlaceIds.length, 'place')} the job has
            been through · {count(preview.favorites.length, 'favorite')} ·{' '}
            {count(preview.collections.length, 'collection')} ·{' '}
            {count(preview.notes.length, 'note')} · {count(preview.markers.length, 'marker')}
          </p>
          <p className="help-text">
            Imported display preferences will replace current preferences. Your corrections
            always win: a place you corrected or confirmed keeps your word, and a &ldquo;not
            sure&rdquo; in the file never overwrites a type.
          </p>
          <button className="button primary" disabled={busy} onClick={() => void merge()}>
            {busy ? 'Importing…' : 'Merge backup'}
          </button>
          <button className="text-button" onClick={() => setPreview(null)}>
            Cancel import
          </button>
        </section>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
    </Modal>
  );
}
