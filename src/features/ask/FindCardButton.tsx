/**
 * Find this card (v0.32 step 7) — the shared web-search button for
 * one unpositioned card, used by Journal rows and by Ask answer
 * cards alike.
 *
 * One tap, on the player's key (BYOK — the key is re-read from
 * localStorage on every tap, never bundled, logged or stored by this
 * component). The button calls the web-search model (OpenAI Responses
 * API + web_search); the result is a PROPOSAL with its sources and
 * confidence, never a placed pin:
 *
 * - The model's direction is run through the matcher against the
 *   live database. When it resolves to exactly one host, the lead is
 *   saved as a matcher attempt (proposedBy 'llm', confidence capped
 *   by the web result) and appears in the Collections review list —
 *   the player confirms it there, one tap, or it stays unplaced.
 * - When the direction names no building we know, the lead is queued
 *   as a ResearchRequest with the direction attached, and the row
 *   says so honestly.
 * - When the search finds nothing usable, findCard queues the
 *   ResearchRequest itself and the button reports it.
 * - Without a key the button says so and does nothing (Ask works as
 *   a finder only).
 *
 * The cost copy is shown with the button, before the tap — a web
 * search costs extra, on the player's key, and the button must not
 * hide that.
 */
import { useState } from 'react';
import {
  atlasRepository,
  type AtlasDatabase,
} from '../../db/repository';
import type { ResearchRequest } from '../../domain/album';
import type { CollectibleItem, GameDatabase } from '../../domain/game-db';
import {
  attemptFingerprint,
  attemptId,
  resolveSlotDeterministically,
} from './card-matcher';
import { FIND_CARD_COST_COPY, findCard, type CardProposal } from './find-card';
import { useMatchStore } from './match-store';
import { getAskApiKey } from './openai';

type ButtonState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'no_key' }
  | { kind: 'error'; message: string }
  | { kind: 'queued'; message: string }
  | {
      kind: 'proposed';
      proposal: CardProposal;
      hostName: string | null;
      inReview: boolean;
      saveFailed: boolean;
    };

export function FindCardButton({
  item,
  db,
  repository,
}: {
  item: CollectibleItem;
  db: GameDatabase;
  repository?: AtlasDatabase;
}) {
  const [state, setState] = useState<ButtonState>({ kind: 'idle' });
  const repo = repository ?? atlasRepository;

  async function queueResearch(request: ResearchRequest): Promise<boolean> {
    try {
      await repo.researchRequests.put(request);
      return true;
    } catch {
      return false;
    }
  }

  async function search() {
    if (state.kind === 'searching') return;
    setState({ kind: 'searching' });
    const apiKey = getAskApiKey();
    if (!apiKey.trim()) {
      setState({ kind: 'no_key' });
      return;
    }
    const result = await findCard({
      item,
      db,
      apiKey,
      queueResearch,
    });
    if (result.kind === 'no_key') {
      setState({ kind: 'no_key' });
      return;
    }
    if (result.kind === 'error') {
      setState({ kind: 'error', message: result.message });
      return;
    }
    if (result.kind === 'queued') {
      setState({ kind: 'queued', message: result.message });
      return;
    }
    // A proposal: run the model's direction through the matcher.
    const proposal = result.proposal;
    const pickup = item.pickups[0];
    const tempItem: CollectibleItem = {
      ...item,
      pickups: [
        {
          areaLead: pickup?.areaLead ?? item.areaLead ?? '',
          areaId: item.areaId,
          direction: proposal.direction,
          sourceTitle: proposal.sources[0]?.title ?? 'web search',
          sourceUrl: proposal.sources[0]?.url ?? '',
          evidence: 'approximate',
          hostId: null,
          hostName: null,
        },
      ],
    };
    const resolved = resolveSlotDeterministically(db, tempItem);
    if (!resolved.proposal) {
      // A lead, but no building we know — queue it for research with
      // the direction attached, so the developer-side job can place it.
      const question = `Where is the ${item.name} card? Web search found: ${proposal.direction}`;
      const request: ResearchRequest = {
        id: `rr:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
        targetType: 'item',
        targetId: item.id,
        question: question.slice(0, 200),
        sourceUrl: proposal.sources[0]?.url,
        requestedAt: new Date().toISOString(),
        status: 'queued',
      };
      const saved = await queueResearch(request);
      setState({
        kind: 'queued',
        message: saved
          ? `Found a lead — “${proposal.direction}” — but it names no building we know, so it is queued for research with that direction attached.`
          : `Found a lead — “${proposal.direction}” — but it names no building we know, and the research queue could not save it. Nothing was placed.`,
      });
      return;
    }
    const host = db.locations.get(resolved.proposal.hostId);
    const attempt = {
      id: attemptId(item.id, attemptFingerprint(item.id, [resolved.proposal.hostId])),
      slotId: item.id,
      fingerprint: attemptFingerprint(item.id, [resolved.proposal.hostId]),
      at: new Date().toISOString(),
      result: 'proposed' as const,
      proposedHostId: resolved.proposal.hostId,
      confidence: Math.min(resolved.proposal.confidence, proposal.confidence),
      reasoning: `Web search (${proposal.sources.map((source) => source.title).join(', ')}) says: “${proposal.direction}”. ${resolved.proposal.reasoning}`,
      proposedBy: 'llm' as const,
    };
    const saved = await useMatchStore.getState().saveAttempt(attempt, { repository: repo });
    setState({
      kind: 'proposed',
      proposal,
      hostName: host?.name ?? resolved.proposal.hostName,
      inReview: saved.ok,
      saveFailed: !saved.ok,
    });
  }

  return (
    <span className="find-card">
      <button
        type="button"
        className="text-button find-card-button"
        disabled={state.kind === 'searching'}
        onClick={() => void search()}
        title={FIND_CARD_COST_COPY}
      >
        {state.kind === 'searching' ? 'Searching the web…' : 'Find this card'}
      </button>
      {state.kind === 'idle' && (
        <small className="find-card-cost">{FIND_CARD_COST_COPY}</small>
      )}
      {state.kind === 'no_key' && (
        <small className="find-card-note" role="status">
          Web search needs your OpenAI key — add it in Settings. Without a key, Ask works as a
          finder only. {FIND_CARD_COST_COPY}
        </small>
      )}
      {state.kind === 'error' && (
        <small className="find-card-note" role="alert">
          The web search failed: {state.message} Nothing was placed.
        </small>
      )}
      {state.kind === 'queued' && (
        <small className="find-card-note" role="status">
          {state.message}
        </small>
      )}
      {state.kind === 'proposed' && (
        <span className="find-card-proposal" role="status">
          <span>
            Found a lead ({Math.round(state.proposal.confidence * 100)}% sure): “
            {state.proposal.direction}”
          </span>
          <span>
            Sources:{' '}
            {state.proposal.sources.map((source, index) => (
              <span key={source.url}>
                {index > 0 ? ', ' : ''}
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
              </span>
            ))}
          </span>
          {state.hostName && (
            <span>
              Matched to {state.hostName} —{' '}
              {state.inReview
                ? 'in the matcher review list in Collections. Confirm it there, or it stays unplaced.'
                : 'but the lead could not be saved for review. Nothing was placed.'}
            </span>
          )}
          {state.saveFailed && <span>Nothing was placed.</span>}
        </span>
      )}
    </span>
  );
}
