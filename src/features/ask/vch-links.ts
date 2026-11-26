/**
 * Vice City Hispano review links — LINK ONLY, never pins (v0.32 step 7).
 *
 * The 118 candidate pins in `src/data/vch-review/` (verbatim copies of
 * `hidden_files/v032-cards4/*.json`, review date 2026-11-26) are
 * licence-blocked: the provenance is MURKY (fbrito's sync ingests a
 * private repo; PR #21's own word is "scraper"; `source_urls` empty
 * for all 4,687 entries; GTABase taxonomy in the pipeline with no open
 * licence). The review verdict is NOT BUNDLED — no coordinate from
 * this set becomes a shipped pin, and even the 3 correctness-confirmed
 * rows are link-only until the upstream provenance is confirmed.
 *
 * What this module DOES expose, per checklist slot:
 * - confirmed (3): a link to the fbrito pin page, labelled as an
 *   external community report — never presented as our verified pin.
 *   The confirmed host (L513 / L535 / L360) is recorded as a lead
 *   only; the slot itself stays area-known in the shipped data.
 * - proposed (105): the proposedPosition as a LEAD (never a pin) +
 *   the link + the confidence tier. Taylor Blanc's winner is a
 *   different pin than the file pick — host L1589 Gas Station,
 *   Southside, proposed-unrated — and the row says so.
 * - rejected (10): the rejection reason, no link to the pin (a
 *   rejected position must not be offered as help).
 *
 * The `f` webp files in the review data are in-game location
 * screenshots (Rockstar-owned, explicitly excluded from fbrito's
 * CC BY 4.0 grant) — NOT card face art. They are never loaded, never
 * linked, never shown. Album art stays empty (addendum open
 * decision A9).
 *
 * The join: the three row files carry `vchReview.sourcePinId`; the
 * audit trail (`final-decisions.json`) carries `slotId` + `sourceId`
 * for the same pin id. A row whose pin id has no audit-trail entry
 * is dropped at load time (never silently guessed into a slot).
 */
import verifiedCards from '../../data/vch-review/verified-cards.json';
import proposedCards from '../../data/vch-review/proposed-cards.json';
import rejectedCards from '../../data/vch-review/rejected-cards.json';
import finalDecisions from '../../data/vch-review/final-decisions.json';

export type VchLeadStatus = 'confirmed' | 'proposed' | 'proposed-unrated' | 'rejected';

/** One reviewed slot. Positions here are LEADS, never pins. */
export interface VchLead {
  /** Checklist slot id (`card-checklist:<set>:<person>:<variant>`). */
  slotId: string;
  setId: string;
  person: string;
  variant: string;
  status: VchLeadStatus;
  /** cross-checked | community report | unrated (the review's tier). */
  tier: string;
  /** fbrito pin id, e.g. `collectible-card-029`. */
  sourcePinId: string;
  /** The external pin page — the ONLY thing the app ever shows for
   *  a confirmed/proposed row: "optional help", an external
   *  community report, never our verified pin. */
  sourcePinUrl: string;
  /** Proposed position from the review — a LEAD, never a pin. Null
   *  for confirmed rows (the host is the lead there) and rejected rows. */
  proposedPosition: { x: number; y: number } | null;
  /** Host the review evidenced, as a LEAD only. For the 3 confirmed
   *  rows this is the confirmed host (L513 / L535 / L360) — still
   *  link-only. For Taylor Blanc it is L1589. Null otherwise. */
  proposedHostId: string | null;
  /** Plain-words reason from the review (why proposed / why rejected). */
  reviewReason: string;
  /** The licence line, carried verbatim on every row. */
  licenceStatus: string;
}

export const VCH_LICENCE_NOTE =
  'NOT CLEARED — correctness-confirmed only; do not bundle until upstream provenance is confirmed';

interface VchReviewBlock {
  sourcePinId: string;
  sourcePinUrl: string;
  confidenceTier: string;
  reviewReason: string;
  licenceStatus: string;
}

