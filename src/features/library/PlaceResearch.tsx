/**
 * On-demand building research on the place card (DESIGN-ADDENDUM §2.2).
 *
 * One explicit action — "Research this building" — never automatic on
 * open. The cached row renders with its research date ("Last checked
 * …"), the paid-call counter for this building, tier-1 fields, tier-2
 * (loot) behind a second explicit tap, and a visible Conflicts row
 * when an AI field contradicts a verified record. A field the AI
 * wasn't sure about (< 0.6) is shown as exactly that, with no claim
 * text. Nothing here ever presents an AI claim in the same voice as
 * a verified fact.
 */
import { useEffect, useState } from 'react';
import { atlasRepository } from '../../db/repository';
import type { Enrichment, EnrichmentField, EnrichmentFieldKind } from '../../domain/enrichment';
import type { Evidence, GameDatabase } from '../../domain/game-db';
import type { Place } from '../../domain/types';
import { getAskApiKey } from '../ask/openai';
import {
  enrichmentIdFor,
  freshnessLabel,
  researchBuilding,
  splitEnrichmentTiers,
} from '../enrichment/research';
import './place-research.css';

const FIELD_LABELS: Record<EnrichmentFieldKind, string> = {
  identity: 'What it is',
  purpose: 'What it is for',
  'shop-category': 'Shop',
  accessibility: 'Getting in',
  interior: 'Inside',
  loot: 'Loot',
  'vehicle-loot': 'Vehicles & safes',
  opportunities: 'Opportunities',
};

function FieldRow({ field }: { field: EnrichmentField }) {
  // Below the confidence floor the field is not an answer at all —
  // it renders as "AI wasn't sure", with no claim text (§2.4).
  if (field.confidence < 0.6) {
    return (
      <li className="place-research-field place-research-unsure">
        <span className="place-research-kind">{FIELD_LABELS[field.kind]}</span>
        <p>AI wasn&apos;t sure about this.</p>
        <small>Confidence {field.confidence.toFixed(2)} — below the 0.60 floor.</small>
      </li>
    );
  }
  const statusLabel =
    field.status === 'corroborated'
      ? `Corroborated · ${field.confidence.toFixed(2)}`
      : field.status === 'personal'
        ? `Confirmed by you in-game · ${field.confidence.toFixed(2)}`
        : `AI suggested · ${field.confidence.toFixed(2)}`;
  return (
    <li className="place-research-field">
      <span className="place-research-kind">{FIELD_LABELS[field.kind]}</span>
      <p>{field.text}</p>
      <small>
        {statusLabel}
        {' · '}
        {field.sources.map((source, index) => (
          <span key={`${source.url}-${index}`}>
            {index > 0 ? ', ' : ''}
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.title}
            </a>
          </span>
        ))}
        {field.corroboratedBy ? ` · second source: ${field.corroboratedBy}` : ''}
      </small>
    </li>
  );
}

