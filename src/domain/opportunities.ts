/**
 * Opportunities — one function per opportunity kind (DESIGN §3.2).
 *
 * Every function may fire for the same location: `opportunitiesForLocation`
 * returns a SET, never a single winner. This replaces the
 * `layerForGtadbLandmark` precedence chain in spirit — a Style shop
 * yields BOTH a `shop` (style) opportunity and, if enterable +
 * robbable-tagged, a `robbery-shop` opportunity. The v0.31.3
 * Style-vs-lootable ordering question disappears: there is no
 * precedence order.
 *
 * TODO: `layerForGtadbLandmark` in src/data/catalogue.ts is NOT deleted
 * in this step — the UI still reads it. It dies only when no reader
 * remains; the rebuild lane tracks that as a checklist item, not a
 * big bang (DESIGN §3.2).
 */
import {
  ROBBABLE_SHOP_TAGS,
  SHOP_TAGS,
  shopMapIndex,
} from '../data/catalogue';
import {
  gangOpLootForLocation,
  gangOpRecordForLocation,
} from '../data/gang-operations';
import type { GameLocation, Opportunity, OpportunityKind } from './game-db';

function makeOpportunity(
  location: GameLocation,
  kind: OpportunityKind,
  label: string,
  options: {
    detail?: string;
    loot?: { code?: string; contents: string[] };
    repeatable?: boolean;
  } = {},
): Opportunity {
  return {
    id: `opp:${location.id}:${kind}:1`,
    locationId: location.id,
    kind,
    label,
    detail: options.detail,
    loot: options.loot,
    repeatable: options.repeatable ?? false,
    evidence: [...location.evidence],
  };
}

function hasTag(location: GameLocation, tag: string): boolean {
  return location.tags.includes(tag);
}

function hasAnyTag(location: GameLocation, tags: readonly string[]): boolean {
  return tags.some((tag) => location.tags.includes(tag));
}

/** Shop subtype label, in the game's own Map Index groups (§3.1). */
function shopLabel(location: GameLocation): string {
  switch (shopMapIndex(location.tags)) {
    case 'weapons':
      return 'Weapons shop';
    case 'style':
      return 'Style shop';
    case 'vehicles':
      return 'Vehicles shop';
    default:
      return 'Food & drink shop';
  }
}

/** Buy here. Fires for any shop-tagged location (SHOP_TAGS). */
export function shopOpportunity(location: GameLocation): Opportunity | null {
  if (!hasAnyTag(location, SHOP_TAGS)) return null;
  const shopTag = SHOP_TAGS.find((tag) => location.tags.includes(tag));
  return makeOpportunity(location, 'shop', shopLabel(location), {
    detail: shopTag,
  });
}

/**
 * Robbery-shop subtype, for the §4.2 category derivation: 'pawn' for
 * jewellery/pawn shops, 'convenience' for convenience-style shops,
 * 'other' for the rest. `categoryProgress` reads `detail` — it is the
 * machine subtype, while `label` carries the human text.
 */
export function robberyShopSubtype(location: GameLocation): 'pawn' | 'convenience' | 'other' {
  if (
    hasAnyTag(location, ['#jewelry', '#pawn', 'pawn', 'jewelry', '#jewellery', 'jewellery'])
  )
    return 'pawn';
  if (hasAnyTag(location, ['retail', '#supermarket', '#gas', '#food', '#vendor', '#pharmacy']))
    return 'convenience';
  return 'other';
}

/**
 * Hold this shop up. Fires for an enterable shop carrying a robbable
 * tag — INDEPENDENTLY of `shop`: a Style shop with the generic
 * 'retail' tag yields both (the v0.31.3 bug, structurally impossible
 * now). A gun shop (#guns) never yields this opportunity: the game's
 * hold-up kinds are pawn/jewellery and convenience (DESIGN §4.2), no
 * verified source names an Ammu-Nation as a stick-up target, and the
 * lootable description already states "Ammu-Nation cannot be robbed".
 * The exclusion is explicit here because the generic 'retail' tag
 * would otherwise fire it — the three verified gun shops (L298, L1074,
 * L2413) all carry 'retail'. If a verified source names a gun shop as
 * a hold-up target, this gains an exception — never silently via
 * 'retail'. Strip clubs (#stripclub) are not robbable-tagged, so they
 * never yield this opportunity either.
 */
export function robberyShopOpportunity(location: GameLocation): Opportunity | null {
  if (!hasTag(location, 'enterable')) return null;
  if (!hasAnyTag(location, ROBBABLE_SHOP_TAGS)) return null;
  if (hasTag(location, '#guns')) return null;
  const subtype = robberyShopSubtype(location);
  return makeOpportunity(location, 'robbery-shop', 'Hold-up target', {
    detail: subtype,
    repeatable: true,
  });
}

