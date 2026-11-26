import type { Place } from '../domain/types';

/**
 * The 39 gang operations ("Illegal Operations") — the §8.1 import
 * (COVERAGE §6a, §8.1; DESIGN §4.2 Gang Operations, §9 Demo C).
 *
 * WHAT THIS IS
 * Every one of the 39 operations the in-game Gangs tracker counts,
 * in the game's own order, with the gang that runs it, the area the
 * guides name, and the Key Valuables (unique weapon / standout
 * vehicle / watch / safe) where a guide has published them — 23 of
 * the 39 have published loot, 16 do not yet (their Key Valuables are
 * still TBC in every guide checked). Safe codes are carried where a
 * guide states one (11 of the 39).
 *
 * LICENCE — READ BEFORE REUSING
 * No open-licensed dataset lists these operations. The names, gangs,
 * areas and loot below are FACTS compiled from the launch guides
 * (PowerPyx for the 39 names in in-game order; gtaaddict, Insider
 * Gaming, Output Lag and KeenGamer for areas and loot) — guide text
 * is citable, the guides themselves are © all rights reserved, and
 * no guide publishes coordinates. So every record here carries
 * `license: 'unlicensed — names, areas and loot facts only, no
 * positions'` and `position: null`: area-known, searchable, journal-
 * listed, NEVER a pin. No coordinate was invented, estimated or
 * lifted from a closed map. The player jot flow (a 'vehicle-loot'
 * marker) is how a site gains a position — the player stood there.
 *
 * HOST MATCHES (no duplicate locations for one building)
 * - Sunrise RV Park is GTADB L265 ("Sunrise RV Park, Mariana
 *   County", tags agriculture + unconfirmed) — the gang-op attaches
 *   to L265 via GANG_OP_GTADB_HOSTS in catalogue.ts, no new place.
 * - Parlor Apartments is the breakable-home example
 *   'breakable:parlor-apartments' — the gang-op attaches to it via
 *   the 'gang-op' tag in breakable-homes.ts, no new place.
 * - La Cascara Motel matches TWO GTADB records (L806, L981, both
 *   "La Cascara Motel, Port Gellhorn") — no host-match is made,
 *   because picking one would be a guess. It stays an area-known
 *   gang-op place and the description names both records.
 * - No other operation name matches a GTADB record (checked
 *   2026-11-26 against the pinned 2e9e194 snapshot): Brooks
 *   Boatworks, Kingpin Bowling, June Warehouse, Manatee Motel and
 *   the other 33 have no catalogue host, so they are area-known
 *   places here.
 *
 * CONFLICTS RECORDED, NOT RESOLVED
 * - M7 Compound (#9) is listed as "Nova Auto Junkyard" by Insider
 *   Gaming; gtaaddict notes the two names may be the same spot.
 *   The in-game-order name (M7 Compound) is canonical; the alias
 *   is on the record and in the description.
 * - Biker Hideout's area is disputed: south of Lake Leonida
 *   (gtaaddict's table) vs a bar east of Ambrosia (GameRant
 *   walkthrough via gtaaddict). Both are in the description.
 * - Manatee Motel is "Manatee Hotel" in Insider Gaming's table.
 * - Slator Towing Inc: gtaaddict says Salton, Insider Gaming says
 *   South Vice City — Salton is a Vice City neighbourhood, so the
 *   record uses Salton and cites both.
 *
 * NOT IMPORTED
 * - The Ultimate Edition bonus, "Illegal Goods Store" (PTT
 *   Youngin$, Southside) — not one of the 39, not on the in-game
 *   tracker, not needed for 100%. Named here only so nobody
 *   re-adds it as a 40th operation.
 * - The non-gang-op safe codes from the aggregator lists
 *   (President's bunker 010317, black-site hatch 085355, Brian's
 *   Lockup 7700, Pelican Valley dock 0212, Moonstone Boutique 0420,
 *   Frampton Islands bunker 3612, 1974 Vamos garage 2727,
 *   party-house garage 092319 — nerdsnack / showgamer via
 *   COVERAGE §4): single-aggregator, area-described only, no host
 *   building in any source checked. They stay OUT until a second
 *   source or the player confirms one in game — the vehicle-loot
 *   jot is the path for those.
 * - Farm Fix Meth Lab's code 2121 IS imported, but it is the one
 *   single-source code in this file (nerdsnack safe-codes list) —
 *   the description says so.
 *
 * Sources (checked 2026-11-26):
 * - PowerPyx, "GTA 6 All Illegal Gang Operations Locations" —
 *   the 39 names in in-game order, by gang.
 *   https://www.powerpyx.com/gta-6-all-illegal-gang-operations-locations/
 * - GTA Addict, "GTA VI gang operations — all 39 locations" —
 *   per-site areas + walkthrough loot for 12 sites.
 *   https://gtaaddict.com/gta-6/gang-operations/
 * - Insider Gaming, "All Illegal Operations Locations & Key
 *   Valuables In GTA 6" — per-site areas + Key Valuables table.
 *   https://insider-gaming.com/all-illegal-operations-locations-key-valuables-in-gta-6/
 * - Output Lag, "GTA 6 Gang Hideouts: All Key Valuables and
 *   Codes" — the six corroborated safe codes.
 *   https://outputlag.com/guides/gta-6-gang-hideouts-key-valuables/
 * - KeenGamer, "GTA 6: All Kingfishers Robbery Locations, Safe
 *   Code, and Loot" — the three Kingfishers sites.
 *   https://www.keengamer.com/articles/guides/gta-6-all-kingfishers-robbery-locations-safe-code-and-loot/
 */
