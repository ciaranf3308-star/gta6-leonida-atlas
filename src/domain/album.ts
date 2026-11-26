/**
 * The premium collection album (DESIGN-ADDENDUM §3) and the
 * card-matcher records (CARD-MATCHER-DESIGN §2.3) — types only.
 *
 * No write paths live here: `recordSale`, the screenshot-match
 * executor and the matcher confirmation flow land in step 2 / step 7.
 * The album itself is a VIEW over `GameDatabase` items +
 * `completedItemIds` + `PersonalItemState` — never a second database.
 */

/**
 * Artwork reference for one face of a card (addendum §3.1). Null until
 * a licensed source exists or the player supplies their own photo.
 * Line 2 of §3.3 is absolute: a card FACE is never an AI illustration
 * — `ai-illustration` may decorate a set cover or a card back, never
 * a front.
 */
export interface ArtworkRef {
  kind: 'official' | 'photo' | 'ai-illustration' | 'silhouette';
  /** Local blob id for 'photo'; asset path for the rest. */
  url: string;
  sourceTitle: string;
  sourceUrl: string;
  /** e.g. 'player photo — personal', 'pending — no licence'. */
  license: string;
}

/**
 * Sold state is personal state, not a completion record — selling a
 * card does not remove collection progress (addendum §3.1/§3.4), so it
 * must not touch the completion log. One row per item the player has
 * sold; undo is clearing `soldAt` (the row is kept, so the sale stays
 * in the audit trail).
 */
export interface PersonalItemState {
  itemId: string;
  /** ISO UTC; null = not sold. */
  soldAt: string | null;
  /** Optional, player-typed. */
  soldPrice?: number;
}

/**
 * A player-uploaded screenshot (addendum §3.5). Stored locally as a
 * blob + metadata. Device-local only — NEVER in a backup (addendum
 * §6 step 3: the backup JSON is capped at 10 MiB).
 */
export interface UserScreenshot {
  id: string;
  /** ISO UTC. */
  at: string;
  kind: 'card-front' | 'collection-screen';
  /** The set the screenshot was attached to, when known. */
  setId?: string | null;
  /** The checklist item this screenshot is the photo OF, once a
   * card-front match is confirmed (or the player attached it to a
   * card directly). Only then may the album show it as that card's
   * face — a collection-screen photo never carries an itemId, and an
   * unconfirmed screenshot never becomes card art. */
  itemId?: string | null;
  /** Local blob id. The blob itself is never sent anywhere except the
   *  single match call under the player's key. */
  blobId: string;
}

/**
 * A research-when-missing request (addendum §5.3). Fulfilment is
 * developer-side, not on the player's phone: the answer lands as an
 * `Enrichment` (or a catalogue record with `approximate` evidence)
 * in a later data update, and the request flips to 'answered'. A
 * request that cannot be answered is marked 'unanswerable' with the
 * reason — never left queued forever, never answered with a guess.
 * Research requests are NOT in the backup (addendum §6 step 3).
 */
export interface ResearchRequest {
  id: string;
  targetType: 'item' | 'opportunity' | 'location';
  targetId: string;
  /** ≤ 200 chars — what is missing. */
  question: string;
  /** A guide URL the PLAYER supplied; the developer-side job checks
   *  that guide first. Never fetched from the player's device. */
  sourceUrl?: string;
  /** ISO UTC. */
  requestedAt: string;
  status: 'queued' | 'answered' | 'unanswerable';
  /** Why 'unanswerable', or what answered it — never a guess. */
  resolutionNote?: string;
}

/**
 * What a confirmed card match becomes (CARD-MATCHER-DESIGN §2.3).
 * The write path lands in step 2; this is the record shape now, so
 * the matcher, the backup and the generator all agree on it.
 *
 * No proposal is ever auto-accepted (§2.1): the pin appears only
 * after the player confirms, in Collections. The pin carries evidence
 * 'approximate' — the guide is approximate, and the confirmation
 * confirms the HOST, not the exact shelf. It is never 'verified'.
 * Evidence kind is recorded here as the literal the pin will carry.
 */
export interface PersonalMatch {
  /** The checklist slot that was matched. */
  slotId: string;
  /** The confirmed host location id. */
  hostId: string;
  /** 0–1. Below 0.6 a proposal is "not sure" and is never attempted. */
  confidence: number;
  /** One-line reasoning ("Only RON in the named area; typed by the AI
   *  index on 26 Nov"). */
  reasoning: string;
  /** The direction source URL + the catalogue record id and snapshot
   *  revision the host was matched against. */
  citations: {
    sourceTitle: string;
    sourceUrl: string;
    catalogueRecordId: string;
    snapshotRev: string;
  }[];
  proposedBy: 'deterministic' | 'llm' | 'developer' | 'player';
  confirmedBy: 'player';
  /** ISO UTC. */
  confirmedAt: string;
  /** The evidence kind the confirmed pin carries. 'approximate' for a
   *  matcher confirmation — the guide is approximate and the player
   *  confirmed the HOST, not the exact shelf. 'personal' for a jot:
   *  the player marked the spot himself in-game (CARD-MATCHER-DESIGN
   *  §3), the strongest non-verified evidence. Never 'verified'. */
  evidenceKind: 'approximate' | 'personal';
}