/** Loot Map heist / vault / payday loan. Fires on the 'heist' tag. */
export function bankJobOpportunity(location: GameLocation): Opportunity | null {
  if (!hasTag(location, 'heist')) return null;
  if (hasTag(location, 'payday-loan')) {
    return makeOpportunity(location, 'bank-job', 'Payday loan job', {
      detail: 'Payday loan',
      repeatable: true,
    });
  }
  if (hasTag(location, 'vault')) {
    return makeOpportunity(location, 'bank-job', 'Vault job', {
      detail: 'Bank vault',
      repeatable: true,
    });
  }
  if (hasTag(location, 'story-job')) {
    // A story job is a one-time job, not a repeatable hold-up.
    return makeOpportunity(location, 'bank-job', 'Story job', {
      detail: 'Story job',
      repeatable: false,
    });
  }
  return makeOpportunity(location, 'bank-job', 'Bank job', {
    detail: 'Small bank',
    repeatable: true,
  });
}

/**
 * One of the 39 gang operations (DESIGN §4.2, §8.1 import). Fires on
 * the 'gang-op' tag — the import's places carry it, and the two
 * host-matched sites (Sunrise RV Park L265, Parlor Apartments)
 * carry it on their existing rows. The detail is the gang name;
 * the loot (safe code + Key Valuables) rides on the opportunity
 * from the gang-op record — never as a standalone pin (§3.1).
 */
export function gangOpportunity(location: GameLocation): Opportunity | null {
  if (!hasTag(location, 'gang-op')) return null;
  const record = gangOpRecordForLocation(location.id);
  const loot = gangOpLootForLocation(location.id);
  return makeOpportunity(location, 'gang-op', 'Gang operation', {
    detail: record ? record.gang : 'Illegal operation',
    ...(loot ? { loot } : {}),
    repeatable: true,
  });
}

/**
 * Break into this house / apartment / trailer. Three independent
 * routes, all honest about their source:
 * - the 'breakable' tag (guide-named examples + player markers): the
 *   guide's loot line is the detail, verbatim from the location
 *   description;
 * - residential + enterable (the GTADB-tagged houses);
 * - an unnamed Capri record that is enterable or residential (the
 *   Capri rob-house candidates), or the Port Gellhorn Trailer Park
 *   (name starts with "Trailer Park" + residential).
 */
export function breakInOpportunity(location: GameLocation): Opportunity | null {
  if (hasTag(location, 'breakable')) {
    return makeOpportunity(location, 'break-in', 'Break-in', {
      detail: location.description,
      repeatable: true,
    });
  }
  const residential = hasTag(location, 'residential');
  const enterable = hasTag(location, 'enterable');
  if (residential && enterable) {
    return makeOpportunity(location, 'break-in', 'Break-in', {
      detail:
        'Residential + enterable — dark blue on the in-game map means you can go in.',
      repeatable: true,
    });
  }
  const unnamedCapri =
    location.name === null &&
    location.areaId === 'area:capri' &&
    (enterable || residential);
  if (unnamedCapri) {
    return makeOpportunity(location, 'break-in', 'Break-in', {
      detail:
        'Unnamed Capri house — enterable or residential; dark blue on the in-game map means you can go in.',
      repeatable: true,
    });
  }
  if ((location.name ?? '').startsWith('Trailer Park') && residential) {
    return makeOpportunity(location, 'break-in', 'Break-in', {
      detail:
        'Residential trailer park — dark blue on the in-game map means you can go in.',
      repeatable: true,
    });
  }
  return null;
}

/** Enterable building, no robbery implied. Fires on 'enterable'. */
export function interiorOpportunity(location: GameLocation): Opportunity | null {
  if (!hasTag(location, 'enterable')) return null;
  return makeOpportunity(location, 'interior', 'Enterable interior');
}

/**
 * Member gym. Fires on a gym tag — but NOT on free-equipment rows,
 * which also carry the 'gym' tag (src/data/gyms.ts builds both kinds
 * through the same helper): an 'equipment' tag means free public
 * gear, which is a `workout-equipment` opportunity instead.
 */
export function gymOpportunity(location: GameLocation): Opportunity | null {
  if (hasTag(location, 'equipment')) return null;
  if (!hasAnyTag(location, ['gym', '#gym', 'fitness'])) return null;
  return makeOpportunity(location, 'gym', 'Member gym');
}

/** Free public workout equipment — no membership (user correction,
 *  2026-11-23: gyms and equipment are different things). Fires on
 *  the 'equipment' / 'workout' tags (curated equipment rows and the
 *  player's own workout markers). */
export function workoutEquipmentOpportunity(location: GameLocation): Opportunity | null {
  if (!hasAnyTag(location, ['equipment', 'workout'])) return null;
  return makeOpportunity(location, 'workout-equipment', 'Free workout equipment');
}