export const GANG_OP_LICENSE =
  'unlicensed — names, areas and loot facts only, no positions';

export const GANG_OP_SOURCE = {
  title: 'PowerPyx · GTA 6 All Illegal Gang Operations Locations',
  url: 'https://www.powerpyx.com/gta-6-all-illegal-gang-operations-locations/',
};

export interface GangOperationLoot {
  /** Safe code, where a guide states one. */
  code?: string;
  /** Key Valuables, in the guides' words, short lines. Empty when no
   *  guide has published this site's loot yet. */
  contents: string[];
  /** Standout vehicles among the contents (drives the vehicle-loot
   *  opportunity — a site with a vehicle or a code is vehicle loot). */
  vehicles: string[];
}

export interface GangOperationRecord {
  /** `gang-op:<slug>` — the place id, unless hostLocationId is set. */
  id: string;
  name: string;
  gang: string;
  /** In-game order, 1–39 (PowerPyx). */
  order: number;
  /** Area lead, in the guides' words ("Port Gellhorn, north of the
   *  Pay 'n' Spray"). Never a coordinate. */
  areaLead: string;
  /** Region string for area resolution ("Port Gellhorn, Kelly
   *  County") — the finest area that names the site. */
  region: string;
  loot: GangOperationLoot;
  /** Which guide stated the loot above (short citation). */
  lootSource: string;
  /** Other published names for the same site. */
  aliases?: string[];
  /** Conflicts / caveats, in plain words. */
  notes?: string;
  /** An existing catalogue location that already IS this site
   *  (GTADB record or guide place) — no new place is created. */
  hostLocationId?: string;
}

function op(
  record: GangOperationRecord,
): GangOperationRecord {
  return record;
}