interface VchRow {
  setId: string;
  person: string;
  variant: string;
  host?: { gtadbId: string } | null;
  proposedPosition?: { x: number; y: number } | null;
  proposedHost?: { gtadbId: string } | null;
  vchReview: VchReviewBlock;
}

function tierLabel(tier: string): string {
  if (tier === 'cross-checked') return 'cross-checked';
  if (tier === 'community') return 'community report';
  return 'unrated';
}

function buildLeads(): ReadonlyMap<string, VchLead> {
  const slotByPinId = new Map<string, { slotId: string }>();
  for (const row of finalDecisions as Array<{
    slotId: string;
    sourceId: string;
    duplicatePins?: Array<{ id: string }>;
  }>) {
    slotByPinId.set(row.sourceId, { slotId: row.slotId });
    // Arbitration winners are DIFFERENT pins than the file pick
    // (Taylor Blanc's winner is ...-008, the file pick ...-006) —
    // the winner id lives in the row's duplicatePins, not sourceId.
    for (const pin of row.duplicatePins ?? []) {
      slotByPinId.set(pin.id, { slotId: row.slotId });
    }
  }
  const leads = new Map<string, VchLead>();
  const add = (
    row: VchRow,
    status: VchLeadStatus,
    proposedPosition: { x: number; y: number } | null,
    proposedHostId: string | null,
  ) => {
    const slot = slotByPinId.get(row.vchReview.sourcePinId);
    // No audit-trail entry for this pin id: the slot is unknown, so
    // the row is dropped rather than guessed into a slot.
    if (!slot) return;
    leads.set(slot.slotId, {
      slotId: slot.slotId,
      setId: row.setId,
      person: row.person,
      variant: row.variant,
      status,
      tier: tierLabel(row.vchReview.confidenceTier),
      sourcePinId: row.vchReview.sourcePinId,
      sourcePinUrl: row.vchReview.sourcePinUrl,
      proposedPosition,
      proposedHostId,
      reviewReason: row.vchReview.reviewReason,
      licenceStatus: row.vchReview.licenceStatus,
    });
  };
  for (const row of verifiedCards as unknown as VchRow[]) {
    // Confirmed correctness + host — STILL link-only (licence).
    // The host is the lead; there is no proposedPosition to record.
    add(row, 'confirmed', null, row.host?.gtadbId ?? null);
  }
  for (const row of proposedCards as unknown as VchRow[]) {
    const unrated = row.vchReview.confidenceTier === 'unrated';
    add(
      row,
      unrated ? 'proposed-unrated' : 'proposed',
      row.proposedPosition ?? null,
      row.proposedHost?.gtadbId ?? null,
    );
  }
  for (const row of rejectedCards as unknown as VchRow[]) {
    add(row, 'rejected', null, null);
  }
  return leads;
}

const LEADS = buildLeads();

export const VCH_LEAD_COUNTS = {
  total: LEADS.size,
  confirmed: [...LEADS.values()].filter((lead) => lead.status === 'confirmed').length,
  proposed: [...LEADS.values()].filter((lead) => lead.status === 'proposed').length,
  proposedUnrated: [...LEADS.values()].filter((lead) => lead.status === 'proposed-unrated')
    .length,
  rejected: [...LEADS.values()].filter((lead) => lead.status === 'rejected').length,
};

/** The review lead for one checklist slot, or null when the slot was
 *  not among the 118 reviewed. Never a pin, never a position to plot. */
export function vchLeadForSlot(slotId: string): VchLead | null {
  return LEADS.get(slotId) ?? null;
}

/** Short label for the Collections row: what the link IS and ISN'T. */
export function vchLeadLabel(lead: VchLead): string {
  if (lead.status === 'confirmed') {
    return `Community report (${lead.tier}) — see the pin page. Correctness-confirmed, licence-blocked: link only, not our pin.`;
  }
  if (lead.status === 'rejected') {
    return `Community pin rejected — ${lead.reviewReason}`;
  }
  return `Community report (${lead.tier}) — proposed position kept as a lead, not a pin. See the pin page.`;
}