export default function PlaceResearch({
  place,
  db,
}: {
  place: Place;
  /** The gameplay database — the location's verified evidence, so a
   *  conflict can name the record that won. Null while loading. */
  db?: GameDatabase | null;
}) {
  const [enrichment, setEnrichment] = useState<Enrichment | null>(null);
  const [locationChangedAt, setLocationChangedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showTier2, setShowTier2] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setEnrichment(null);
    setNotice(null);
    setShowTier2(false);
    void Promise.all([
      atlasRepository.enrichments.get(enrichmentIdFor(place.id)),
      atlasRepository.corrections.where('locationId').equals(place.id).toArray(),
    ])
      .then(([cached, corrections]) => {
        if (!alive) return;
        setEnrichment(cached ?? null);
        let latest: string | null = null;
        for (const correction of corrections) {
          if (!latest || correction.at > latest) latest = correction.at;
        }
        setLocationChangedAt(latest);
        setLoaded(true);
      })
      .catch(() => {
        if (!alive) return;
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [place.id]);

  // The verified/approximate records for this location — the ones a
  // conflicted AI field lost to. `ai-suggested` evidence never wins.
  const winningEvidence: Evidence[] = (db?.locations.get(place.id)?.evidence ?? []).filter(
    (entry) => entry.kind !== 'ai-suggested',
  );

  const runResearch = async (force: boolean) => {
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await researchBuilding({
        locationId: place.id,
        placeTitle: place.title,
        category: place.category,
        region: place.region ?? undefined,
        description: place.description || undefined,
        verifiedEvidence: winningEvidence,
        apiKey: getAskApiKey(),
        force,
      });
      if (outcome.status === 'cached' || outcome.status === 'researched') {
        setEnrichment(outcome.enrichment);
        if (outcome.status === 'cached') {
          setNotice('Already researched — this is the cached result. No new research call was made.');
        }
      } else if (outcome.status === 'no-key') {
        setEnrichment(outcome.enrichment);
        setNotice(
          outcome.queuedRequestId
            ? 'Research needs your OpenAI key — add it in Settings → Ask (it stays on this device). This building has been queued for research, so it can be answered with sources later.'
            : 'Research needs your OpenAI key — add it in Settings → Ask (it stays on this device). The request could not be queued on this device.',
        );
      } else {
        setEnrichment(outcome.enrichment);
        setNotice(outcome.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const { tier1, tier2 } = enrichment
    ? splitEnrichmentTiers(enrichment.fields)
    : { tier1: [], tier2: [] };
  // Conflicted fields never render as facts — they render only in
  // the Conflicts row, with both sides cited (§2.4).
  const conflicts = (enrichment?.fields ?? []).filter((field) => field.status === 'conflicted');
  const shownTier1 = tier1.filter((field) => field.status !== 'conflicted');
  const shownTier2 = tier2.filter((field) => field.status !== 'conflicted');
  const researchCalls = enrichment?.researchCalls ?? 0;
  const freshness = enrichment
    ? freshnessLabel(enrichment, new Date().toISOString(), locationChangedAt)
    : null;

  return (
    <section className="place-research" aria-label="Building research">
      <h3>Research this building</h3>
      <p className="place-research-intro">
        AI research — uses your key, results are suggestions, not facts.
      </p>
      {loaded && enrichment && freshness && (
        <p className="place-research-freshness">
          {freshness.label}
          <span className="place-research-calls">
            Research calls for this building: {researchCalls}
          </span>
        </p>
      )}
      {loaded && enrichment && enrichment.fields.length === 0 && (
        <p className="place-research-empty">
          Research found nothing it could cite for this building — nothing was invented.
        </p>
      )}
      {shownTier1.length > 0 && (
        <ul className="place-research-fields">
          {shownTier1.map((field) => (
            <FieldRow key={field.kind} field={field} />
          ))}
        </ul>
      )}
      {shownTier2.length > 0 && (
        <div className="place-research-tier2">
          <button
            type="button"
            className="text-button"
            onClick={() => setShowTier2((current) => !current)}
            aria-expanded={showTier2}
          >
            {showTier2 ? 'Hide gameplay details' : 'Show gameplay details'}
          </button>
          {showTier2 && (
            <ul className="place-research-fields">
              {shownTier2.map((field) => (
                <FieldRow key={field.kind} field={field} />
              ))}
            </ul>
          )}
        </div>
      )}
      {conflicts.length > 0 && (
        <div className="place-research-conflicts">
          <h4>Conflicts</h4>
          <ul>
            {conflicts.map((field) => {
              const winner = winningEvidence.find(
                (entry) => entry.sourceTitle === field.conflictWith,
              );
              return (
                <li key={field.kind}>
                  <p>
                    AI suggested &ldquo;{field.text}&rdquo; — but{' '}
                    {winner ? (
                      <a href={winner.sourceUrl} target="_blank" rel="noreferrer">
                        {winner.sourceTitle}
                      </a>
                    ) : (
                      field.conflictWith ?? 'a verified record'
                    )}{' '}
                    disagrees. The verified record wins; this suggestion is kept here only so you
                    can see the disagreement.
                  </p>
                  <small>
                    AI source:{' '}
                    {field.sources.map((source, index) => (
                      <span key={`${source.url}-${index}`}>
                        {index > 0 ? ', ' : ''}
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.title}
                        </a>
                      </span>
                    ))}
                  </small>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="place-research-actions">
        <button
          type="button"
          className="button"
          disabled={busy || !loaded}
          onClick={() => void runResearch(enrichment !== null)}
        >
          {busy ? 'Researching…' : enrichment ? 'Research again' : 'Research this building'}
        </button>
      </div>
      {notice && (
        <p className="place-research-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