export const GANG_OPERATIONS: readonly GangOperationRecord[] = [
  // --- Kingfishers (3) — Grassrivers, Mariana County ---
  op({
    id: 'gang-op:fishing-shacks',
    name: 'Fishing Shacks',
    gang: 'Kingfishers',
    order: 1,
    areaLead: 'Wetman Bay, southwest Pelican Valley — dark sand flats at the western edge of Grassrivers',
    region: 'Wetman Bay, Grassrivers',
    loot: {
      contents: [
        'Kingfishers W-22 Small Game Rifle (unique variant)',
        'Cocaine pickups to fence',
      ],
      vehicles: [],
    },
    lootSource: 'KeenGamer · Kingfishers robbery locations; Insider Gaming · Illegal Operations',
  }),
  op({
    id: 'gang-op:sunrise-rv-park',
    name: 'Sunrise RV Park',
    gang: 'Kingfishers',
    order: 2,
    areaLead: 'North shore of Cottonmouth Lake, east of Wetman Bay',
    region: 'Mariana County',
    loot: {
      code: '6769',
      contents: [
        'Kingfishers Akulus Revolver (unique variant)',
        'Two safes — keypad safe code 6769',
      ],
      vehicles: [],
    },
    lootSource: 'Output Lag · Gang Hideouts: Key Valuables and Codes; KeenGamer · Kingfishers robbery locations',
    hostLocationId: 'L265',
  }),
  op({
    id: 'gang-op:manatee-motel',
    name: 'Manatee Motel',
    gang: 'Kingfishers',
    order: 3,
    areaLead: 'Southwest of Hamlet, just above the Shoeless Keys',
    region: 'Grassrivers, Mariana County',
    loot: {
      contents: [
        'Kingfishers Laird 350 Sniper (unique variant)',
        'Cash and cocaine',
        'Shotgun at the back of the building',
      ],
      vehicles: [],
    },
    lootSource: 'GTA Addict · Gang operations; Insider Gaming · Illegal Operations',
    aliases: ['Manatee Hotel'],
  }),
  // --- Kolts & Associates (5) — Port Gellhorn, Kelly County ---
  op({
    id: 'gang-op:kingpin-bowling',
    name: 'Kingpin Bowling',
    gang: 'Kolts & Associates',
    order: 4,
    areaLead: 'Port Gellhorn',
    region: 'Port Gellhorn, Kelly County',
    loot: {
      code: '0300',
      contents: [
        "Crowex Octane 'Orca' luxury watch",
        'Gutterball Moreland 850 Shotgun (unique variant)',
        'Office safe',
      ],
      vehicles: [],
    },
    lootSource: 'Output Lag · Gang Hideouts: Key Valuables and Codes; Insider Gaming · Illegal Operations',
  }),
  op({
    id: 'gang-op:june-warehouse',
    name: 'June Warehouse',
    gang: 'Kolts & Associates',
    order: 5,
    areaLead: 'Port Gellhorn, west of the Delights Cabaret',
    region: 'Port Gellhorn, Kelly County',
    loot: {
      contents: [
        'Vapid Truth & Justice Caracara (standout vehicle)',
        'Kolt Vatra SMG (unique variant)',
        'Safe holding $1,355',
      ],
      vehicles: ['Vapid Truth & Justice Caracara'],
    },
    lootSource: 'GTA Addict · Gang operations; Insider Gaming · Illegal Operations',
  }),
  op({
    id: 'gang-op:la-cascara-motel',
    name: 'La Cascara Motel',
    gang: 'Kolts & Associates',
    order: 6,
    areaLead: 'Port Gellhorn, west side, northeast of Wild Hog Point',
    region: 'Port Gellhorn, Kelly County',
    loot: {
      code: '6969',
      contents: [
        'Vapid Firebug Dominator (standout vehicle)',
        'Scrapper VF5C SMG (unique variant)',
        'Top-floor safe holding $2,239',
      ],
      vehicles: ['Vapid Firebug Dominator'],
    },
    lootSource: 'GTA Addict · Gang operations; Insider Gaming · Illegal Operations',
    aliases: ['La Cascara Hotel'],
    notes:
      'Two GTADB records share this name (L806, L981, both "La Cascara Motel, Port Gellhorn") — no host-match made, so this stays area-known.',
  }),
  op({
    id: 'gang-op:brooks-boatworks',
    name: 'Brooks Boatworks',
    gang: 'Kolts & Associates',
    order: 7,
    areaLead: "Port Gellhorn, north of the Pay 'n' Spray",
    region: 'Port Gellhorn, Kelly County',
    loot: {
      code: '6823',
      contents: [
        'Vapid Smuggler Caracara (standout vehicle)',
        'Clunker 556 Assault Rifle (unique variant)',
        'Safe holding $2,165',
        'Second safe holding $1,409 (no code — screwdriver)',
      ],
      vehicles: ['Vapid Smuggler Caracara'],
    },
    lootSource: 'GTA Addict · Gang operations; Insider Gaming · Illegal Operations; Output Lag · Gang Hideouts',
  }),
  op({
    id: 'gang-op:stash-house',
    name: 'Stash House',
    gang: 'Kolts & Associates',
    order: 8,
    areaLead: 'Port Gellhorn, northwest of the Wasteland Off-Road mod shop',
    region: 'Port Gellhorn, Kelly County',
    loot: {
      contents: [
        'Kolt 556 Assault Rifle (unique variant)',
        'Safe holding $1,489',
      ],
      vehicles: [],
    },
    lootSource: 'GTA Addict · Gang operations; Insider Gaming · Illegal Operations',
  }),
  // --- M7 (2) ---
  op({
    id: 'gang-op:m7-compound',
    name: 'M7 Compound',
    gang: 'M7',
    order: 9,
    areaLead: "Hamlet, east of Layin' Ink tattoo parlor",
    region: 'Hamlet, Mariana County',
    loot: {
      contents: [
        'Albany Teniente Manana (standout vehicle)',
        'Marabunta Grande KZ-59 Assault Rifle (unique variant)',
      ],
      vehicles: ['Albany Teniente Manana'],
    },
    lootSource: 'Insider Gaming · Illegal Operations (as "Nova Auto Junkyard")',
    aliases: ['Nova Auto Junkyard'],
    notes:
      'Insider Gaming lists this site as "Nova Auto Junkyard"; GTA Addict notes the two names may be the same spot. The in-game-order name (M7 Compound) is canonical.',
  }),
  op({
    id: 'gang-op:weed-grow',
    name: 'Weed Grow',
    gang: 'M7',
    order: 10,
    areaLead: 'East of Lake Tallaloko, Lummox County',
    region: 'Lummox County',
    loot: { contents: [], vehicles: [] },
    lootSource: '',
  }),
  // --- La Polilla Negra (2) ---
  op({
    id: 'gang-op:palmer-fishing-warehouse',
    name: 'Palmer Fishing Warehouse',
    gang: 'La Polilla Negra',
    order: 11,
    areaLead: 'Southern tip of Bobcat Key, Watson Bay',
    region: 'Watson Bay, Mariana County',
    loot: {
      code: '1886',
      contents: [
        'Crowex Octane Elite watch',
        'La Polilla Negra KZ-59 Assault Rifle (unique variant)',
        'Safe holding $3,000–$3,700',
        'GLR 40 Grenade Launcher',
      ],
      vehicles: [],
    },
    lootSource: 'GTA Addict · Gang operations (GameRant walkthrough)',
  }),
  op({
    id: 'gang-op:watson-bay-safehouse',
    name: 'Watson Bay Safehouse',
    gang: 'La Polilla Negra',
    order: 12,
    areaLead: 'Eastern edge of Watson Bay',
    region: 'Watson Bay, Mariana County',
    loot: { contents: [], vehicles: [] },
    lootSource: '',
  }),
  // --- Final Chapter (4) ---
  op({
    id: 'gang-op:farm-fix-meth-lab',
    name: 'Farm Fix Meth Lab',
    gang: 'Final Chapter',
    order: 13,
    areaLead: 'Middle of Leonard County, north of Belville',
    region: 'Leonard County',
    loot: {
      code: '2121',
      contents: ['Meth lab safe'],
      vehicles: [],
    },
    lootSource: 'nerdsnack · GTA 6 Safe Codes (single source — unverified)',
    notes: 'The code 2121 is single-source (nerdsnack safe-codes list); no walkthrough states it.',
  }),
  op({
    id: 'gang-op:biker-hideout',
    name: 'Biker Hideout',
    gang: 'Final Chapter',
    order: 14,
    areaLead: 'South of the southernmost tip of Lake Leonida',
    region: 'Leonard County',
    loot: {
      code: '1982',
      contents: [
        'LCC Monarch Avarus Bike (standout vehicle)',
        'Ride Free H&L .38 Revolver (unique variant)',
        'Safe',
      ],
      vehicles: ['LCC Monarch Avarus Bike'],
    },
    lootSource: 'GTA Addict · Gang operations (GameRant walkthrough); Output Lag · Gang Hideouts',
    notes:
      'Area conflict: GTA Addict’s table places it south of Lake Leonida; the GameRant walkthrough calls it a bar east of Ambrosia. Both are recorded here.',
  }),
  op({
    id: 'gang-op:hog-stars-garage',
    name: 'Hog Stars Garage',
    gang: 'Final Chapter',
    order: 15,
    areaLead: 'Ambrosia, east of Irons Building Supply, behind a charity car wash',
    region: 'Ambrosia',
    loot: {
      contents: [
        "Decalsse Devil's Rope Gauntlet (standout vehicle)",
        'Final Chapter Shortstraw Shotgun (unique variant)',
        'Safe in the office (no code)',
      ],
      vehicles: ["Decalsse Devil's Rope Gauntlet"],
    },
    lootSource: 'GTA Addict · Gang operations (GameRant walkthrough)',
  }),
  op({
    id: 'gang-op:irons-building-supply',
    name: 'Irons Building Supply',
    gang: 'Final Chapter',
    order: 16,
    areaLead: 'Ambrosia',
    region: 'Ambrosia',
    loot: { contents: [], vehicles: [] },
    lootSource: '',
  }),
  // --- San4San (5) — North Vice City ---
  op({
    id: 'gang-op:sound4sond-studio',
    name: 'Sound4Sond Studio',
    gang: 'San4San',
    order: 17,
    areaLead: 'East of La Perle, Stockyard',
    region: 'Stockyard, Vice City',
    loot: { contents: [], vehicles: [] },
    lootSource: '',
  }),
  op({
    id: 'gang-op:la-perle-trap-house',
    name: 'La Perle Trap House',
    gang: 'San4San',
    order: 18,
    areaLead: "North-west of La Perle, south of Zak's Liquor",
    region: 'La Perle, Vice City',
    loot: { contents: [], vehicles: [] },
    lootSource: '',
  }),
  op({
    id: 'gang-op:illegal-sneaker-trade',
    name: 'Illegal Sneaker Trade',
    gang: 'San4San',
    order: 19,
    areaLead: 'Center of La Perle (Drip Drops store)',
    region: 'La Perle, Vice City',
    loot: {
      code: '4124',
      contents: ['Two safes — second safe upstairs in the building across the alley'],
      vehicles: [],
    },
    lootSource: 'Output Lag · Gang Hideouts: Key Valuables and Codes',
  }),
  op({
    id: 'gang-op:janjaks-garage',
    name: "JanJak's Garage",
    gang: 'San4San',
    order: 20,
    areaLead: 'North Vice City — exact spot not stated in any guide checked',
    region: 'Vice City',
    loot: {
      code: '4444',
      contents: [
        'Declasse Gin Tulip (pink, standout vehicle)',
        'San4San KZ-59 Assault Rifle (unique variant)',
        'Safe in the back office',
      ],
      vehicles: ['Declasse Gin Tulip'],
    },
    lootSource: 'Output Lag · Gang Hideouts: Key Valuables and Codes',
  }),
  op({
    id: 'gang-op:parlor-apartments',
    name: 'Parlor Apartments',
    gang: 'San4San',
    order: 21,
    areaLead: 'South Rockridge',
    region: 'Rockridge, Vice City',
    loot: {
      contents: ['Safe full of cash', 'Drugs', 'Shotgun in the apartment'],
      vehicles: [],
    },
    lootSource: 'Robbery guides · HowToVideoGame "Can You Rob Houses?" (same loot line as the breakable-home example)',
    hostLocationId: 'breakable:parlor-apartments',
  }),
  // --- PTT Youngin$ (2) — Southside, Vice City ---
  op({
    id: 'gang-op:southside-trap-house',
    name: 'Southside Trap House',
    gang: 'PTT Youngin$',
    order: 22,
    areaLead: 'Southside, north of the medical center',
    region: 'Southside, Vice City',
    loot: { contents: [], vehicles: [] },
    lootSource: '',
  }),
  op({
    id: 'gang-op:kamar-devon-community-center',
    name: 'Kamar Devon Community Center',
    gang: 'PTT Youngin$',
    order: 23,
    areaLead: 'Southside, across from the Illegal Goods Store',
    region: 'Southside, Vice City',
    loot: { contents: [], vehicles: [] },
    lootSource: '',
  }),
  // --- The Guardia Brothers (3) ---
  op({
    id: 'gang-op:saber-shipping-yard',
    name: 'Saber Shipping Yard',
    gang: 'The Guardia Brothers',
    order: 24,
    areaLead: "Little Cuba, river's western side",
    region: 'Little Cuba, Vice City',
    loot: {
      code: '8046',
      contents: ['Safe'],
      vehicles: [],
    },
    lootSource: 'GTA Addict · Gang operations (GameRant walkthrough)',
  }),
  op({
    id: 'gang-op:casa-guardia',
    name: 'Casa Guardia',
    gang: 'The Guardia Brothers',
    order: 25,
    areaLead: 'Little Cuba, north-east',
    region: 'Little Cuba, Vice City',
    loot: { contents: [], vehicles: [] },
    lootSource: '',
  }),
  op({
    id: 'gang-op:saber-shipping-facility',
    name: 'Saber Shipping Facility',
    gang: 'The Guardia Brothers',
    order: 26,
    areaLead: 'Balsero, across the river from the yard',
    region: 'Balsero, Vice City',
    loot: {
      code: '1122',
      contents: [
        'Guardia Brothers VF5 SMG (unique variant)',
        'B&G Ark Royal Ashore watch',
        'Safe',
      ],
      vehicles: [],
    },
    lootSource: 'GTA Addict · Gang operations (GameRant walkthrough)',
  }),
  // --- Other Criminals (13) ---
  op({
    id: 'gang-op:exotic-animals-front',
    name: 'Exotic Animals Front',
    gang: 'Other Criminals',
    order: 27,
    areaLead: 'Key Lento — Three Sheets Liquor, halfway down the island, eastern side',
    region: 'Key Lento',
    loot: {
      contents: ['Cash ($2,500–$3,500 reported)'],
      vehicles: [],
    },
    lootSource: 'Insider Gaming · Illegal Operations; GTA Addict · Gang operations',
  }),
  op({
    id: 'gang-op:mill-station-radar-base',
    name: 'Mill Station Radar Base',
    gang: 'Other Criminals',
    order: 28,
    areaLead: 'North of Watson Bay — exact spot not stated in any guide checked',
    region: 'Watson Bay, Mariana County',
    loot: { contents: [], vehicles: [] },
    lootSource: '',
  }),
  op({
    id: 'gang-op:industrial-weed-grow',
    name: 'Industrial Weed Grow',
    gang: 'Other Criminals',
    order: 29,
    areaLead: 'North Mariana County, northeast of Tola Bay',
    region: 'Mariana County',
    loot: {
      contents: [
        'Vapid Cultivator Sandking (standout vehicle)',
        'Chronic Vatra SMG (unique variant)',
        'Safe holding $984 in the office',
      ],
      vehicles: ['Vapid Cultivator Sandking'],
    },
    lootSource: 'GTA Addict · Gang operations; Insider Gaming · Illegal Operations',
  }),
  op({
    id: 'gang-op:slator-towing-inc',
    name: 'Slator Towing Inc',
    gang: 'Other Criminals',
    order: 30,
    areaLead: "Salton, just north of the Salton Pay & Spray",
    region: 'Salton, Vice City',
    loot: { contents: [], vehicles: [] },
    lootSource: '',
    notes: 'Insider Gaming places this in "South Vice City"; Salton is a Vice City neighbourhood, so the record uses Salton and cites both.',
  }),
  op({
    id: 'gang-op:leonida-carrier-warehouse',
    name: 'Leonida Carrier Warehouse',
    gang: 'Other Criminals',
    order: 31,
    areaLead: 'West Vice City — exact spot not stated in any guide checked',
    region: 'Vice City',
    loot: { contents: [], vehicles: [] },
    lootSource: '',
  }),
  op({
    id: 'gang-op:cigar-import-front',
    name: 'Cigar Import Front',
    gang: 'Other Criminals',
    order: 32,
    areaLead: 'North Vice City — exact spot not stated in any guide checked',
    region: 'Vice City',
    loot: { contents: [], vehicles: [] },
    lootSource: '',
  }),
  op({
    id: 'gang-op:chatfield-storage-logistics',
    name: 'Chatfield Storage & Logistics',
    gang: 'Other Criminals',
    order: 33,
    areaLead: 'Waxman Island, next to the Waxman Island Pay & Spray',
    region: 'Waxman Island',
    loot: { contents: [], vehicles: [] },
    lootSource: '',
  }),
  op({
    id: 'gang-op:ocean-beach-lab',
    name: 'Ocean Beach Lab',
    gang: 'Other Criminals',
    order: 34,
    areaLead: 'East Vice City — exact spot not stated in any guide checked',
    region: 'Vice City',
    loot: { contents: [], vehicles: [] },
    lootSource: '',
  }),
  op({
    id: 'gang-op:vespucci-mansion',
    name: 'Vespucci Mansion',
    gang: 'Other Criminals',
    order: 35,
    areaLead: 'Vespucci Island, between Vice City and Vice Beach',
    region: 'Vespucci Island',
    loot: {
      contents: [
        'Progen Royal Ruby Emerus (supercar, standout vehicle)',
        'Kingpin Heathen Assault Rifle (unique variant)',
        'Two safes holding about $9,000',
      ],
      vehicles: ['Progen Royal Ruby Emerus'],
    },
    lootSource: 'GTA Addict · Gang operations',
  }),
  op({
    id: 'gang-op:gas-station-meth-front',
    name: 'Gas Station Meth Front',
    gang: 'Other Criminals',
    order: 36,
    areaLead: 'Emerald Springs — exact spot not stated in any guide checked',
    region: 'Emerald Springs, Kelly County',
    loot: { contents: [], vehicles: [] },
    lootSource: '',
  }),
  op({
    id: 'gang-op:walker-farm',
    name: 'Walker Farm',
    gang: 'Other Criminals',
    order: 37,
    areaLead: 'Frogswater, west of Ambrosia and east of Port Gellhorn',
    region: 'Frogswater, Kelly County',
    loot: {
      contents: [
        'Safe inside the main building (break open — no code published)',
        'Shrooms on the work tables to fence',
      ],
      vehicles: [],
    },
    lootSource: 'GTA Addict · Gang operations (GameRant walkthrough)',
  }),
  op({
    id: 'gang-op:backroom-weed-front',
    name: 'Backroom Weed Front',
    gang: 'Other Criminals',
    order: 38,
    areaLead: 'Pearl House Hair Salon, south Port Gellhorn',
    region: 'Port Gellhorn, Kelly County',
    loot: {
      contents: ['Safe holding $1,019'],
      vehicles: [],
    },
    lootSource: 'GTA Addict · Gang operations; Insider Gaming · Illegal Operations',
  }),
  op({
    id: 'gang-op:carter-mining-boathouse',
    name: 'Carter Mining Boathouse',
    gang: 'Other Criminals',
    order: 39,
    areaLead: 'Far north Lummox County — exact spot not stated in any guide checked',
    region: 'Lummox County',
    loot: { contents: [], vehicles: [] },
    lootSource: '',
  }),
];