/**
 * The 7 named pool (8-ball) opponent venues (COVERAGE §3, PowerPyx
 * via RetroBroker/gtaculture: Rusty Anchor, Skeeter's, Zotico's,
 * Kowaachobee Cafe & Bar, Delights, The Thirsty Wolf, Jacob's Tavern
 * Bar). Only the venues with a catalogue record yield an opportunity
 * — Skeeter's, Zotico's and Kowaachobee have no GTADB record, so they
 * yield nothing here rather than a guessed pin. Matching is by the
 * location's name (first address segment, leading "The " ignored).
 * The Loot Map leisure records (pool 3, fitness 3, golf 1, arcade 1)
 * were excluded from import, so this list is the only activity source
 * until a licensed activity dataset lands.
 */
export const POOL_OPPONENT_VENUES: readonly string[] = [
  'Delights',
  'Rusty Anchor',
  "Skeeter's",
  "Zotico's",
  'Kowaachobee Cafe & Bar',
  'The Thirsty Wolf',
  "Jacob's Tavern Bar",
];

export function activityOpportunity(location: GameLocation): Opportunity | null {
  if (!location.name) return null;
  const firstSegment = location.name.split(',')[0]?.trim() ?? '';
  const normalized = firstSegment.toLowerCase().replace(/^the\s+/, '');
  const matched = POOL_OPPONENT_VENUES.some(
    (venue) => venue.toLowerCase().replace(/^the\s+/, '') === normalized,
  );
  if (!matched) return null;
  return makeOpportunity(location, 'activity', 'Pool (8-ball) — opponent venue', {
    detail:
      'One of 7 opponent venues (PowerPyx via RetroBroker/gtaculture); 5 needed for 100%.',
  });
}

/**
 * A safe / garage / bunker holding a vehicle or code. Vehicle loot
 * lives on the host opportunity, never as a standalone pin (DESIGN
 * §3.1) — the gang-op import (§8.1) carries it: a gang-op site with
 * a standout vehicle or a safe code fires this alongside its gang-op
 * opportunity, with the same loot. A player-jotted vehicle-loot
 * marker fires it too (its loot is the player's own description /
 * note — no code is ever invented for it). Repeatable: gang-op
 * sites restock and a safe can be opened again, so 'looted' is a
 * legal verb here — without this, recordCompletion would reject
 * every vehicle-loot mark.
 */
export function vehicleLootOpportunity(location: GameLocation): Opportunity | null {
  if (!hasTag(location, 'vehicle-loot')) return null;
  const loot = gangOpLootForLocation(location.id);
  const detail = loot?.code
    ? `Safe code ${loot.code}`
    : loot
      ? `Standout vehicle: ${gangOpRecordForLocation(location.id)?.loot.vehicles.join(', ') ?? ''}`
      : 'Vehicle or safe the player marked';
  return makeOpportunity(location, 'vehicle-loot', 'Vehicle loot', {
    detail,
    ...(loot ? { loot } : {}),
    repeatable: true,
  });
}

/** Easter egg. Fires on the 'easter-egg' tag; none exist yet. */
export function easterEggOpportunity(location: GameLocation): Opportunity | null {
  if (!hasTag(location, 'easter-egg')) return null;
  return makeOpportunity(location, 'easter-egg', 'Easter egg');
}

/**
 * Missions are held but modellable (DESIGN §2.8): the kind exists,
 * the store carries a `missionsEnabled` gate (default off), and this
 * function returns null while the gate is off — a mission opportunity
 * is never derived until the missions decision flips.
 */
export function missionOpportunity(_location: GameLocation): Opportunity | null {
  return null;
}

/**
 * A place worth visiting (landmark scan, viewpoint). Fires on the
 * 'leisure' tag — a leisure venue is a place worth visiting even when
 * it is also a shop, an interior or an activity. This is Delights'
 * fourth opportunity (shop + interior + activity + discovery).
 */
export function discoveryOpportunity(location: GameLocation): Opportunity | null {
  if (!hasTag(location, 'leisure')) return null;
  return makeOpportunity(location, 'discovery', 'Worth a visit', {
    detail: 'Leisure venue',
  });
}

/**
 * All opportunities for a location — a set, never a single winner.
 * Kind order is fixed (shop → discovery) for stable ids and stable
 * rendering; it is NOT a precedence order — every function runs.
 */
export function opportunitiesForLocation(location: GameLocation): Opportunity[] {
  return [
    shopOpportunity(location),
    robberyShopOpportunity(location),
    bankJobOpportunity(location),
    gangOpportunity(location),
    breakInOpportunity(location),
    interiorOpportunity(location),
    gymOpportunity(location),
    workoutEquipmentOpportunity(location),
    activityOpportunity(location),
    vehicleLootOpportunity(location),
    easterEggOpportunity(location),
    missionOpportunity(location),
    discoveryOpportunity(location),
  ].filter((opportunity): opportunity is Opportunity => opportunity !== null);
}