/** Records keyed by the location that hosts them (own id, or an
 *  existing host's id). The opportunities layer reads this — never
 *  the other way round, so the data file stays the single source. */
const RECORDS_BY_LOCATION_ID: ReadonlyMap<string, GangOperationRecord> = new Map(
  GANG_OPERATIONS.map((record) => [record.hostLocationId ?? record.id, record]),
);

export function gangOpRecordForLocation(locationId: string): GangOperationRecord | null {
  return RECORDS_BY_LOCATION_ID.get(locationId) ?? null;
}

/**
 * The loot on a gang-op opportunity, by its host location id — the
 * Opportunity.loot field (DESIGN §3.1). Null when no guide has
 * published this site's loot yet: the opportunity exists (the site
 * is real, the gang is real) but carries no invented contents.
 */
export function gangOpLootForLocation(
  locationId: string,
): { code?: string; contents: string[] } | null {
  const record = gangOpRecordForLocation(locationId);
  if (!record) return null;
  if (!record.loot.code && record.loot.contents.length === 0) return null;
  return {
    ...(record.loot.code ? { code: record.loot.code } : {}),
    contents: [...record.loot.contents],
  };
}

/**
 * A site is vehicle loot when it holds a standout vehicle or a safe
 * code (OpportunityKind 'vehicle-loot': a safe / garage / bunker
 * holding a vehicle or code). A weapon/watch/cash-only site is not.
 */
export function gangOpHasVehicleLoot(locationId: string): boolean {
  const record = gangOpRecordForLocation(locationId);
  if (!record) return false;
  return record.loot.code !== undefined || record.loot.vehicles.length > 0;
}

/**
 * The "Available loot" line for the place card (domain/loot.ts):
 * the contents plus the code, with the loot source cited. Null when
 * nothing is published — the card then says so honestly instead of
 * showing a made-up line.
 */
export function gangOpLootText(
  locationId: string,
): { text: string; source: string } | null {
  const record = gangOpRecordForLocation(locationId);
  if (!record || record.loot.contents.length === 0) return null;
  const codeLine = record.loot.code ? `Safe code ${record.loot.code}. ` : '';
  return {
    text: `${codeLine}${record.loot.contents.join('; ')}.`,
    source: record.lootSource,
  };
}

/**
 * GTADB hosts for gang ops (catalogue.ts appends the 'gang-op' tag
 * to these records so the opportunity derives on the real place):
 * Sunrise RV Park is L265. Parlor Apartments is a breakable-home
 * place, not a GTADB record — its tag lives in breakable-homes.ts.
 */
export const GANG_OP_GTADB_HOSTS: ReadonlyMap<string, string> = new Map(
  GANG_OPERATIONS.filter(
    (record) => record.hostLocationId !== undefined && record.hostLocationId.startsWith('L'),
  ).map((record) => [record.hostLocationId!, record.id]),
);

/** True when a location id is a gang-op host (own place or host-matched). */
export function isGangOpLocation(locationId: string): boolean {
  return RECORDS_BY_LOCATION_ID.has(locationId);
}

function gangOpPlace(record: GangOperationRecord): Place {
  const lootSentence =
    record.loot.contents.length > 0
      ? `Key valuables (${record.lootSource}): ${record.loot.contents.join('; ')}.`
      : 'Key valuables not yet published in any guide checked.';
  const codeSentence = record.loot.code ? ` Safe code ${record.loot.code}.` : '';
  const notesSentence = record.notes ? ` ${record.notes}` : '';
  return {
    id: record.id,
    title: record.name,
    description:
      `${record.name} — ${record.gang} illegal operation, #${record.order} of 39. ` +
      `${record.areaLead}. ${lootSentence}${codeSentence}${notesSentence} ` +
      'Listed by area only — no verified position, so it is searchable only, not placed on the map.',
    category: 'robberies',
    position: null,
    layerId: 'gang-op',
    tags: [
      'gang-op',
      ...(record.loot.code !== undefined || record.loot.vehicles.length > 0
        ? ['vehicle-loot']
        : []),
    ],
    region: record.region,
    source: { ...GANG_OP_SOURCE, license: GANG_OP_LICENSE },
    evidence: 'uncertain',
  };
}

/**
 * The 37 area-known gang-op places. The other two operations ride on
 * existing locations (Sunrise RV Park → L265, Parlor Apartments →
 * breakable:parlor-apartments) and have no place row here — see
 * GANG_OP_GTADB_HOSTS and breakable-homes.ts.
 */
export const GANG_OP_PLACES: Place[] = GANG_OPERATIONS.filter(
  (record) => record.hostLocationId === undefined,
).map(gangOpPlace);
