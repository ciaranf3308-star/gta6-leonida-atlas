/**
 * GENERATED — do not edit by hand. Rebuild with:
 *   node scripts/build-card-checklist.mjs
 *
 * The 480-slot trading-card checklist: 480 in-game slots (checklistSlot: true) + 117 game-text tiers with no slot (checklistSlot: false, never counted toward a set).
 * Sources: six.mics.dev game-text identities (596 tiers, 230 people) +
 * lorenzone.fr written directions (480 slots, 490 pickups), hand-matched
 * to GTADB host buildings (snapshot rev 2e9e194). No printed card text
 * (© Rockstar) and no artwork (no licence) are bundled — printedText is
 * null and artwork is { front: null, back: null } throughout.
 * Counts: 597 items — 480 slots (386 pinned, 94 area-known, 0 unmapped), 117 extras.
 * 28 Nov 2026: fbrito import applied from scripts/fbrito-import-manifest.json (candidate pins in src/data/card-fbrito-pins.generated.ts). Re-apply with: node scripts/apply-fbrito-import.mjs.
 */
export interface CardChecklistPickup {
  areaLead: string;
  /** lorenzone.fr's written direction for this pickup, kept as text. */
  direction: string;
  sourceTitle: string;
  sourceUrl: string;
  evidence: 'approximate';
  /** GTADB host id where this pickup is host-matched, else null. */
  hostId: string | null;
  hostName: string | null;
}

export interface CardChecklistItem {
  id: string;
  person: string;
  variant: string;
  variantAlias: string | null;
  setId: string | null;
  setName: string | null;
  /** True for the 480 in-game collection slots; false for the 117
   *  game-text tiers with no slot (never counted toward a set). */
  checklistSlot: boolean;
  rarity: { tier: 'standard' | 'bronze' | 'silver' | 'gold'; colour?: string };
  placement: 'pinned' | 'area-known' | 'unmapped';
  spotDescription: string;
  areaLead: string;
  pickups: CardChecklistPickup[];
  /** GTADB host id for pinned slots, else null. */
  hostId: string | null;
  /** Existing catalogue Place id for this slot's pin (cards:* or
   *  loot:*), else null. Pins are never duplicated: kept pins keep
   *  their hand-written id, new pins are generated alongside. */
  catalogueId: string | null;
  conflict: string | null;
  /** Printed card text — always null: © Rockstar, no licence to bundle. */
  printedText: null;
  /** Artwork — always null until a licensed source exists or the
   *  player supplies their own photo. */
  artwork: { front: null; back: null };
}

export const CARD_CHECKLIST_ITEMS: CardChecklistItem[] = [
  {
    "id": "card-checklist:vice-city-flamingos:angel-cienfuegos:light-blue",
    "person": "Angel Cienfuegos",
    "variant": "Light Blue",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "light blue"
    },
    "placement": "pinned",
    "spotDescription": "Microwave at Xero on Omega Pkwy, Buckskin Swamp.",
    "areaLead": "Buckskin Swamp",
    "pickups": [
      {
        "areaLead": "Buckskin Swamp",
        "direction": "· Xero, Omega Pkwy · microwave",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-025",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:angel-cienfuegos:pink",
    "person": "Angel Cienfuegos",
    "variant": "pink",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "Restroom fence on the south beach, Abismo Key.",
    "areaLead": "Abismo Key",
    "pickups": [
      {
        "areaLead": "Abismo Key",
        "direction": "· South beach · restroom fence",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-002",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:angel-cienfuegos:silver",
    "person": "Angel Cienfuegos",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Garage of a house on Grace Ave, Belville.",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· Grace Ave · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-020",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:bill-norton:standard",
    "person": "Bill Norton",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Balcony on SW 3rd Ave, Southside.",
    "areaLead": "Southside",
    "pickups": [
      {
        "areaLead": "Southside",
        "direction": "· SW 3rd Ave · balcony",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-001",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:charlie-spears:standard",
    "person": "Charlie Spears",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Refrigerator on Northbrook Dr, Little Cuba; second reported pickup in a box on a wooden porch, Key Lento.",
    "areaLead": "Little Cuba",
    "pickups": [
      {
        "areaLead": "Little Cuba",
        "direction": "· Northbrook Dr · refrigerator A separate PS5 capture places Charlie Spears in Key Lento, in a box on a wooden porch. This second pickup has a single source. Pickup, map and card front on GTADB",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-023",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:elias-delgado:light-blue",
    "person": "Elias Delgado",
    "variant": "Light Blue",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "light blue"
    },
    "placement": "pinned",
    "spotDescription": "Shack beside the bridge on the Emerald River, Emerald Springs.",
    "areaLead": "Emerald Springs",
    "pickups": [
      {
        "areaLead": "Emerald Springs",
        "direction": "· Emerald River · shack beside bridge",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-021",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:elias-delgado:pink",
    "person": "Elias Delgado",
    "variant": "pink",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "Sofa on Spirea Ln, Ocean Beach.",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Spirea Ln · sofa",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-026",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:elias-delgado:silver",
    "person": "Elias Delgado",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Garage of a house on Beaumont Ave, Watson Bay.",
    "areaLead": "Watson Bay",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Beaumont Ave · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-007",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:harold-toye:light-blue",
    "person": "Harold Toye",
    "variant": "Light Blue",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "light blue"
    },
    "placement": "pinned",
    "spotDescription": "Chair on SW 8th St, Peacock Bay.",
    "areaLead": "Peacock Bay",
    "pickups": [
      {
        "areaLead": "Peacock Bay",
        "direction": "· SW 8th St · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-028",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:harold-toye:pink",
    "person": "Harold Toye",
    "variant": "pink",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "Garage of a house on Flamingo Pkwy, Waning Sands.",
    "areaLead": "Waning Sands",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· Flamingo Pkwy · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-018",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:harold-toye:silver",
    "person": "Harold Toye",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "House on SR-45, Grayson.",
    "areaLead": "Grayson",
    "pickups": [
      {
        "areaLead": "Grayson",
        "direction": "· SR-45 · house",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-010",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:jude-flores:standard",
    "person": "Jude Flores",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "area-known",
    "spotDescription": "Terrace on Sunset Dr, Key Lento.",
    "areaLead": "Key Lento",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· Sunset Dr · terrace",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:julian-cruz:bronze",
    "person": "Julian Cruz",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Bookshelf on Gellhorn Ave, Port Gellhorn.",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Gellhorn Ave · bookshelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-004",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:julian-cruz:gold",
    "person": "Julian Cruz",
    "variant": "gold",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Desk with a pinned board in the small office north side of the building south of Yasmani's shop, Northbrook Dr, Little Cuba.",
    "areaLead": "Little Cuba",
    "pickups": [
      {
        "areaLead": "Little Cuba",
        "direction": "· Northbrook Dr · desk Area cross-checked Enter the building south of Yasmani’s shop. Follow the long hallway to the small office on its north side. The card is pinned to the board. Map at 0:08 · Board at 0:37 · Front at 0:43 · Back at 0:47",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-015",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:julian-cruz:silver",
    "person": "Julian Cruz",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Shop on Sweetbay Rd, Watson Bay.",
    "areaLead": "Watson Bay",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Sweetbay Rd · shop",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-029",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:julian-hall:standard",
    "person": "Julian Hall",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Microwave at RON on Omega Pkwy, Balsero.",
    "areaLead": "Balsero",
    "pickups": [
      {
        "areaLead": "Balsero",
        "direction": "· RON, Omega Pkwy · microwave",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-032",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:mateo-caballero:bronze",
    "person": "Mateo Caballero",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Batting cage at Dino Golf Challenge, Frogswater.",
    "areaLead": "Frogswater",
    "pickups": [
      {
        "areaLead": "Frogswater",
        "direction": "· Dino Golf Challenge · batting cage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-013",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:mateo-caballero:gold",
    "person": "Mateo Caballero",
    "variant": "gold",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Bird's nest on the Watson Bay water tower.",
    "areaLead": "Watson Bay",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Water tower · bird’s nest",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L544",
        "hostName": "Watson Bay Water Tower"
      }
    ],
    "hostId": "L544",
    "catalogueId": "card:mateo-caballero-gold",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:mateo-caballero:silver",
    "person": "Mateo Caballero",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Bedroom of the house immediately north of Zenon's Pawn Shop, NW 11th Pl, La Perle.",
    "areaLead": "La Perle",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· NW 11th Pl · bedroom Area cross-checked In La Perle, start at Zenon’s Pawn Shop. Enter the house immediately north of the shop and search the bedroom.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-016",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:sammy-woodsworth:standard",
    "person": "Sammy Woodsworth",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Garage of a house on Glenwood Ave, Port Gellhorn.",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Glenwood Ave · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-008",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:thunder-lee:standard",
    "person": "Thunder Lee",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Baseball field on Grace Ave, Belville.",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· Grace Ave · baseball field",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-024",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:ulysses-whitlock:bronze",
    "person": "Ulysses Whitlock",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Noticeboard between Nola and Oscar's Seafood, Beacon Cir, Capri.",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Beacon Cir · noticeboard between Nola and Oscar’s Seafood",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-011",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:ulysses-whitlock:gold",
    "person": "Ulysses Whitlock",
    "variant": "gold",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Radio antenna at the Crystal baseball field, Ambrosia.",
    "areaLead": "Ambrosia",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Crystal baseball field · radio antenna",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-flamingos-019",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:ulysses-whitlock:silver",
    "person": "Ulysses Whitlock",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Chair at Penny Haus, Tequesta.",
    "areaLead": "Tequesta",
    "pickups": [
      {
        "areaLead": "Tequesta",
        "direction": "· Penny Haus · chair Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L233",
        "hostName": "Penny Haus"
      }
    ],
    "hostId": "L233",
    "catalogueId": "card:ulysses-whitlock",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:andre-stevenson:standard",
    "person": "Andre Stevenson",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Mannequin at Baller World, Waning Sands.",
    "areaLead": "Waning Sands",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· Baller World · mannequin",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-020",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:antoine-bello:standard",
    "person": "Antoine Bello",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Basketball court on I-97, Salton.",
    "areaLead": "Salton",
    "pickups": [
      {
        "areaLead": "Salton",
        "direction": "· I-97 · basketball court",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-010",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:beck-r-heffer:orange",
    "person": "Beck R. Heffer",
    "variant": "orange",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "orange"
    },
    "placement": "pinned",
    "spotDescription": "Desk on I-404, Port Gellhorn.",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· I-404 · desk",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-017",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:beck-r-heffer:silver",
    "person": "Beck R. Heffer",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "Tower on Palmetto Ave, Hamlet.",
    "areaLead": "Hamlet",
    "pickups": [
      {
        "areaLead": "Hamlet",
        "direction": "· Palmetto Ave · tower",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:beck-r-heffer:teal",
    "person": "Beck R. Heffer",
    "variant": "teal",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "teal"
    },
    "placement": "pinned",
    "spotDescription": "West bench at Courthouse station, Downtown.",
    "areaLead": "Downtown",
    "pickups": [
      {
        "areaLead": "Downtown",
        "direction": "· Courthouse station · west bench",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-018",
    "conflict": "Area conflict: lorenzone says Downtown, GTADB L551 J.C. Anglin United States Courthouse is in Crosstown — not pinned per the area-agreement rule.",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:branko-roncevic:standard",
    "person": "Branko Roncevic",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Bus stop on NW 9th Ave, La Perle.",
    "areaLead": "La Perle",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· NW 9th Ave · bus stop",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-019",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:bryson-powers:standard",
    "person": "Bryson Powers",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Lifeguard hut on the south beach, Washington Beach (kept host: Starlet Motel).",
    "areaLead": "Washington Beach",
    "pickups": [
      {
        "areaLead": "Washington Beach",
        "direction": "· South beach · lifeguard hut",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": "L304",
    "catalogueId": "card:bryson-powers",
    "conflict": "Conflict: lorenzone's direction for this slot names a lifeguard hut on the south beach, Washington Beach — not the Starlet Motel, which GTADB places in Kelly County (Historic Route 628). Existing pin kept per the already-pinned rule; the mismatch is recorded, not resolved. Open GTA 6 Map import — Two Open GTA 6 Map records claim this slot (card-vice-city-narcos-028, card-vice-city-narcos-029) — held for arbitration; host position kept.",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:carl-kasey:standard",
    "person": "Carl Kasey",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Basketball court at Key Lento Public Park, by the bench and bag on the ground.",
    "areaLead": "Key Lento",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· Key Lento Public Park · basketball court Walk along the court fence and look on the ground by the bench and bag. Pickup, map and card front on GTADB",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-090",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:christoph-schulz:standard",
    "person": "Christoph Schulz",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Shelf inside Sahara Arena, Downtown.",
    "areaLead": "Downtown",
    "pickups": [
      {
        "areaLead": "Downtown",
        "direction": "· Sahara Arena · shelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-014",
    "conflict": "Area conflict: lorenzone says Downtown, GTADB L187 Sahara Arena is in Shoreline — not pinned per the area-agreement rule.",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:dylan-ezequiel-mack-jr:bronze",
    "person": "Dylan Ezequiel Mack Jr.",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Basketball hoop inside Sahara Arena, Downtown.",
    "areaLead": "Downtown",
    "pickups": [
      {
        "areaLead": "Downtown",
        "direction": "· Sahara Arena · basketball hoop",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-021",
    "conflict": "Area conflict: lorenzone says Downtown, GTADB L187 Sahara Arena is in Shoreline — not pinned per the area-agreement rule.",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:dylan-ezequiel-mack-jr:gold",
    "person": "Dylan Ezequiel Mack Jr.",
    "variant": "gold",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Upper roof of the Amphitrite building, Washington Beach.",
    "areaLead": "Washington Beach",
    "pickups": [
      {
        "areaLead": "Washington Beach",
        "direction": "· Amphitrite building · upper roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-022",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:dylan-ezequiel-mack-jr:silver",
    "person": "Dylan Ezequiel Mack Jr.",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "House on Azalea St, Capri.",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Azalea St · house",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:kyle-lewicki:orange",
    "person": "Kyle Lewicki",
    "variant": "orange",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "orange"
    },
    "placement": "pinned",
    "spotDescription": "Table on West Mariana Ave, Capri.",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· West Mariana Ave · table",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-023",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:kyle-lewicki:silver",
    "person": "Kyle Lewicki",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Basketball court on Washburn Ave, Port Gellhorn.",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Washburn Ave · basketball court",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-003",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:kyle-lewicki:teal",
    "person": "Kyle Lewicki",
    "variant": "teal",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "teal"
    },
    "placement": "pinned",
    "spotDescription": "Showers at Dynamix Fitness, Bayside (existing pin spot wording: bench in the rear corridor).",
    "areaLead": "Bayside",
    "pickups": [
      {
        "areaLead": "Bayside",
        "direction": "· Dynamix Fitness · showers PowerPyx agrees on the name and place. Colour still needs checking.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": "Dynamix Fitness"
      }
    ],
    "hostId": null,
    "catalogueId": "card:kyle-lewicky",
    "conflict": "Spelling correction (no rename made): existing pin title spells the person 'Kyle Lewicky'; lorenzone, six.mics.dev and PowerPyx spell it 'Kyle Lewicki'. Also spot wording differs: existing pin says 'bench in the rear corridor', lorenzone says 'showers' — same host, pin kept.",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:leroy-rook:bronze",
    "person": "Leroy Rook",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Safe at Royal Bay Marina, Watson Bay.",
    "areaLead": "Watson Bay",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Royal Bay Marina · safe",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-024",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:leroy-rook:gold",
    "person": "Leroy Rook",
    "variant": "gold",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Safe on Harmony Dr, Belville.",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· Harmony Dr · safe",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-012",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:leroy-rook:silver",
    "person": "Leroy Rook",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Safe in the back office of the red warehouse by the three rectangular ponds, Calderone Ave, Southern Vice-Dale County.",
    "areaLead": "Southern Vice-Dale County",
    "pickups": [
      {
        "areaLead": "Southern Vice-Dale County",
        "direction": "· Calderone Ave · safe Near Hamlet, find the three rectangular ponds and enter the red warehouse. The safe is in the back office. Map at 0:15 · Safe at 0:20 · Front at 0:22 · Back at 0:24",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-002",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:nicky-mcvee:bronze",
    "person": "Nicky McVee",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Chair on SW 9th St, Peacock Bay.",
    "areaLead": "Peacock Bay",
    "pickups": [
      {
        "areaLead": "Peacock Bay",
        "direction": "· SW 9th St · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-025",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:nicky-mcvee:gold",
    "person": "Nicky McVee",
    "variant": "gold",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Basketball court on Harborside Ave, Ocean Beach.",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Harborside Ave · basketball court",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-006",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:nicky-mcvee:silver",
    "person": "Nicky McVee",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Refrigerator on Seabell Ave, Watson Bay.",
    "areaLead": "Watson Bay",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Seabell Ave · refrigerator",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-015",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:otis-adams:orange",
    "person": "Otis Adams",
    "variant": "orange",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "orange"
    },
    "placement": "pinned",
    "spotDescription": "Balcony on Bonita Ct, Washington Beach.",
    "areaLead": "Washington Beach",
    "pickups": [
      {
        "areaLead": "Washington Beach",
        "direction": "· Bonita Ct · balcony",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-026",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:otis-adams:silver",
    "person": "Otis Adams",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Locker 13 at the CBA Independent construction site, Downtown.",
    "areaLead": "Downtown",
    "pickups": [
      {
        "areaLead": "Downtown",
        "direction": "· CBA Independent construction site · locker 13",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-004",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-narcos:otis-adams:teal",
    "person": "Otis Adams",
    "variant": "teal",
    "variantAlias": null,
    "setId": "vice-city-narcos",
    "setName": "Vice City Narcos",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "teal"
    },
    "placement": "pinned",
    "spotDescription": "Black chair in the central terminal, VCIA.",
    "areaLead": "VCIA",
    "pickups": [
      {
        "areaLead": "VCIA",
        "direction": "· Central terminal · black chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-narcos-027",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:ali-zeidan:standard",
    "person": "Ali Zeidan",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "House on NW 12th St, La Perle.",
    "areaLead": "La Perle",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· NW 12th St · house",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-manatees-012",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:anthony-ross:dusty-pink",
    "person": "Anthony Ross",
    "variant": "Dusty Pink",
    "variantAlias": "dusty rose",
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "dusty pink"
    },
    "placement": "pinned",
    "spotDescription": "Garage of a house on Neptune Cir, Vespucci Island.",
    "areaLead": "Vespucci Island",
    "pickups": [
      {
        "areaLead": "Vespucci Island",
        "direction": "· Neptune Cir · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-manatees-015",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:anthony-ross:green",
    "person": "Anthony Ross",
    "variant": "green",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "green"
    },
    "placement": "area-known",
    "spotDescription": "Restroom at the Western marsh outpost, Pelican Valley.",
    "areaLead": "Pelican Valley",
    "pickups": [
      {
        "areaLead": "Pelican Valley",
        "direction": "· Western marsh outpost · restroom",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:anthony-ross:silver",
    "person": "Anthony Ross",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "Refrigerator on NE 10th St, Crosstown.",
    "areaLead": "Crosstown",
    "pickups": [
      {
        "areaLead": "Crosstown",
        "direction": "· NE 10th St · refrigerator",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:delord-nathan-alford:standard",
    "person": "Delord Nathan Alford",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Shelf on SR-27, Belville.",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· SR-27 · shelf Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-manatees-013",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:dominic-brizzolato:bronze",
    "person": "Dominic Brizzolato",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Safe on Indigo St, Ocean Beach.",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Indigo St · safe",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-manatees-009",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:dominic-brizzolato:gold",
    "person": "Dominic Brizzolato",
    "variant": "gold",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Turtle sign at Vice City Oceanarium, Catalan Key.",
    "areaLead": "Catalan Key",
    "pickups": [
      {
        "areaLead": "Catalan Key",
        "direction": "· Vice City Oceanarium · turtle sign",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-manatees-028",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:dominic-brizzolato:silver",
    "person": "Dominic Brizzolato",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Construction office on the Nehrling River, Northern Mariana County.",
    "areaLead": "Northern Mariana County",
    "pickups": [
      {
        "areaLead": "Northern Mariana County",
        "direction": "· Nehrling River · construction office",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-manatees-023",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:georgie-macklerath:bronze",
    "person": "Georgie Macklerath",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Deck of the house on the pier, northeastern bay, Corsair Key.",
    "areaLead": "Corsair Key",
    "pickups": [
      {
        "areaLead": "Corsair Key",
        "direction": "· Northeastern bay · deck of the house on the pier",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-manatees-003",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:georgie-macklerath:gold",
    "person": "Georgie Macklerath",
    "variant": "gold",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Garage of the light blue house west of town, Ambrosia.",
    "areaLead": "Ambrosia",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Light blue house west of town · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-manatees-008",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:georgie-macklerath:silver",
    "person": "Georgie Macklerath",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Refrigerator on Surfside Dr, Key Lento.",
    "areaLead": "Key Lento",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· Surfside Dr · refrigerator",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-091",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:gouwan-marcus:standard",
    "person": "Gouwan Marcus",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Water tank at Capri City Jackals stadium, Capri.",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Capri City Jackals stadium · water tank",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L1064",
        "hostName": "Capri City Jackals Stadium"
      }
    ],
    "hostId": "L1064",
    "catalogueId": "card:gouwan-marcus",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:jacob-schneeman:standard",
    "person": "Jacob Schneeman",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Parking area at Fleeca Field, Rockridge.",
    "areaLead": "Rockridge",
    "pickups": [
      {
        "areaLead": "Rockridge",
        "direction": "· Fleeca Field · parking area",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L196",
        "hostName": "Fleeca Field"
      }
    ],
    "hostId": "L196",
    "catalogueId": "card:jacob-schneeman",
    "conflict": "Open GTA 6 Map import — Open GTA 6 Map record card-vice-city-manatees-026 sits 186.3u from this host pin — host position kept; the fbrito position was not imported.",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:john-morgan:dusty-pink",
    "person": "John Morgan",
    "variant": "Dusty Pink",
    "variantAlias": "dusty rose",
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "dusty pink"
    },
    "placement": "pinned",
    "spotDescription": "Garage of a house on Rialto Cswy, Casanova Island.",
    "areaLead": "Casanova Island",
    "pickups": [
      {
        "areaLead": "Casanova Island",
        "direction": "· Rialto Cswy · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-manatees-027",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:john-morgan:green",
    "person": "John Morgan",
    "variant": "green",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "green"
    },
    "placement": "pinned",
    "spotDescription": "Garage of a house on Rialto Cswy, Casanova Island.",
    "areaLead": "Casanova Island",
    "pickups": [
      {
        "areaLead": "Casanova Island",
        "direction": "· Rialto Cswy · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-manatees-021",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:john-morgan:silver",
    "person": "John Morgan",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Terrace on Mamey Cir, Waning Sands.",
    "areaLead": "Waning Sands",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· Mamey Cir · terrace",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-manatees-029",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:tusi-taufua:dusty-pink",
    "person": "Tusi Taufua",
    "variant": "Dusty Pink",
    "variantAlias": "dusty rose",
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "dusty pink"
    },
    "placement": "pinned",
    "spotDescription": "Bookshelf at the Grand Majestic Aparthotel, Tequesta.",
    "areaLead": "Tequesta",
    "pickups": [
      {
        "areaLead": "Tequesta",
        "direction": "· Grand Majestic Aparthotel · bookshelf Name disputed. PowerPyx records “Tusi Taufua” at the Grand Majestic.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L240",
        "hostName": "Grand Majestic"
      }
    ],
    "hostId": "L240",
    "catalogueId": "card:tusi-taufua-dusty-pink",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:tusi-taufua:green",
    "person": "Tusi Taufua",
    "variant": "green",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "green"
    },
    "placement": "area-known",
    "spotDescription": "Shelf on SR-45, Grayson.",
    "areaLead": "Grayson",
    "pickups": [
      {
        "areaLead": "Grayson",
        "direction": "· SR-45 · shelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:tusi-taufua:silver",
    "person": "Tusi Taufua",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Noticeboard at Overkeel Boatyard & Marina, Eastern Lummox County (kept host: Grand Majestic).",
    "areaLead": "Eastern Lummox County",
    "pickups": [
      {
        "areaLead": "Eastern Lummox County",
        "direction": "· Overkeel Boatyard & Marina · noticeboard",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": "L240",
    "catalogueId": "card:tusi-taufua",
    "conflict": "Conflict: lorenzone's direction for this (silver) slot names Overkeel Boatyard & Marina in Eastern Lummox County — not the Grand Majestic in Tequesta. GTADB L2598 'Overkeel, Lummox County' exists as a possible host for that direction, but the slot is already pinned so it was not re-matched; existing pin kept per the already-pinned rule. (The 'Grand Majestic Aparthotel · bookshelf' direction belongs to the dusty-pink Tusi Taufua slot, which is pinned to L240 separately.) Open GTA 6 Map import — host-pinned; cited fbrito record card-vice-city-manatees-016 sits 8936u from the host pin — host wins, disagreement recorded",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:maleek-rivers:bronze",
    "person": "Maleek Rivers",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "area-known",
    "spotDescription": "Desk on Reservoir St, Ambrosia.",
    "areaLead": "Ambrosia",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Reservoir St · desk",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:maleek-rivers:gold",
    "person": "Maleek Rivers",
    "variant": "gold",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "area-known",
    "spotDescription": "Safe in the southern beachside storage unit, Ocean Beach.",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Southern beachside storage unit · safe",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:maleek-rivers:silver",
    "person": "Maleek Rivers",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Antenna on Reservoir St, Ambrosia.",
    "areaLead": "Ambrosia",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Reservoir St · antenna",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-manatees-022",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:manniken-stills:standard",
    "person": "Manniken Stills",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Pay 'n' Spray construction site on Riverbend Rd, Western Vice-Dale County.",
    "areaLead": "Western Vice-Dale County",
    "pickups": [
      {
        "areaLead": "Western Vice-Dale County",
        "direction": "· Riverbend Rd · Pay ’n’ Spray construction site",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-manatees-025",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:reggie-pierce:standard",
    "person": "Reggie Pierce",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Bench at Fleeca Field, Rockridge (kept host: Gellhorn Drive-In Theatre).",
    "areaLead": "Rockridge",
    "pickups": [
      {
        "areaLead": "Rockridge",
        "direction": "· Fleeca Field · bench",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": "L3658",
    "catalogueId": "card:reggie-pierce",
    "conflict": "Conflict: lorenzone's direction for this slot names Fleeca Field (bench) in Rockridge — not the Gellhorn Drive-In Theatre in Port Gellhorn. Existing pin kept per the already-pinned rule; the mismatch is recorded, not resolved. Open GTA 6 Map import — host-pinned; cited fbrito record card-vice-city-manatees-014 sits 5766u from the host pin — host wins, disagreement recorded",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:anne-florence:dusty-pink",
    "person": "Anne Florence",
    "variant": "Dusty Pink",
    "variantAlias": "dusty rose",
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "dusty pink"
    },
    "placement": "pinned",
    "spotDescription": "Boat at Shoreline Market, Downtown.",
    "areaLead": "Downtown",
    "pickups": [
      {
        "areaLead": "Downtown",
        "direction": "· Shoreline Market · boat",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-025",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:anne-florence:silver",
    "person": "Anne Florence",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "Rescue boat on the east beach, Gloriana Key.",
    "areaLead": "Gloriana Key",
    "pickups": [
      {
        "areaLead": "Gloriana Key",
        "direction": "· East beach · rescue boat",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:anne-florence:teal",
    "person": "Anne Florence",
    "variant": "teal",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "teal"
    },
    "placement": "pinned",
    "spotDescription": "Women's locker room in Zenith gym, Downtown.",
    "areaLead": "Downtown",
    "pickups": [
      {
        "areaLead": "Downtown",
        "direction": "· Zenith gym · women’s locker room",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-011",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:ayokunumi-kasimu:standard",
    "person": "Ayokunumi Kasimu",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "area-known",
    "spotDescription": "Container at Roval Jewelry, Decor District.",
    "areaLead": "Decor District",
    "pickups": [
      {
        "areaLead": "Decor District",
        "direction": "· Roval Jewelry · container Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      },
      {
        "areaLead": "Port Gellhorn",
        "direction": "· West-side field · top of east bleachers",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": "Held from the Open GTA 6 Map import: bucket D, gtatown does not show it",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:badge:bronze",
    "person": "Badge",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Bench at The Place, Tequesta.",
    "areaLead": "Tequesta",
    "pickups": [
      {
        "areaLead": "Tequesta",
        "direction": "· The Place · bench",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-019",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:badge:dusty-pink",
    "person": "Badge",
    "variant": "Dusty Pink",
    "variantAlias": "dusty rose",
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "dusty pink"
    },
    "placement": "pinned",
    "spotDescription": "Table on NW 25th Pl, Balsero.",
    "areaLead": "Balsero",
    "pickups": [
      {
        "areaLead": "Balsero",
        "direction": "· NW 25th Pl · table",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-028",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:badge:gold",
    "person": "Badge",
    "variant": "gold",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Bookcase in a cabin at the campground west of Lake Tallaloko, Tallaloko.",
    "areaLead": "Tallaloko",
    "pickups": [
      {
        "areaLead": "Tallaloko",
        "direction": "· Campground west of Lake Tallaloko · cabin bookcase",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-023",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:badge:silver",
    "person": "Badge",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "Building with ladder on the summit trail, Mount Kalaga National Park.",
    "areaLead": "Mount Kalaga National Park",
    "pickups": [
      {
        "areaLead": "Mount Kalaga National Park",
        "direction": "· Summit trail · building with ladder Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:badge:teal",
    "person": "Badge",
    "variant": "teal",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "teal"
    },
    "placement": "area-known",
    "spotDescription": "Bookshelf on NW 10th Ave, La Perle.",
    "areaLead": "La Perle",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· NW 10th Ave · bookshelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:ellie-burke:dusty-pink",
    "person": "Ellie Burke",
    "variant": "Dusty Pink",
    "variantAlias": "dusty rose",
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "dusty pink"
    },
    "placement": "pinned",
    "spotDescription": "Terrace on Caledonia Blvd, Belville.",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· Caledonia Blvd · terrace",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-026",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:ellie-burke:silver",
    "person": "Ellie Burke",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "Bookshelf on Maple Ln, Ambrosia.",
    "areaLead": "Ambrosia",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Maple Ln · bookshelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:ellie-burke:teal",
    "person": "Ellie Burke",
    "variant": "teal",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "teal"
    },
    "placement": "area-known",
    "spotDescription": "Refrigerator on NW 4th Ave, Little Cuba.",
    "areaLead": "Little Cuba",
    "pickups": [
      {
        "areaLead": "Little Cuba",
        "direction": "· NW 4th Ave · refrigerator",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:emma-croydon:dusty-pink",
    "person": "Emma Croydon",
    "variant": "Dusty Pink",
    "variantAlias": "dusty rose",
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "dusty pink"
    },
    "placement": "area-known",
    "spotDescription": "Bench on Indigo St, Ocean Beach.",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Indigo St · bench",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:emma-croydon:gold",
    "person": "Emma Croydon",
    "variant": "gold",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Roof on NW 6th St, Downtown.",
    "areaLead": "Downtown",
    "pickups": [
      {
        "areaLead": "Downtown",
        "direction": "· NW 6th St · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-022",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:emma-croydon:silver",
    "person": "Emma Croydon",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Garage on Mamey Cir, Waning Sands.",
    "areaLead": "Waning Sands",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· Mamey Cir · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-014",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:gerry-northgate:standard",
    "person": "Gerry Northgate",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Lifeguard station on the south beach, Ocean Beach.",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· South beach · lifeguard station",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-017",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:ian-harris:dusty-pink",
    "person": "Ian Harris",
    "variant": "Dusty Pink",
    "variantAlias": "dusty rose",
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "dusty pink"
    },
    "placement": "area-known",
    "spotDescription": "Desk on Cabega St, Ocean Beach.",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Cabega St · desk Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:ian-harris:gold",
    "person": "Ian Harris",
    "variant": "gold",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Garage on Delamore Dr, Leaf Links.",
    "areaLead": "Leaf Links",
    "pickups": [
      {
        "areaLead": "Leaf Links",
        "direction": "· Delamore Dr · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-012",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:ian-harris:silver",
    "person": "Ian Harris",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Shelf at the mid-beach lifeguard station, Ocean Beach.",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Mid-beach · lifeguard station shelf Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-018",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:leon-correo:dusty-pink",
    "person": "Leon Correo",
    "variant": "Dusty Pink",
    "variantAlias": "dusty rose",
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "dusty pink"
    },
    "placement": "area-known",
    "spotDescription": "Shelf at Waterfront Suites, Washington Beach.",
    "areaLead": "Washington Beach",
    "pickups": [
      {
        "areaLead": "Washington Beach",
        "direction": "· Waterfront Suites · shelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:leon-correo:gold",
    "person": "Leon Correo",
    "variant": "gold",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "TV stand in a villa on Ravella Dr, Capri.",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Ravella Dr · villa TV stand",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-015",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:leon-correo:silver",
    "person": "Leon Correo",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Bedroom on Emory Ave, Peacock Bay.",
    "areaLead": "Peacock Bay",
    "pickups": [
      {
        "areaLead": "Peacock Bay",
        "direction": "· Emory Ave · bedroom",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-021",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:lupin-juarez:standard",
    "person": "Lupin Juarez",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "TV stand in a trailer opposite The Rusty Anchor, Key Lento.",
    "areaLead": "Key Lento",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· Opposite Rusty Anchor · trailer TV stand Inside the living room, check the wooden sideboard beneath the wall-mounted TV. Pickup, map and card front on GTADB",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-105",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:oskar-wolff:dusty-pink",
    "person": "Oskar Wolff",
    "variant": "Dusty Pink",
    "variantAlias": "dusty rose",
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "dusty pink"
    },
    "placement": "pinned",
    "spotDescription": "Noticeboard in the northern waterfront warehouse, Capri.",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Northern waterfront warehouse · noticeboard",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-020",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:oskar-wolff:silver",
    "person": "Oskar Wolff",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Terrace on Oleander Blvd, Washington Beach (Oldby Island).",
    "areaLead": "Washington Beach (Oldby Island)",
    "pickups": [
      {
        "areaLead": "Washington Beach (Oldby Island)",
        "direction": "· Oleander Blvd · terrace",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-027",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:oskar-wolff:teal",
    "person": "Oskar Wolff",
    "variant": "teal",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "teal"
    },
    "placement": "pinned",
    "spotDescription": "Backyard soccer goal on Caravel Ct, Belville.",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· Caravel Ct · backyard soccer goal",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-029",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:renata-vasquez:dusty-pink",
    "person": "Renata Vasquez",
    "variant": "Dusty Pink",
    "variantAlias": "dusty rose",
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "dusty pink"
    },
    "placement": "pinned",
    "spotDescription": "Roof on NE 19th St, Decor District.",
    "areaLead": "Decor District",
    "pickups": [
      {
        "areaLead": "Decor District",
        "direction": "· NE 19th St · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-007",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:renata-vasquez:silver",
    "person": "Renata Vasquez",
    "variant": "silver",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Grave on Cicada Ave, Bluegrass.",
    "areaLead": "Bluegrass",
    "pickups": [
      {
        "areaLead": "Bluegrass",
        "direction": "· Cicada Ave · grave",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-024",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:renata-vasquez:teal",
    "person": "Renata Vasquez",
    "variant": "teal",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "teal"
    },
    "placement": "pinned",
    "spotDescription": "Chair on Pigeon Plum Rd, Northern Mariana County.",
    "areaLead": "Northern Mariana County",
    "pickups": [
      {
        "areaLead": "Northern Mariana County",
        "direction": "· Pigeon Plum Rd · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-vice-city-club-de-futbol-030",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:sue-prettyman:standard",
    "person": "Sue Prettyman",
    "variant": "standard",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "area-known",
    "spotDescription": "House on SW 13th St, Southside.",
    "areaLead": "Southside",
    "pickups": [
      {
        "areaLead": "Southside",
        "direction": "· SW 13th St · house",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:blake-balls:bronze",
    "person": "Blake Balls",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "area-known",
    "spotDescription": "Rear entrance of a gray house east of Lake Tallaloko, Eastern Lummox County.",
    "areaLead": "Eastern Lummox County",
    "pickups": [
      {
        "areaLead": "Eastern Lummox County",
        "direction": "· East of Lake Tallaloko · gray house rear entrance",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:blake-balls:gold",
    "person": "Blake Balls",
    "variant": "gold",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "area-known",
    "spotDescription": "Bedroom on Maple Ln, Ambrosia.",
    "areaLead": "Ambrosia",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Maple Ln · bedroom",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:blake-balls:silver",
    "person": "Blake Balls",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Garage on Clovis Way, Capri.",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Clovis Way · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-swingers-012",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:christian-delgado:standard",
    "person": "Christian Delgado",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Stacked lockers by the recreation area at the docks, Shoeless Keys.",
    "areaLead": "Shoeless Keys",
    "pickups": [
      {
        "areaLead": "Shoeless Keys",
        "direction": "· Docks · stacked lockers by recreation area",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-swingers-004",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:christian-freeman:deep-red",
    "person": "Christian Freeman",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "Bench at Vice Civic Center, Downtown.",
    "areaLead": "Downtown",
    "pickups": [
      {
        "areaLead": "Downtown",
        "direction": "· Vice Civic Center · bench",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-swingers-022",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:christian-freeman:navy-blue",
    "person": "Christian Freeman",
    "variant": "Navy Blue",
    "variantAlias": "navy",
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "navy blue"
    },
    "placement": "pinned",
    "spotDescription": "Behind the blue building on Longship Dr, Watson Bay.",
    "areaLead": "Watson Bay",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Longship Dr · behind blue building",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-swingers-024",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:christian-freeman:silver",
    "person": "Christian Freeman",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "Walkway on I-404, Port Gellhorn.",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· I-404 · walkway",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:duke-king:deep-red",
    "person": "Duke King",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "Garage on Lakewood Way, Ambrosia.",
    "areaLead": "Ambrosia",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Lakewood Way · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-swingers-010",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:duke-king:navy-blue",
    "person": "Duke King",
    "variant": "Navy Blue",
    "variantAlias": "navy",
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "navy blue"
    },
    "placement": "pinned",
    "spotDescription": "Roof on Palmetto Ave, Hamlet.",
    "areaLead": "Hamlet",
    "pickups": [
      {
        "areaLead": "Hamlet",
        "direction": "· Palmetto Ave · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-swingers-020",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:duke-king:silver",
    "person": "Duke King",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Filing cabinet in the site office at Breakwater quarry, Northern Mariana County.",
    "areaLead": "Northern Mariana County",
    "pickups": [
      {
        "areaLead": "Northern Mariana County",
        "direction": "· Breakwater quarry · site office filing cabinet",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-swingers-026",
    "conflict": "GTADB 'Breakwater' (L1892) is in Capri, not Northern Mariana County - area disagrees; the record is also 'unconfirmed' and no GTADB quarry record exists.",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:garth-buxton:standard",
    "person": "Garth Buxton",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Warehouse at Puff Puff Pass, Belville.",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· Puff Puff Pass · warehouse Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      },
      {
        "areaLead": "Watson Bay",
        "direction": "· Seabell Ave · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-swingers-006",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:ichiro-yamada:bronze",
    "person": "Ichiro Yamada",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "area-known",
    "spotDescription": "Garage on Neptune Cir, Vespucci Island.",
    "areaLead": "Vespucci Island",
    "pickups": [
      {
        "areaLead": "Vespucci Island",
        "direction": "· Neptune Cir · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:ichiro-yamada:gold",
    "person": "Ichiro Yamada",
    "variant": "gold",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "area-known",
    "spotDescription": "Garage on Mamey Cir, Waning Sands.",
    "areaLead": "Waning Sands",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· Mamey Cir · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:ichiro-yamada:silver",
    "person": "Ichiro Yamada",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Baggage room at Terminal E, Port of Vice City.",
    "areaLead": "Port of Vice City",
    "pickups": [
      {
        "areaLead": "Port of Vice City",
        "direction": "· Terminal E · baggage room",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-swingers-013",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:juan-carlos-garcia:standard",
    "person": "Juan Carlos Garcia",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Bus stop on North Vice Ave, Downtown.",
    "areaLead": "Downtown",
    "pickups": [
      {
        "areaLead": "Downtown",
        "direction": "· North Vice Ave · bus stop",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-swingers-023",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:lalo-velasco:bronze",
    "person": "Lalo Velasco",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "area-known",
    "spotDescription": "Dresser in a trailer on Spruce Ln, Ambrosia.",
    "areaLead": "Ambrosia",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Spruce Ln · trailer dresser",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:lalo-velasco:gold",
    "person": "Lalo Velasco",
    "variant": "gold",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Garage on Ravella Dr, Capri.",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Ravella Dr · garage Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-swingers-014",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:lalo-velasco:silver",
    "person": "Lalo Velasco",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Hallway on Shore Dr, Ocean Beach.",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Shore Dr · hallway",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-swingers-025",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:mario-rugama:deep-red",
    "person": "Mario Rugama",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "Chair on Vineyard Dr, Washington Beach (Oldby Island).",
    "areaLead": "Washington Beach (Oldby Island)",
    "pickups": [
      {
        "areaLead": "Washington Beach (Oldby Island)",
        "direction": "· Vineyard Dr · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-swingers-021",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:mario-rugama:navy-blue",
    "person": "Mario Rugama",
    "variant": "Navy Blue",
    "variantAlias": "navy",
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "navy blue"
    },
    "placement": "pinned",
    "spotDescription": "Garage on Caravel Ct, Belville.",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· Caravel Ct · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-swingers-027",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:mario-rugama:silver",
    "person": "Mario Rugama",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "Bench on US-628, Millport.",
    "areaLead": "Millport",
    "pickups": [
      {
        "areaLead": "Millport",
        "direction": "· US-628 · bench",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:ricardo-zamudio:standard",
    "person": "Ricardo Zamudio",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Eastern table at Tisha-Wocka flea market, Balsero.",
    "areaLead": "Balsero",
    "pickups": [
      {
        "areaLead": "Balsero",
        "direction": "· Tisha-Wocka flea market · eastern table",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-swingers-008",
    "conflict": "GTADB 'Tisha-Wocka Flea Market' (L1006) carries area 'Tisha-Wocka', not Balsero - area disagrees; the record also carries a GTADB 'demolished' tag.",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:seo-jun-kim:standard",
    "person": "Seo-Jun Kim",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Bleachers at Hummingbird Park, Ocean Beach.",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Hummingbird Park · bleachers Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-096",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:steven-kendricks:standard",
    "person": "Steven Kendricks",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Tower on Atlantic Ave, Ocean Beach.",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Atlantic Ave · tower",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-swingers-016",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:alexander-avain:bright-orange",
    "person": "Alexander Avain",
    "variant": "Bright Orange",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "bright orange"
    },
    "placement": "pinned",
    "spotDescription": "Sofa on Harborside Ave, Ocean Beach.",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Harborside Ave · sofa",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-027",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:alexander-avain:navy-blue",
    "person": "Alexander Avain",
    "variant": "Navy Blue",
    "variantAlias": "navy",
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "navy blue"
    },
    "placement": "pinned",
    "spotDescription": "Break room inside LTD Gas Station on Cicada Ave, Hamlet.",
    "areaLead": "Hamlet",
    "pickups": [
      {
        "areaLead": "Hamlet",
        "direction": "· LTD, Cicada Ave · break room Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L260",
        "hostName": "LTD Gas Station"
      }
    ],
    "hostId": "L260",
    "catalogueId": "card:alexander-avain-navy-blue",
    "conflict": "Open GTA 6 Map import — host-pinned; cited fbrito record card-liberty-city-penetrators-001 sits 564u from the host pin — host wins, disagreement recorded",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:alexander-avain:silver",
    "person": "Alexander Avain",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Bedroom on Mirimar Dr, Crosstown.",
    "areaLead": "Crosstown",
    "pickups": [
      {
        "areaLead": "Crosstown",
        "direction": "· Mirimar Dr · bedroom Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-016",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:asher-rodriguez:standard",
    "person": "Asher Rodriguez",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Parking area on SW 4th St, Tequesta.",
    "areaLead": "Tequesta",
    "pickups": [
      {
        "areaLead": "Tequesta",
        "direction": "· SW 4th St · parking area",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-028",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:dangelou-miles:standard",
    "person": "D'Angelou Miles",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Sofa on Catalan Blvd, Waning Sands.",
    "areaLead": "Waning Sands",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· Catalan Blvd · sofa",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-022",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:demario-richardson:bronze",
    "person": "Demario Richardson",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Shelf on SW 7th Ave, Salton.",
    "areaLead": "Salton",
    "pickups": [
      {
        "areaLead": "Salton",
        "direction": "· SW 7th Ave · shelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-025",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:demario-richardson:gold",
    "person": "Demario Richardson",
    "variant": "gold",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "area-known",
    "spotDescription": "Shelf on Orchard Ave, Port Gellhorn.",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Orchard Ave · shelf Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:demario-richardson:silver",
    "person": "Demario Richardson",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Chair on Thompson Ave, Ocean Beach.",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Thompson Ave · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-026",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:dimitri-petrov:standard",
    "person": "Dimitri Petrov",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "South basketball bleachers in the northern park, Belville.",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· Northern park · south basketball bleachers",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-018",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:lamont-berry:standard",
    "person": "Lamont Berry",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Refrigerator on Northbrook Dr, Little Cuba.",
    "areaLead": "Little Cuba",
    "pickups": [
      {
        "areaLead": "Little Cuba",
        "direction": "· Northbrook Dr · refrigerator",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-023",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:lev-volkov:bronze",
    "person": "Lev Volkov",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Shelf on NW 9th Ave, La Perle.",
    "areaLead": "La Perle",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· NW 9th Ave · shelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-012",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:lev-volkov:gold",
    "person": "Lev Volkov",
    "variant": "gold",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Basketball court on Delamore Dr, Leaf Links.",
    "areaLead": "Leaf Links",
    "pickups": [
      {
        "areaLead": "Leaf Links",
        "direction": "· Delamore Dr · basketball court",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-017",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:lev-volkov:silver",
    "person": "Lev Volkov",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Garage with gym in a villa on the northwestern peninsula, Capri.",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Northwestern peninsula · villa garage with gym",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-020",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:noah-marcus:bronze",
    "person": "Noah Marcus",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Pool table in the garage of the east coast yellow villa, Vespucci Island.",
    "areaLead": "Vespucci Island",
    "pickups": [
      {
        "areaLead": "Vespucci Island",
        "direction": "· East coast yellow villa · garage pool table",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-009",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:noah-marcus:gold",
    "person": "Noah Marcus",
    "variant": "gold",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "West coast tower on the southern island, Riquezas Keys.",
    "areaLead": "Riquezas Keys",
    "pickups": [
      {
        "areaLead": "Riquezas Keys",
        "direction": "· Southern island · west coast tower Climb to the metal platform and look beside the blue chair. The collection screen identifies the gold variant. Pickup, map and card front on GTADB",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-106",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:noah-marcus:silver",
    "person": "Noah Marcus",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Terrace on Bayside Dr, Tequesta Retreat.",
    "areaLead": "Tequesta Retreat",
    "pickups": [
      {
        "areaLead": "Tequesta Retreat",
        "direction": "· Bayside Dr · terrace",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-013",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:remy-herbert:bright-orange",
    "person": "Remy Herbert",
    "variant": "Bright Orange",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "bright orange"
    },
    "placement": "pinned",
    "spotDescription": "Basketball court at Crastenburg Key Lento Resort, Key Lento.",
    "areaLead": "Key Lento",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· Crastenburg Key Lento Resort · basketball court Behind the resort, check the corner of the court by the bag against the fence. The pickup screen labels this variant “Orange”. Pickup, map and card front on GTADB",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-101",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:remy-herbert:navy-blue",
    "person": "Remy Herbert",
    "variant": "Navy Blue",
    "variantAlias": "navy",
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "navy blue"
    },
    "placement": "pinned",
    "spotDescription": "Garage on Clovis Way, Capri.",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Clovis Way · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-010",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:remy-herbert:silver",
    "person": "Remy Herbert",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Table on NW 3rd Ave, Little Cuba.",
    "areaLead": "Little Cuba",
    "pickups": [
      {
        "areaLead": "Little Cuba",
        "direction": "· NW 3rd Ave · table Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-019",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:rion-yapa:bright-orange",
    "person": "Rion Yapa",
    "variant": "Bright Orange",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "bright orange"
    },
    "placement": "pinned",
    "spotDescription": "Kiosk at the southern tip of the eastern island, Waning Sands.",
    "areaLead": "Waning Sands",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· Eastern island · kiosk at southern tip",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-024",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:rion-yapa:navy-blue",
    "person": "Rion Yapa",
    "variant": "Navy Blue",
    "variantAlias": "navy",
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "navy blue"
    },
    "placement": "pinned",
    "spotDescription": "Chair at St. Vitus Medical Center, Penmarch Isle.",
    "areaLead": "Penmarch Isle",
    "pickups": [
      {
        "areaLead": "Penmarch Isle",
        "direction": "· St. Vitus Medical Center · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-029",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:rion-yapa:silver",
    "person": "Rion Yapa",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "Shelf on I-97, Crosstown.",
    "areaLead": "Crosstown",
    "pickups": [
      {
        "areaLead": "Crosstown",
        "direction": "· I-97 · shelf Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:taylor-blanc:standard",
    "person": "Taylor Blanc",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Desk on SW 3rd Ave, Southside.",
    "areaLead": "Southside",
    "pickups": [
      {
        "areaLead": "Southside",
        "direction": "· SW 3rd Ave · desk",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-006",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:wenyen-deng:standard",
    "person": "Wenyen Deng",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Dispenser on Longship Dr, Watson Bay.",
    "areaLead": "Watson Bay",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Longship Dr · dispenser",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-penetrators-021",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:alvin-orlowski:standard",
    "person": "Alvin Orlowski",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Mirimar Dr bookshelf",
    "areaLead": "La Perle",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· Mirimar Dr · bookshelf Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-012",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:anthony-poke-ii:deep-red",
    "person": "Anthony Poke II",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "Roof on Vickery Dr, Washington Beach (Oldby Island)",
    "areaLead": "Washington Beach (Oldby Island)",
    "pickups": [
      {
        "areaLead": "Washington Beach (Oldby Island)",
        "direction": "· Vickery Dr · roof Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": "L1869",
    "catalogueId": "card:anthony-poke-ii",
    "conflict": "lorenzone places this variant at 'Vickery Dr · roof' with no host building named, while the gtadb.net guide puts it in the Ajax Gym upper hallway; existing pin (L1869) kept, no second pin created",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:anthony-poke-ii:navy-blue",
    "person": "Anthony Poke II",
    "variant": "Navy Blue",
    "variantAlias": "navy",
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "navy blue"
    },
    "placement": "pinned",
    "spotDescription": "Emory Ave steps of villa with U-shaped drive",
    "areaLead": "Peacock Bay",
    "pickups": [
      {
        "areaLead": "Peacock Bay",
        "direction": "· Emory Ave · steps of villa with U-shaped drive",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-023",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:anthony-poke-ii:silver",
    "person": "Anthony Poke II",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Northeast beach lifeguard station",
    "areaLead": "Washington Beach",
    "pickups": [
      {
        "areaLead": "Washington Beach",
        "direction": "· Northeast beach · lifeguard station",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-018",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:armando-ibarra-jr:standard",
    "person": "Armando Ibarra Jr.",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "area-known",
    "spotDescription": "South beach lifeguard station desk",
    "areaLead": "Gloriana Key",
    "pickups": [
      {
        "areaLead": "Gloriana Key",
        "direction": "· South beach · lifeguard station desk",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:atonga-alaalatoa:standard",
    "person": "Atonga Alaalatoa",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Discovery St bleachers",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· Discovery St · bleachers",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-015",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:bryan-barnett:bronze",
    "person": "B'ryan Barnett",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "NE 4th Ave chair",
    "areaLead": "Crosstown",
    "pickups": [
      {
        "areaLead": "Crosstown",
        "direction": "· NE 4th Ave · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-022",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:bryan-barnett:gold",
    "person": "B'ryan Barnett",
    "variant": "gold",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "NW 9th St billboard",
    "areaLead": "Rockridge",
    "pickups": [
      {
        "areaLead": "Rockridge",
        "direction": "· NW 9th St · billboard",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-020",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:bryan-barnett:silver",
    "person": "B'ryan Barnett",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Loggerhead Rd parking area",
    "areaLead": "Bobcat Key",
    "pickups": [
      {
        "areaLead": "Bobcat Key",
        "direction": "· Loggerhead Rd · parking area",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-026",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:bruce-goosen:standard",
    "person": "Bruce Goosen",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Gulf St fire station",
    "areaLead": "Port of Vice City",
    "pickups": [
      {
        "areaLead": "Port of Vice City",
        "direction": "· Gulf St · fire station",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-017",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:christian-yee:deep-red",
    "person": "Christian Yee",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "Emory Ave 247 store noticeboard",
    "areaLead": "Hamlet",
    "pickups": [
      {
        "areaLead": "Hamlet",
        "direction": "· Emory Ave 247 store · noticeboard",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-011",
    "conflict": "lorenzone names a '247 store' on Emory Ave, Hamlet; the only 247 Supermarket record is L1670 in Crosstown — area disagrees, not pinned",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:christian-yee:navy-blue",
    "person": "Christian Yee",
    "variant": "Navy Blue",
    "variantAlias": "navy",
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "navy blue"
    },
    "placement": "pinned",
    "spotDescription": "Spirea Ln stairs",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Spirea Ln · stairs",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-027",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:christian-yee:silver",
    "person": "Christian Yee",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "US-183 football field",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· US-183 · football field",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-025",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:dartanyon-pearson:standard",
    "person": "Dartanyon Pearson",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Shelf / wooden cabinet beside a bookcase in the upstairs room, Sunset Dr, Key Lento",
    "areaLead": "Key Lento",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· Sunset Dr · shelf The PS5 capture shows the wooden cabinet beside a bookcase in the upstairs room. Pickup, map and card front on GTADB",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-103",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:james-bowery:deep-red",
    "person": "James Bowery",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "El Joven Blvd bench",
    "areaLead": "Southside",
    "pickups": [
      {
        "areaLead": "Southside",
        "direction": "· El Joven Blvd · bench",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-021",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:james-bowery:navy-blue",
    "person": "James Bowery",
    "variant": "Navy Blue",
    "variantAlias": "navy",
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "navy blue"
    },
    "placement": "pinned",
    "spotDescription": "Mamey Cir terrace",
    "areaLead": "Waning Sands",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· Mamey Cir · terrace",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-024",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:james-bowery:silver",
    "person": "James Bowery",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Shore Ct chair",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Shore Ct · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-019",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:robbie-stine:bronze",
    "person": "Robbie Stine",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Ocean Sound Rd garage",
    "areaLead": "Catalan Key",
    "pickups": [
      {
        "areaLead": "Catalan Key",
        "direction": "· Ocean Sound Rd · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-013",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:robbie-stine:gold",
    "person": "Robbie Stine",
    "variant": "gold",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "I-97 safe",
    "areaLead": "Crosstown",
    "pickups": [
      {
        "areaLead": "Crosstown",
        "direction": "· I-97 · safe",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-001",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:robbie-stine:silver",
    "person": "Robbie Stine",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Forest Mill Rd desk",
    "areaLead": "Mount Kalaga National Park",
    "pickups": [
      {
        "areaLead": "Mount Kalaga National Park",
        "direction": "· Forest Mill Rd · desk Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-014",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:tayson-briggs:standard",
    "person": "Tayson Briggs",
    "variant": "standard",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "SW 17th St terrace",
    "areaLead": "Salton",
    "pickups": [
      {
        "areaLead": "Salton",
        "direction": "· SW 17th St · terrace",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-028",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:thien-trinh:bronze",
    "person": "Thien Trinh",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "area-known",
    "spotDescription": "SR-45 cemetery",
    "areaLead": "Grayson",
    "pickups": [
      {
        "areaLead": "Grayson",
        "direction": "· SR-45 · cemetery",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:thien-trinh:gold",
    "person": "Thien Trinh",
    "variant": "gold",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Longship Dr restaurant",
    "areaLead": "Watson Bay",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Longship Dr · restaurant",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-016",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:thien-trinh:silver",
    "person": "Thien Trinh",
    "variant": "silver",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "US-183 blue farmhouse porch",
    "areaLead": "Gellhorn",
    "pickups": [
      {
        "areaLead": "Gellhorn",
        "direction": "· US-183 · blue farmhouse porch",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-liberty-city-wrath-005",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:anthony-herndon:bronze",
    "person": "Anthony Herndon",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "US-70 garage",
    "areaLead": "Frogswater",
    "pickups": [
      {
        "areaLead": "Frogswater",
        "direction": "· US-70 · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-corkers-014",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:anthony-herndon:gold",
    "person": "Anthony Herndon",
    "variant": "gold",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "area-known",
    "spotDescription": "Bayside Dr safe",
    "areaLead": "Tequesta",
    "pickups": [
      {
        "areaLead": "Tequesta",
        "direction": "· Bayside Dr · safe",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:anthony-herndon:silver",
    "person": "Anthony Herndon",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Airport terminal lost-and-found",
    "areaLead": "VCIA",
    "pickups": [
      {
        "areaLead": "VCIA",
        "direction": "· Airport · terminal lost-and-found",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-corkers-028",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:aoi-watanabe:standard",
    "person": "Aoi Watanabe",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Aurora Theaters tower",
    "areaLead": "Peacock Bay",
    "pickups": [
      {
        "areaLead": "Peacock Bay",
        "direction": "· Aurora Theaters · tower Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-corkers-016",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:carlos-larios:bronze",
    "person": "Carlos Larios",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Large park baseball dugout",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Large park · baseball dugout Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L2608",
        "hostName": "Park"
      }
    ],
    "hostId": "L2608",
    "catalogueId": "card:carlos-larios-bronze",
    "conflict": "Open GTA 6 Map import — Open GTA 6 Map record card-los-santos-corkers-030 sits 566.3u from this host pin — host position kept; the fbrito position was not imported.",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:carlos-larios:gold",
    "person": "Carlos Larios",
    "variant": "gold",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "NW 9th St lounge chair",
    "areaLead": "Rockridge",
    "pickups": [
      {
        "areaLead": "Rockridge",
        "direction": "· NW 9th St · lounge chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-corkers-005",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:carlos-larios:silver",
    "person": "Carlos Larios",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "NW 17th St desk",
    "areaLead": "Balsero",
    "pickups": [
      {
        "areaLead": "Balsero",
        "direction": "· NW 17th St · desk",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:franklin-turner:bronze",
    "person": "Franklin Turner",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "area-known",
    "spotDescription": "Western white house garage counter",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· Western white house · garage counter Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:franklin-turner:gold",
    "person": "Franklin Turner",
    "variant": "gold",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Coconut Cove Ct stairs",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Coconut Cove Ct · stairs",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-corkers-015",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:franklin-turner:silver",
    "person": "Franklin Turner",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "Catalan Blvd garage",
    "areaLead": "Waning Sands",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· Catalan Blvd · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:jesus-de-fuente:standard",
    "person": "Jesus De Fuente",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Galerina St balcony",
    "areaLead": "Hamlet",
    "pickups": [
      {
        "areaLead": "Hamlet",
        "direction": "· Galerina St · balcony",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-corkers-002",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:jonah-clemmons:deep-red",
    "person": "Jonah Clemmons",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "SW 4th St chessboard",
    "areaLead": "Salton",
    "pickups": [
      {
        "areaLead": "Salton",
        "direction": "· SW 4th St · chessboard",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-corkers-023",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:jonah-clemmons:navy-blue",
    "person": "Jonah Clemmons",
    "variant": "Navy Blue",
    "variantAlias": "navy",
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "navy blue"
    },
    "placement": "pinned",
    "spotDescription": "SW 10th Ave chair",
    "areaLead": "Southside",
    "pickups": [
      {
        "areaLead": "Southside",
        "direction": "· SW 10th Ave · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-corkers-031",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:jonah-clemmons:silver",
    "person": "Jonah Clemmons",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Northern island riverside house",
    "areaLead": "Watson Bay",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Northern island · riverside house",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-corkers-024",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:miguel-ayala:standard",
    "person": "Miguel Ayala",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Moreau Pass State Park terrace",
    "areaLead": "Moreau",
    "pickups": [
      {
        "areaLead": "Moreau",
        "direction": "· Moreau Pass State Park · terrace",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-corkers-032",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:samuel-buono:deep-red",
    "person": "Samuel Buono",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "Station north bench on west side",
    "areaLead": "Tequesta",
    "pickups": [
      {
        "areaLead": "Tequesta",
        "direction": "· Station · north bench on west side",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-corkers-027",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:samuel-buono:navy-blue",
    "person": "Samuel Buono",
    "variant": "Navy Blue",
    "variantAlias": "navy",
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "navy blue"
    },
    "placement": "pinned",
    "spotDescription": "Seabell Ave bench",
    "areaLead": "Watson Bay",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Seabell Ave · bench",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-corkers-022",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:samuel-buono:silver",
    "person": "Samuel Buono",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "US-82 desk",
    "areaLead": "Grassrivers",
    "pickups": [
      {
        "areaLead": "Grassrivers",
        "direction": "· US-82 · desk",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:si-woo-choo:standard",
    "person": "Si-Woo Choo",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Sandy Snacks kiosk",
    "areaLead": "Washington Beach",
    "pickups": [
      {
        "areaLead": "Washington Beach",
        "direction": "· Sandy Snacks · kiosk",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-corkers-026",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:terrence-jackson:deep-red",
    "person": "Terrence Jackson",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "Eastern pink house pool",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· Eastern pink house · pool",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-corkers-029",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:terrence-jackson:navy-blue",
    "person": "Terrence Jackson",
    "variant": "Navy Blue",
    "variantAlias": "navy",
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "navy blue"
    },
    "placement": "pinned",
    "spotDescription": "Station toward northern Mariana County bench",
    "areaLead": "Grassrivers",
    "pickups": [
      {
        "areaLead": "Grassrivers",
        "direction": "· Station toward northern Mariana County · bench",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-corkers-021",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:terrence-jackson:silver",
    "person": "Terrence Jackson",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Tallaloko Lake Rd container",
    "areaLead": "Eastern Lummox County",
    "pickups": [
      {
        "areaLead": "Eastern Lummox County",
        "direction": "· Tallaloko Lake Rd · container",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-corkers-025",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:victor-maravilla:standard",
    "person": "Victor Maravilla",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Kitchen fridge inside the Starlet Motel — enter the lounge to reach the fridge (Gellhorn pickup; GTADB places the motel in Kelly County)",
    "areaLead": "Gellhorn",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Western baseball field · dugout bench",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      },
      {
        "areaLead": "Gellhorn",
        "direction": "· At the Starlet Motel, inspect the kitchen fridge during chapter 2. The catalog also records an outdoor pickup in Ambrosia. Area cross-checked When should you visit the Starlet Motel? At the motel, enter the lounge to reach the fridge. Map at 0:06 · Fridge at 0:13 · Front at 0:17",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L304",
        "hostName": "Starlet Motel"
      }
    ],
    "hostId": "L304",
    "catalogueId": "card:victor-maravilla",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:xavier-gomez:standard",
    "person": "Xavier Gomez",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "area-known",
    "spotDescription": "Vine St refrigerator",
    "areaLead": "Hamlet",
    "pickups": [
      {
        "areaLead": "Hamlet",
        "direction": "· Vine St · refrigerator",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:carl-camp:standard",
    "person": "Carl Camp",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Top row of the north bleachers by the Colonel Crystal Recreation Center courts, Willow Ave, Ambrosia",
    "areaLead": "Ambrosia",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Willow Ave · basketball court In Ambrosia, check the top row of the north bleachers by the Colonel Crystal Recreation Center courts. A separate PS5 capture places the card in a box by the roof vents at the Red Snapper in Key Lento. We have one directly documented pickup for that rooftop. Pickup, map and card front on GTADB",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-panic-020",
    "conflict": "lorenzone text also cites a separate PS5 capture placing the card in a box by the roof vents at the Red Snapper in Key Lento, a different area from the Ambrosia bleachers pickup; neither Colonel Crystal Recreation Center nor the Red Snapper has a GTADB record",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:chibuike-bello:bronze",
    "person": "Chibuike Bello",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "area-known",
    "spotDescription": "Meadowlark Rd refrigerator",
    "areaLead": "Ambrosia",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Meadowlark Rd · refrigerator",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:chibuike-bello:gold",
    "person": "Chibuike Bello",
    "variant": "gold",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "area-known",
    "spotDescription": "Flamingo Pkwy garage",
    "areaLead": "Waning Sands",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· Flamingo Pkwy · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:chibuike-bello:silver",
    "person": "Chibuike Bello",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "NW 4th Ave roof",
    "areaLead": "Little Cuba",
    "pickups": [
      {
        "areaLead": "Little Cuba",
        "direction": "· NW 4th Ave · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-panic-022",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:damarion-carter:purple",
    "person": "Damarion Carter",
    "variant": "purple",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Grape St balcony",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Grape St · balcony",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-panic-021",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:damarion-carter:silver",
    "person": "Damarion Carter",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Atlantic Ave cabinet",
    "areaLead": "Washington Beach",
    "pickups": [
      {
        "areaLead": "Washington Beach",
        "direction": "· Atlantic Ave · cabinet",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-panic-023",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:damarion-carter:yellow",
    "person": "Damarion Carter",
    "variant": "yellow",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "yellow"
    },
    "placement": "pinned",
    "spotDescription": "I-97 billboard",
    "areaLead": "Waning Sands",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· I-97 · billboard",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-panic-026",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:jackson-belton:standard",
    "person": "Jackson Belton",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "area-known",
    "spotDescription": "NW 3rd Ave house",
    "areaLead": "Little Cuba",
    "pickups": [
      {
        "areaLead": "Little Cuba",
        "direction": "· NW 3rd Ave · house",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:jakob-markic:purple",
    "person": "Jakob Markic",
    "variant": "purple",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "South Vice Ave bench",
    "areaLead": "Tequesta",
    "pickups": [
      {
        "areaLead": "Tequesta",
        "direction": "· South Vice Ave · bench",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-panic-025",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:jakob-markic:silver",
    "person": "Jakob Markic",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Northbrook Dr stairs",
    "areaLead": "Little Cuba",
    "pickups": [
      {
        "areaLead": "Little Cuba",
        "direction": "· Northbrook Dr · stairs",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-panic-017",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:jakob-markic:yellow",
    "person": "Jakob Markic",
    "variant": "yellow",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "yellow"
    },
    "placement": "pinned",
    "spotDescription": "East of Lake Tallaloko gray house basketball hoop",
    "areaLead": "Eastern Lummox County",
    "pickups": [
      {
        "areaLead": "Eastern Lummox County",
        "direction": "· East of Lake Tallaloko · gray house basketball hoop",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-panic-015",
    "conflict": "Open GTA 6 Map import — fbrito also has card-los-santos-panic-019 for this slot — citation picks card-los-santos-panic-015",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:lloyd-robinson:standard",
    "person": "Lloyd Robinson",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "area-known",
    "spotDescription": "Catalan Blvd desk",
    "areaLead": "Downtown",
    "pickups": [
      {
        "areaLead": "Downtown",
        "direction": "· Catalan Blvd · desk",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:marquise-bernard:standard",
    "person": "Marquise Bernard",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Barrel beside the entrance of Kenton's shop on Dolphin Drive, Key Lento",
    "areaLead": "Key Lento",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· At Kenton’s shop on Dolphin Drive, check the barrel beside the entrance. Area cross-checked The wooden porch runs along the waterfront. Bernard wears a yellow jersey on the card front. Pickup, map and card front on GTADB",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": "Kenton's Shop"
      }
    ],
    "hostId": null,
    "catalogueId": "loot:guide-marquise-card",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:nikkander-orlov:purple",
    "person": "Nikkander Orlov",
    "variant": "purple",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Mamey Cir garage",
    "areaLead": "Waning Sands",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· Mamey Cir · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-panic-016",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:nikkander-orlov:silver",
    "person": "Nikkander Orlov",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Seabell Ave shelf",
    "areaLead": "Watson Bay",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Seabell Ave · shelf Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-panic-002",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:nikkander-orlov:yellow",
    "person": "Nikkander Orlov",
    "variant": "yellow",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "yellow"
    },
    "placement": "pinned",
    "spotDescription": "SW 12th St terrace",
    "areaLead": "Southside",
    "pickups": [
      {
        "areaLead": "Southside",
        "direction": "· SW 12th St · terrace",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-panic-018",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:oluwa-mohammed:standard",
    "person": "Oluwa Mohammed",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "NW 5th St desk",
    "areaLead": "Rockridge",
    "pickups": [
      {
        "areaLead": "Rockridge",
        "direction": "· NW 5th St · desk",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-panic-006",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:quinton-allen:bronze",
    "person": "Quinton Allen",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "area-known",
    "spotDescription": "I-297 safe",
    "areaLead": "Eastern Lummox County",
    "pickups": [
      {
        "areaLead": "Eastern Lummox County",
        "direction": "· I-297 · safe",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:quinton-allen:gold",
    "person": "Quinton Allen",
    "variant": "gold",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "area-known",
    "spotDescription": "Emerald Springs Dr safe",
    "areaLead": "Emerald Springs",
    "pickups": [
      {
        "areaLead": "Emerald Springs",
        "direction": "· Emerald Springs Dr · safe",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:quinton-allen:silver",
    "person": "Quinton Allen",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "US-35 safe",
    "areaLead": "Ambrosia",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· US-35 · safe",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-panic-013",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:santiago-lopez:standard",
    "person": "Santiago Lopez",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Table beside the ammunition box in the bedroom of the mobile home, Peach Palm Dr, Key Lento",
    "areaLead": "Key Lento",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· Peach Palm Dr · table Inside the mobile home, look beside the ammunition box in the bedroom. Mic Fury’s approach at 0:46 In the bedroom, look at the table between the bed and the window. Pickup, map and card front on GTADB",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-panic-001",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:terrance-ericks:bronze",
    "person": "Terrance Ericks",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "area-known",
    "spotDescription": "Del Rio Blvd shelf",
    "areaLead": "La Perle",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· Del Rio Blvd · shelf Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:terrance-ericks:gold",
    "person": "Terrance Ericks",
    "variant": "gold",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "SW 6th Ave roof",
    "areaLead": "Salton",
    "pickups": [
      {
        "areaLead": "Salton",
        "direction": "· SW 6th Ave · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-panic-024",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-panic:terrance-ericks:silver",
    "person": "Terrance Ericks",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-panic",
    "setName": "Los Santos Panic",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "Brock’s Antiques staff room",
    "areaLead": "Decor District",
    "pickups": [
      {
        "areaLead": "Decor District",
        "direction": "· Brock’s Antiques · staff room Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:benjamin-quintana:standard",
    "person": "Benjamin Quintana",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Reservoir St playing field",
    "areaLead": "Ambrosia",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Reservoir St · playing field",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-pounders-021",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:bingo-johnson:standard",
    "person": "Bingo Johnson",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Gellhorn Ave refrigerator",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Gellhorn Ave · refrigerator",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-pounders-006",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:dravy-mease:deep-red",
    "person": "Dravy Mease",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "area-known",
    "spotDescription": "Aminita Rd terrace",
    "areaLead": "Hamlet",
    "pickups": [
      {
        "areaLead": "Hamlet",
        "direction": "· Aminita Rd · terrace",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:dravy-mease:silver",
    "person": "Dravy Mease",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Cubera Ln balcony",
    "areaLead": "Washington Beach",
    "pickups": [
      {
        "areaLead": "Washington Beach",
        "direction": "· Cubera Ln · balcony",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-pounders-015",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:dravy-mease:yellow",
    "person": "Dravy Mease",
    "variant": "yellow",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "yellow"
    },
    "placement": "area-known",
    "spotDescription": "Beach gym locker in shipping container",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Beach gym · locker in shipping container",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:granian-beach:standard",
    "person": "Granian Beach",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "area-known",
    "spotDescription": "Kingston Rd bedroom",
    "areaLead": "Watson Bay",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Kingston Rd · bedroom",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": "Held from the Open GTA 6 Map import: bucket D, gtatown does not show it",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:laki-maivia:bronze",
    "person": "Laki Maivia",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Old Fort Rd safe",
    "areaLead": "Cottonmouth Lake",
    "pickups": [
      {
        "areaLead": "Cottonmouth Lake",
        "direction": "· Old Fort Rd · safe Head to the trailer near the burnt-out houses on the southwest shore of Cottonmouth Lake. The safe is beneath the microwave in the kitchen. The postcards on the wall give its combination, 44017 . Video by Fuze | GTA 6 · map at 0:06 · wall clue at 0:14 · open safe at 0:22 . See the map, clue, open safe and Bronze card front · PS5 screenshots by GTADB / PlayCentral, game imagery © Rockstar Games.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-pounders-001",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:laki-maivia:gold",
    "person": "Laki Maivia",
    "variant": "gold",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "area-known",
    "spotDescription": "Rialto Cswy white villa gym",
    "areaLead": "Casanova Island",
    "pickups": [
      {
        "areaLead": "Casanova Island",
        "direction": "· Rialto Cswy · white villa gym",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:laki-maivia:silver",
    "person": "Laki Maivia",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "Atlantic Ave roof",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Atlantic Ave · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:lionel-taber:standard",
    "person": "Lionel Taber",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Bathroom in the party house upstairs on Dolphin Drive, Key Lento",
    "areaLead": "Key Lento",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· On Dolphin Drive, head upstairs into the party house. Look in the bathroom. Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-pounders-007",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:maximus-goldbart:deep-red",
    "person": "Maximus Goldbart",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "SW 7th Ave chessboard",
    "areaLead": "Salton",
    "pickups": [
      {
        "areaLead": "Salton",
        "direction": "· SW 7th Ave · chessboard",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-pounders-024",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:maximus-goldbart:silver",
    "person": "Maximus Goldbart",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "Cangrejo St house",
    "areaLead": "Southwind",
    "pickups": [
      {
        "areaLead": "Southwind",
        "direction": "· Cangrejo St · house",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:maximus-goldbart:yellow",
    "person": "Maximus Goldbart",
    "variant": "yellow",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "yellow"
    },
    "placement": "pinned",
    "spotDescription": "Flamingo Pkwy garage",
    "areaLead": "Waning Sands",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· Flamingo Pkwy · garage Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-pounders-011",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:randolph-topolski:bronze",
    "person": "Randolph Topolski",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Farmers Walk chair",
    "areaLead": "Bluegrass",
    "pickups": [
      {
        "areaLead": "Bluegrass",
        "direction": "· Farmers Walk · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-pounders-018",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:randolph-topolski:gold",
    "person": "Randolph Topolski",
    "variant": "gold",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "SE 2nd Ave roof",
    "areaLead": "Tequesta",
    "pickups": [
      {
        "areaLead": "Tequesta",
        "direction": "· SE 2nd Ave · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-pounders-016",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:randolph-topolski:silver",
    "person": "Randolph Topolski",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "SR-73 crate",
    "areaLead": "Manifest Canyon",
    "pickups": [
      {
        "areaLead": "Manifest Canyon",
        "direction": "· SR-73 · crate",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:rider-butler:bronze",
    "person": "Rider Butler",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "NW 22nd Pl bookshelf",
    "areaLead": "Balsero",
    "pickups": [
      {
        "areaLead": "Balsero",
        "direction": "· NW 22nd Pl · bookshelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-pounders-026",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:rider-butler:gold",
    "person": "Rider Butler",
    "variant": "gold",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Hummingbird Park pool",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Hummingbird Park · pool",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-pounders-022",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:rider-butler:silver",
    "person": "Rider Butler",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Phone booth at Millport station",
    "areaLead": "Millport",
    "pickups": [
      {
        "areaLead": "Millport",
        "direction": "· Millport station · phone booth",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L1916",
        "hostName": "Train Station"
      }
    ],
    "hostId": "L1916",
    "catalogueId": "card:rider-butler-silver",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:sione-apa:deep-red",
    "person": "Sione Apa",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "Vice Seven Condominiums locker room",
    "areaLead": "Tequesta",
    "pickups": [
      {
        "areaLead": "Tequesta",
        "direction": "· Vice Seven Condominiums · locker room Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-pounders-019",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:sione-apa:silver",
    "person": "Sione Apa",
    "variant": "silver",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "area-known",
    "spotDescription": "Rialto Cswy table",
    "areaLead": "Rockridge",
    "pickups": [
      {
        "areaLead": "Rockridge",
        "direction": "· Rialto Cswy · table",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:sione-apa:yellow",
    "person": "Sione Apa",
    "variant": "yellow",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "yellow"
    },
    "placement": "pinned",
    "spotDescription": "SR-45 terrace",
    "areaLead": "Grayson",
    "pickups": [
      {
        "areaLead": "Grayson",
        "direction": "· SR-45 · terrace",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-pounders-023",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:tyson-brooks:standard",
    "person": "Tyson Brooks",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "I-297 garage",
    "areaLead": "Waning Sands",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· I-297 · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-pounders-025",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:zander-paton:standard",
    "person": "Zander Paton",
    "variant": "standard",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Eastern island north shore pavilion railing",
    "areaLead": "Waning Sands",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· Eastern island · north shore pavilion railing",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-los-santos-pounders-017",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:backyard-wrestling:axel-hughes:standard",
    "person": "Axel Hughes",
    "variant": "standard",
    "variantAlias": null,
    "setId": "backyard-wrestling",
    "setName": "Backyard Wrestling",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Western green-and-white trailer backyard sofa",
    "areaLead": "Ambrosia",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Western green-and-white trailer · backyard sofa",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-backyard-wrestling-017",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:backyard-wrestling:blood-smith:standard",
    "person": "Blood Smith",
    "variant": "standard",
    "variantAlias": null,
    "setId": "backyard-wrestling",
    "setName": "Backyard Wrestling",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Southern treehouse red tarp",
    "areaLead": "Manifest Canyon",
    "pickups": [
      {
        "areaLead": "Manifest Canyon",
        "direction": "· Southern treehouse · red tarp",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-backyard-wrestling-018",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:backyard-wrestling:cherry-o-glade:standard",
    "person": "Cherry O' Glade",
    "variant": "standard",
    "variantAlias": null,
    "setId": "backyard-wrestling",
    "setName": "Backyard Wrestling",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Breakwater quarry southern railcar",
    "areaLead": "Northern Mariana County",
    "pickups": [
      {
        "areaLead": "Northern Mariana County",
        "direction": "· Breakwater quarry · southern railcar",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-backyard-wrestling-019",
    "conflict": "Direction names Breakwater quarry, Northern Mariana County; the only GTADB 'Breakwater' record (L1892) is in Capri — area disagreement, not pinned.",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:backyard-wrestling:chico-bonez:standard",
    "person": "Chico Bonez",
    "variant": "standard",
    "variantAlias": null,
    "setId": "backyard-wrestling",
    "setName": "Backyard Wrestling",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Grisette Ave bleachers",
    "areaLead": "Hamlet",
    "pickups": [
      {
        "areaLead": "Hamlet",
        "direction": "· Grisette Ave · bleachers",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-backyard-wrestling-001",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:backyard-wrestling:chrissy-deangelo:standard",
    "person": "Chrissy Deangelo",
    "variant": "standard",
    "variantAlias": null,
    "setId": "backyard-wrestling",
    "setName": "Backyard Wrestling",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Boulder Cabin porch, Mount Kalaga National Park",
    "areaLead": "Mount Kalaga National Park",
    "pickups": [
      {
        "areaLead": "Mount Kalaga National Park",
        "direction": "· Boulder Cabin · porch",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L3905",
        "hostName": "Boulder Cabin"
      }
    ],
    "hostId": "L3905",
    "catalogueId": "card:chrissy-deangelo",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:backyard-wrestling:danny-mclean:standard",
    "person": "Danny McLean",
    "variant": "standard",
    "variantAlias": null,
    "setId": "backyard-wrestling",
    "setName": "Backyard Wrestling",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Red house on northern island punching bag",
    "areaLead": "Watson Bay",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Red house on northern island · punching bag Two records differ. GTA6.fr lists the house in Watson Bay. In Key Lento, GTA6Heists documents a copy inside the yellow phone box on the Badger R&D tower balcony. The front identifies Danny McLean. The variant of this copy is unconfirmed, so this report is tracked separately. GTA Base also places Danny in Key Lento, in a wall box at the top of the tower. Its map pin corroborates the pickup photographed by GTA6Heists. The colour of this copy still needs verification.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-backyard-wrestling-004",
    "conflict": "Two sources differ: lorenzone/GTA6.fr place the card in a red house on the northern island, Watson Bay; GTA6Heists/GTA Base place a copy in the yellow phone box on the Badger R&D tower balcony, Key Lento (variant unconfirmed, tracked separately). Badger R&D tower has no GTADB record.",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:backyard-wrestling:j-d-wild:standard",
    "person": "J.D. Wild",
    "variant": "standard",
    "variantAlias": null,
    "setId": "backyard-wrestling",
    "setName": "Backyard Wrestling",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "area-known",
    "spotDescription": "North of Pay ’n’ Spray yellow box",
    "areaLead": "Grayson",
    "pickups": [
      {
        "areaLead": "Grayson",
        "direction": "· North of Pay ’n’ Spray · yellow box Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      },
      {
        "areaLead": "Pelican Valley",
        "direction": "· Aminita Rd · shack",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:backyard-wrestling:judas-sterling:standard",
    "person": "Judas Sterling",
    "variant": "standard",
    "variantAlias": null,
    "setId": "backyard-wrestling",
    "setName": "Backyard Wrestling",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Bayside bleachers awning with garden gnome",
    "areaLead": "Gloriana Key",
    "pickups": [
      {
        "areaLead": "Gloriana Key",
        "direction": "· Bayside bleachers · awning with garden gnome At the stadium, follow the rusty walkway to the ladder. GTA Base places the card by the hammer and garden gnomes. JankyWapo films a different copy beside an outdoor wall box. Wall box at 0:37 · Back at 0:47",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-backyard-wrestling-008",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:backyard-wrestling:katie-k:standard",
    "person": "Katie K",
    "variant": "standard",
    "variantAlias": null,
    "setId": "backyard-wrestling",
    "setName": "Backyard Wrestling",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Harper Simmons Legal Services roof",
    "areaLead": "Rockridge",
    "pickups": [
      {
        "areaLead": "Rockridge",
        "direction": "· Harper Simmons Legal Services · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-backyard-wrestling-021",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:backyard-wrestling:l-heavy:standard",
    "person": "L.Heavy",
    "variant": "standard",
    "variantAlias": null,
    "setId": "backyard-wrestling",
    "setName": "Backyard Wrestling",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Northwestern crane waterside ladder",
    "areaLead": "Watson Bay",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Northwestern crane · waterside ladder",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-backyard-wrestling-023",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:backyard-wrestling:luke-x:standard",
    "person": "Luke X",
    "variant": "standard",
    "variantAlias": null,
    "setId": "backyard-wrestling",
    "setName": "Backyard Wrestling",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "SR-73 trailer dresser",
    "areaLead": "Southwestern Lummox County",
    "pickups": [
      {
        "areaLead": "Southwestern Lummox County",
        "direction": "· SR-73 · trailer dresser",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L3434",
        "hostName": "Wild Hog Point"
      }
    ],
    "hostId": "L3434",
    "catalogueId": "card:luke-x",
    "conflict": "lorenzone area is Southwestern Lummox County (SR-73 trailer); existing host Wild Hog Point (L3434) is in Kelly County per GTADB — area disagreement recorded, existing pin kept. Open GTA 6 Map import — host-pinned; cited fbrito record card-backyard-wrestling-014 sits 3601u from the host pin — host wins, disagreement recorded",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:backyard-wrestling:shovel:standard",
    "person": "Shovel",
    "variant": "standard",
    "variantAlias": null,
    "setId": "backyard-wrestling",
    "setName": "Backyard Wrestling",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "area-known",
    "spotDescription": "Beach point trailer",
    "areaLead": "Wild Hog Point",
    "pickups": [
      {
        "areaLead": "Wild Hog Point",
        "direction": "· Beach point · trailer",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": "Held from the Open GTA 6 Map import: bucket D, gtatown does not show it",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:angel:bronze",
    "person": "Angel",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "area-known",
    "spotDescription": "Blue Shell Oyster Farms kiosk",
    "areaLead": "Sandbars",
    "pickups": [
      {
        "areaLead": "Sandbars",
        "direction": "· Blue Shell Oyster Farms · kiosk",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:angel:gold",
    "person": "Angel",
    "variant": "gold",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Central island villa roof railing",
    "areaLead": "Catalan Key",
    "pickups": [
      {
        "areaLead": "Catalan Key",
        "direction": "· Central island villa · roof railing",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-034",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:angel:silver",
    "person": "Angel",
    "variant": "silver",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Dome Depot chair",
    "areaLead": "Big Pine",
    "pickups": [
      {
        "areaLead": "Big Pine",
        "direction": "· Dome Depot · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-029",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:bambi:standard",
    "person": "Bambi",
    "variant": "standard",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Harborside Ave restaurant",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Harborside Ave · restaurant",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-001",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:beverly:bronze",
    "person": "Beverly",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Burning fields to the west cell tower",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· Burning fields to the west · cell tower",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-013",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:beverly:gold",
    "person": "Beverly",
    "variant": "gold",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Northern islet chair on sand",
    "areaLead": "Riquezas Keys",
    "pickups": [
      {
        "areaLead": "Riquezas Keys",
        "direction": "· Northern islet · chair on sand",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-020",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:beverly:silver",
    "person": "Beverly",
    "variant": "silver",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Farmers Walk garage",
    "areaLead": "Bluegrass",
    "pickups": [
      {
        "areaLead": "Bluegrass",
        "direction": "· Farmers Walk · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-032",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:boris:bronze",
    "person": "Boris",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Atlantic Ave mattress",
    "areaLead": "Washington Beach",
    "pickups": [
      {
        "areaLead": "Washington Beach",
        "direction": "· Atlantic Ave · mattress",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-033",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:boris:gold",
    "person": "Boris",
    "variant": "gold",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "NW 3rd Ave playing field",
    "areaLead": "Northern Mariana County",
    "pickups": [
      {
        "areaLead": "Northern Mariana County",
        "direction": "· NW 3rd Ave · playing field",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-031",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:boris:silver",
    "person": "Boris",
    "variant": "silver",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Chestnut Dr empty tank",
    "areaLead": "Millport",
    "pickups": [
      {
        "areaLead": "Millport",
        "direction": "· Chestnut Dr · empty tank",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-030",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:chastity:standard",
    "person": "Chastity",
    "variant": "standard",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Stockyard Speedshop garage",
    "areaLead": "Decor District",
    "pickups": [
      {
        "areaLead": "Decor District",
        "direction": "· Stockyard Speedshop · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      },
      {
        "areaLead": "Salton",
        "direction": "· Westbrook Dr · mannequin",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-036",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:crystal:standard",
    "person": "Crystal",
    "variant": "standard",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "area-known",
    "spotDescription": "SR-27 restrooms",
    "areaLead": "Northern Kelly County",
    "pickups": [
      {
        "areaLead": "Northern Kelly County",
        "direction": "· SR-27 · restrooms",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:diego:standard",
    "person": "Diego",
    "variant": "standard",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "South Vice Ave tower",
    "areaLead": "Tequesta",
    "pickups": [
      {
        "areaLead": "Tequesta",
        "direction": "· South Vice Ave · tower",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-028",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:drake:bronze",
    "person": "Drake",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Moonstone Hwy restrooms",
    "areaLead": "Manifest Canyon",
    "pickups": [
      {
        "areaLead": "Manifest Canyon",
        "direction": "· Moonstone Hwy · restrooms",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-007",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:drake:gold",
    "person": "Drake",
    "variant": "gold",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Ruined house workbench at MacAlister mine, Moreau",
    "areaLead": "Moreau",
    "pickups": [
      {
        "areaLead": "Moreau",
        "direction": "· MacAlister mine · ruined house workbench",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L996",
        "hostName": "MacAlister Gold Mine"
      }
    ],
    "hostId": "L996",
    "catalogueId": "card:drake-gold",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:drake:silver",
    "person": "Drake",
    "variant": "silver",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Key Lento chair",
    "areaLead": "Key Lento",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· Key Lento · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-002",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:kalisha:bronze",
    "person": "Kalisha",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Forest Mill Rd woodland campsite",
    "areaLead": "Mount Kalaga National Park",
    "pickups": [
      {
        "areaLead": "Mount Kalaga National Park",
        "direction": "· Forest Mill Rd · woodland campsite",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-008",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:kalisha:gold",
    "person": "Kalisha",
    "variant": "gold",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "area-known",
    "spotDescription": "Southeast top of water tower",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Southeast · top of water tower",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:kalisha:silver",
    "person": "Kalisha",
    "variant": "silver",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "West coast concrete pier mooring cleat",
    "areaLead": "Bonanza",
    "pickups": [
      {
        "areaLead": "Bonanza",
        "direction": "· West coast · concrete pier mooring cleat",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-035",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:kalvyn:standard",
    "person": "Kalvyn",
    "variant": "standard",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Big House Storage Inc roof",
    "areaLead": "Crosstown",
    "pickups": [
      {
        "areaLead": "Crosstown",
        "direction": "· Big House Storage Inc · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      },
      {
        "areaLead": "Decor District",
        "direction": "· West of Roval Jewelry · yellow box",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      },
      {
        "areaLead": "Ocean Beach",
        "direction": "· Atlantic Ave · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-009",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:sapphire:bronze",
    "person": "Sapphire",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Sycamore Ave table",
    "areaLead": "Ambrosia",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Sycamore Ave · table",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-006",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:sapphire:gold",
    "person": "Sapphire",
    "variant": "gold",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Central road stone tower",
    "areaLead": "Grassrivers",
    "pickups": [
      {
        "areaLead": "Grassrivers",
        "direction": "· Central road · stone tower",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-americas-next-top-hooker-023",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:sapphire:silver",
    "person": "Sapphire",
    "variant": "silver",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Crushed car trunk at MacAlister mine, Moreau",
    "areaLead": "Moreau",
    "pickups": [
      {
        "areaLead": "Moreau",
        "direction": "· MacAlister mine · crushed car trunk",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L996",
        "hostName": "MacAlister Gold Mine"
      }
    ],
    "hostId": "L996",
    "catalogueId": "card:sapphire-silver",
    "conflict": "Open GTA 6 Map import — host-pinned; cited fbrito record card-americas-next-top-hooker-019 sits 815u from the host pin — host wins, disagreement recorded",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:americas-next-top-hooker:skyla:standard",
    "person": "Skyla",
    "variant": "standard",
    "variantAlias": null,
    "setId": "americas-next-top-hooker",
    "setName": "America's Next Top Hooker",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "area-known",
    "spotDescription": "SW 4th Ave chair",
    "areaLead": "Tequesta",
    "pickups": [
      {
        "areaLead": "Tequesta",
        "direction": "· SW 4th Ave · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:amber:standard",
    "person": "Amber",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Agricore mine tower",
    "areaLead": "Southern Leonard County",
    "pickups": [
      {
        "areaLead": "Southern Leonard County",
        "direction": "· Agricore mine · tower",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      },
      {
        "areaLead": "Draper Island",
        "direction": "· Southern island road · yellow booth near guard posts Area cross-checked GTA Six Map lists another area: Belville.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-036",
    "conflict": "Second pickup: GTA Six Map lists Belville instead of Draper Island (not used).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:chip:standard",
    "person": "Chip",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Kingston Rd restrooms",
    "areaLead": "Watson Bay",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Kingston Rd · restrooms Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-078",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:cleo:standard",
    "person": "Cleo",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "South end of reservoir battery",
    "areaLead": "Kalaga Reservoir",
    "pickups": [
      {
        "areaLead": "Kalaga Reservoir",
        "direction": "· South end of reservoir · battery GTA Six Map lists another area: Fairyland Forest.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-hidden-package-010",
    "conflict": "GTA Six Map lists Fairyland Forest instead of Kalaga Reservoir (not used).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:crystal:standard",
    "person": "Crystal",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "East Royale St chair",
    "areaLead": "Downtown",
    "pickups": [
      {
        "areaLead": "Downtown",
        "direction": "· East Royale St · chair GTA Six Map lists another area: Shoreline.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-060",
    "conflict": "GTA Six Map lists Shoreline instead of Downtown (not used).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:cyrus:standard",
    "person": "Cyrus",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Park Apartments refrigerator",
    "areaLead": "VCIA",
    "pickups": [
      {
        "areaLead": "VCIA",
        "direction": "· Park Apartments · refrigerator GTA Six Map lists another area: Little Cuba.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-065",
    "conflict": "GTA Six Map lists Little Cuba instead of VCIA (not used).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:daisy:standard",
    "person": "Daisy",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Northern Xero station kitchenette noticeboard",
    "areaLead": "La Perle",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· Northern Xero station · kitchenette noticeboard GTA Six Map lists another area: Bohemia.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-032",
    "conflict": "GTA Six Map lists Bohemia instead of La Perle (not used).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:harley:standard",
    "person": "Harley",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Delights Cabaret booth seat",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Delights Cabaret · booth seat Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L629",
        "hostName": "Delights"
      }
    ],
    "hostId": "L629",
    "catalogueId": "loot:guide-harley-card",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:jason:standard",
    "person": "Jason",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Delights Cabaret restroom",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Delights Cabaret · restroom Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L629",
        "hostName": "Delights"
      }
    ],
    "hostId": "L629",
    "catalogueId": "card:jason",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:kandi:standard",
    "person": "Kandi",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Northbrook Dr restrooms",
    "areaLead": "Little Cuba",
    "pickups": [
      {
        "areaLead": "Little Cuba",
        "direction": "· Northbrook Dr · restrooms Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L3078",
        "hostName": "Farmacia"
      }
    ],
    "hostId": "L3078",
    "catalogueId": "card:kandi",
    "conflict": "Open GTA 6 Map import — Two Open GTA 6 Map records claim this slot (collectible-card-059, card-delights-001) — held for arbitration; host position kept.",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:lance:standard",
    "person": "Lance",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "South coast lifeguard station desk",
    "areaLead": "Vice Beach",
    "pickups": [
      {
        "areaLead": "Vice Beach",
        "direction": "· South coast · lifeguard station desk GTA Six Map lists another area: Dalton Island.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-064",
    "conflict": "GTA Six Map lists Dalton Island instead of Vice Beach (not used).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:lucky:standard",
    "person": "Lucky",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Caldonia Blvd bedroom",
    "areaLead": "La Perle",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· Caldonia Blvd · bedroom GTA Six Map lists another area: Bohemia.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-035",
    "conflict": "GTA Six Map lists Bohemia instead of La Perle (not used).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:mario:standard",
    "person": "Mario",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Vice-Dale County Water and Sewage roof",
    "areaLead": "VCIA",
    "pickups": [
      {
        "areaLead": "VCIA",
        "direction": "· Vice-Dale County Water and Sewage · roof GTA Six Map lists another area: Peacock Bay.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-074",
    "conflict": "GTA Six Map lists Peacock Bay instead of VCIA (not used).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:nevaeh:standard",
    "person": "Nevaeh",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Hills damaged barn workbench",
    "areaLead": "Bonanza",
    "pickups": [
      {
        "areaLead": "Bonanza",
        "direction": "· Hills · damaged barn workbench Area cross-checked GTA Six Map lists another area: Redhill.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-001",
    "conflict": "GTA Six Map lists Redhill instead of Bonanza (not used).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:nicole:standard",
    "person": "Nicole",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Formosa Ave table",
    "areaLead": "Hamlet",
    "pickups": [
      {
        "areaLead": "Hamlet",
        "direction": "· Formosa Ave · table Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-080",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:perla:standard",
    "person": "Perla",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Rail yard control building electrical box",
    "areaLead": "Balsero",
    "pickups": [
      {
        "areaLead": "Balsero",
        "direction": "· Rail yard · control building electrical box GTA Six Map lists another area: Belville.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L1603",
        "hostName": "Railyard"
      }
    ],
    "hostId": "L1603",
    "catalogueId": "card:perla",
    "conflict": "GTA Six Map lists Belville instead of Balsero (not used); existing Railyard pin kept. Open GTA 6 Map import — host-pinned; cited fbrito record collectible-card-038 sits 781u from the host pin — host wins, disagreement recorded",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:thelma:standard",
    "person": "Thelma",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Desk in the control room of the tower northeast of Donnie's trailer, Key Lento (Badger R&D tower landmark)",
    "areaLead": "Key Lento",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· Climb the tower northeast of Donnie’s trailer. Check the desk in the control room. Area cross-checked Street landmark: the Badger R&D tower near Nifty Threads Islandwear. Climb to the control room.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-085",
    "conflict": "Open GTA 6 Map import — fbrito also has card-delights-009 for this slot — citation picks collectible-card-085",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:tracy:standard",
    "person": "Tracy",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Upstairs storeroom at the water department on Westbrook Drive, Salton (outside ladder at the riverside building)",
    "areaLead": "Salton",
    "pickups": [
      {
        "areaLead": "Salton",
        "direction": "· At the water department on Westbrook Drive, take the outside ladder at the riverside building and look in the upstairs storeroom. Area cross-checked GTA Six Map lists another area: Little Cuba.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-063",
    "conflict": "GTA Six Map lists Little Cuba instead of Salton (not used).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:delights-dancers:vicki:standard",
    "person": "Vicki",
    "variant": "standard",
    "variantAlias": null,
    "setId": "delights-dancers",
    "setName": "Delights Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard"
    },
    "placement": "pinned",
    "spotDescription": "Starlet Motel restroom",
    "areaLead": "Gellhorn",
    "pickups": [
      {
        "areaLead": "Gellhorn",
        "direction": "· Starlet Motel · restroom Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L304",
        "hostName": "Starlet Motel"
      },
      {
        "areaLead": "Southside",
        "direction": "· SW 10th Ave · chair GTA Six Map lists another area: Peacock Bay. When should you visit the Starlet Motel?",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": "L304",
    "catalogueId": "card:vicki",
    "conflict": "Second pickup (Southside chair): GTA Six Map lists Peacock Bay (not used); primary Starlet Motel pickup kept. Open GTA 6 Map import — host-pinned; cited fbrito record collectible-card-076 sits 6534u from the host pin — host wins, disagreement recorded Open GTA 6 Map import — Two Open GTA 6 Map records claim this slot (collectible-card-076, card-delights-002) — held for arbitration; host position kept.",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:brianna-blue:deep-red",
    "person": "Brianna Blue",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "Northwestern island, shed shelf — Pelican Valley",
    "areaLead": "Pelican Valley",
    "pickups": [
      {
        "areaLead": "Pelican Valley",
        "direction": "· Northwestern island · shed shelf Area cross-checked GTA Six Map lists another area: Grassrivers.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-081",
    "conflict": "GTA Six Map lists another area: Grassrivers (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:brianna-blue:pink",
    "person": "Brianna Blue",
    "variant": "pink",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "Rockledge Rd, chair — Moreau",
    "areaLead": "Moreau",
    "pickups": [
      {
        "areaLead": "Moreau",
        "direction": "· Rockledge Rd · chair GTA Six Map lists another area: Redhill.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-002",
    "conflict": "GTA Six Map lists another area: Redhill (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:brianna-blue:purple",
    "person": "Brianna Blue",
    "variant": "purple",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Xero on US-183, break room noticeboard — Capri",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Xero on US-183 · break room noticeboard Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L1612",
        "hostName": "Xero Gas Station"
      }
    ],
    "hostId": "L1612",
    "catalogueId": "card:brianna-blue-purple",
    "conflict": "Open GTA 6 Map import — host-pinned; cited fbrito record collectible-card-061 sits 649u from the host pin — host wins, disagreement recorded",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:christel:deep-red",
    "person": "Christel",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "NW 9th Ave, roof — La Perle",
    "areaLead": "La Perle",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· NW 9th Ave · roof Area cross-checked GTA Six Map lists another area: Bohemia.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-040",
    "conflict": "GTA Six Map lists another area: Bohemia (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:christel:pink",
    "person": "Christel",
    "variant": "pink",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "NW 15th Ave, restrooms — Salton",
    "areaLead": "Salton",
    "pickups": [
      {
        "areaLead": "Salton",
        "direction": "· NW 15th Ave · restrooms GTA Six Map lists another area: Little Cuba.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-058",
    "conflict": "GTA Six Map lists another area: Little Cuba (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:christel:purple",
    "person": "Christel",
    "variant": "purple",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Shorefront Ave, chair — Ocean Beach",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Shorefront Ave · chair Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-056",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:jada-watts:bronze",
    "person": "Jada Watts",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Pennwort St, table — Port Gellhorn",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Pennwort St · table Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-022",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:jada-watts:gold",
    "person": "Jada Watts",
    "variant": "gold",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "CR 62, antenna — Gellhorn",
    "areaLead": "Gellhorn",
    "pickups": [
      {
        "areaLead": "Gellhorn",
        "direction": "· CR 62 · antenna GTA Six Map lists another area: Lollipop Ridge.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-029",
    "conflict": "GTA Six Map lists another area: Lollipop Ridge (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:jada-watts:silver",
    "person": "Jada Watts",
    "variant": "silver",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "South coast, fishing garden gnome — Bobcat Key",
    "areaLead": "Bobcat Key",
    "pickups": [
      {
        "areaLead": "Bobcat Key",
        "direction": "· South coast · fishing garden gnome GTA Six Map lists another area: Watson Bay.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-079",
    "conflict": "GTA Six Map lists another area: Watson Bay (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:jemila:deep-red",
    "person": "Jemila",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "NW 10th Ave, balcony — Rockridge",
    "areaLead": "Rockridge",
    "pickups": [
      {
        "areaLead": "Rockridge",
        "direction": "· NW 10th Ave · balcony GTA Six Map lists another area: Little Cuba.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-047",
    "conflict": "GTA Six Map lists another area: Little Cuba (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:jemila:pink",
    "person": "Jemila",
    "variant": "pink",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "SW 5th Ave, roof — Peacock Bay",
    "areaLead": "Peacock Bay",
    "pickups": [
      {
        "areaLead": "Peacock Bay",
        "direction": "· SW 5th Ave · roof Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-075",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:jemila:purple",
    "person": "Jemila",
    "variant": "purple",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Fairbanks pharmacy, back stairs",
    "areaLead": "Fairbanks Pharmacy",
    "pickups": [
      {
        "areaLead": "Fairbanks Pharmacy",
        "direction": "· Fairbanks pharmacy · back stairs GTA Six Map lists another area: Vice Beach.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-048",
    "conflict": "GTA Six Map lists another area: Vice Beach (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:kadisha:deep-red",
    "person": "Kadisha",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "South of Breakwater quarry, railcar — Northern Mariana County",
    "areaLead": "Northern Mariana County",
    "pickups": [
      {
        "areaLead": "Northern Mariana County",
        "direction": "· South of Breakwater quarry · railcar GTA Six Map lists another area: Goliath.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-072",
    "conflict": "GTA Six Map lists another area: Goliath (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:kadisha:pink",
    "person": "Kadisha",
    "variant": "pink",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "SW 19th St, mattress — VCIA",
    "areaLead": "VCIA",
    "pickups": [
      {
        "areaLead": "VCIA",
        "direction": "· SW 19th St · mattress Area cross-checked GTA Six Map lists another area: Little Cuba.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-067",
    "conflict": "GTA Six Map lists another area: Little Cuba (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:kadisha:purple",
    "person": "Kadisha",
    "variant": "purple",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Butternut Rd, garage — Gellhorn",
    "areaLead": "Gellhorn",
    "pickups": [
      {
        "areaLead": "Gellhorn",
        "direction": "· Butternut Rd · garage GTA Six Map lists another area: Lollipop Ridge.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-028",
    "conflict": "GTA Six Map lists another area: Lollipop Ridge (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:kelly:deep-red",
    "person": "Kelly",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "Gellhorn Ave, trailer dresser — Port Gellhorn",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Gellhorn Ave · trailer dresser Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-018",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:kelly:pink",
    "person": "Kelly",
    "variant": "pink",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "Caledonia Blvd, restrooms — Belville",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· Caledonia Blvd · restrooms Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-031",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:kelly:purple",
    "person": "Kelly",
    "variant": "purple",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "I-97, chair — Tequesta",
    "areaLead": "Tequesta",
    "pickups": [
      {
        "areaLead": "Tequesta",
        "direction": "· I-97 · chair Area cross-checked GTA Six Map lists another area: Tequesta Retreat.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-069",
    "conflict": "GTA Six Map lists another area: Tequesta Retreat (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:lexi-campbell:bronze",
    "person": "Lexi Campbell",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Mount Kalaga park boundary, bunker mattress — Northern Leonard County",
    "areaLead": "Northern Leonard County",
    "pickups": [
      {
        "areaLead": "Northern Leonard County",
        "direction": "· Mount Kalaga park boundary · bunker mattress GTA Six Map lists another area: Fairyland Forest.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-012",
    "conflict": "GTA Six Map lists another area: Fairyland Forest (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:lexi-campbell:gold",
    "person": "Lexi Campbell",
    "variant": "gold",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Gellhorn Ave, safe — Port Gellhorn",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Gellhorn Ave · safe Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L3658",
        "hostName": "Gellhorn Drive-In Theatre"
      }
    ],
    "hostId": "L3658",
    "catalogueId": "card:lexi-campbell",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:lexi-campbell:silver",
    "person": "Lexi Campbell",
    "variant": "silver",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Cargo Rd, desk — Buckskin Swamp",
    "areaLead": "Buckskin Swamp",
    "pickups": [
      {
        "areaLead": "Buckskin Swamp",
        "direction": "· Cargo Rd · desk GTA Six Map lists another area: Buckskin.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-049",
    "conflict": "GTA Six Map lists another area: Buckskin (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:malena:deep-red",
    "person": "Malena",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "Prosperity St, workbench — Belville",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· Prosperity St · workbench Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-030",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:malena:pink",
    "person": "Malena",
    "variant": "pink",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "Northeastern mountains, fire lookout — Mount Kalaga National Park",
    "areaLead": "Mount Kalaga National Park",
    "pickups": [
      {
        "areaLead": "Mount Kalaga National Park",
        "direction": "· Northeastern mountains · fire lookout GTA Six Map lists another area: Fairyland Forest.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-007",
    "conflict": "GTA Six Map lists another area: Fairyland Forest (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:malena:purple",
    "person": "Malena",
    "variant": "purple",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Hickory Rd, stairs — Emerald Springs",
    "areaLead": "Emerald Springs",
    "pickups": [
      {
        "areaLead": "Emerald Springs",
        "direction": "· Hickory Rd · stairs Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-033",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:monali-a:bronze",
    "person": "MonaLi$a",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Southern hiking trail, men’s restroom — Southern Kelly County",
    "areaLead": "Southern Kelly County",
    "pickups": [
      {
        "areaLead": "Southern Kelly County",
        "direction": "· Southern hiking trail · men’s restroom GTA Six Map lists another area: Buckskin.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-057",
    "conflict": "GTA Six Map lists another area: Buckskin (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:monali-a:gold",
    "person": "MonaLi$a",
    "variant": "gold",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "At the foot of the striped folding chair near the inflatable dinghy, Abismo Key",
    "areaLead": "Abismo Key",
    "pickups": [
      {
        "areaLead": "Abismo Key",
        "direction": "· Abismo Key · chair GTA Six Map lists another area: Leonida Keys. Look at the foot of the striped folding chair near the inflatable dinghy. This capture’s collection menu identifies the gold variant. Pickup, map and card front on GTADB",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-087",
    "conflict": "GTA Six Map lists another area: Leonida Keys (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:monali-a:silver",
    "person": "MonaLi$a",
    "variant": "silver",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Southeastern island, north shore freighter wreck — Featherstone Islands",
    "areaLead": "Featherstone Islands",
    "pickups": [
      {
        "areaLead": "Featherstone Islands",
        "direction": "· Southeastern island · north shore freighter wreck GTA Six Map lists another area: Alligator Point.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-003",
    "conflict": "GTA Six Map lists another area: Alligator Point (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:pricilla-pace:bronze",
    "person": "Pricilla Pace",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Sassafrass Rd, house — Mount Kalaga National Park",
    "areaLead": "Mount Kalaga National Park",
    "pickups": [
      {
        "areaLead": "Mount Kalaga National Park",
        "direction": "· Sassafrass Rd · house GTA Six Map lists another area: Fairyland Forest.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-005",
    "conflict": "GTA Six Map lists another area: Fairyland Forest (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:pricilla-pace:gold",
    "person": "Pricilla Pace",
    "variant": "gold",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Sweetbay Rd, tower — Capri",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Sweetbay Rd · tower Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L3637",
        "hostName": "Leonida Brewing Company"
      }
    ],
    "hostId": "L3637",
    "catalogueId": "card:pricilla-pace-gold",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:pricilla-pace:silver",
    "person": "Pricilla Pace",
    "variant": "silver",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Open crate beside the barrels and steps on the north beach, middle island, Permit Keys",
    "areaLead": "Permit Keys",
    "pickups": [
      {
        "areaLead": "Permit Keys",
        "direction": "· Middle island · north beach book exchange GTA Six Map lists another area: Leonida Keys. On the beach, the pickup photo shows an open crate beside the barrels and steps. Pickup, map and card front on GTADB",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-086",
    "conflict": "GTA Six Map lists another area: Leonida Keys (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:vanessa:bronze",
    "person": "Vanessa",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Northern farm, outhouse — Northern Leonard County",
    "areaLead": "Northern Leonard County",
    "pickups": [
      {
        "areaLead": "Northern Leonard County",
        "direction": "· Northern farm · outhouse GTA Six Map lists another area: Fairyland Forest.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-013",
    "conflict": "GTA Six Map lists another area: Fairyland Forest (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:vanessa:gold",
    "person": "Vanessa",
    "variant": "gold",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Velo Fino Dr, safe — Bayside",
    "areaLead": "Bayside",
    "pickups": [
      {
        "areaLead": "Bayside",
        "direction": "· Velo Fino Dr · safe GTA Six Map lists another area: Bohemia.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-042",
    "conflict": "lorenzone says Bayside (Velo Fino Dr), but the only Uncle Jack's Liquor in the GTADB snapshot (L313) is in Port Gellhorn — area disagreement, not pinned; GTA Six Map lists Bohemia (not used).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:vanessa:silver",
    "person": "Vanessa",
    "variant": "silver",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "SW 8th Ave, roof — Salton",
    "areaLead": "Salton",
    "pickups": [
      {
        "areaLead": "Salton",
        "direction": "· SW 8th Ave · roof GTA Six Map lists another area: Peacock Bay.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-070",
    "conflict": "GTA Six Map lists another area: Peacock Bay (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:zaria-ri-ri-luckett:bronze",
    "person": "Zaria “RI RI” Luckett",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "SR-25, billboard — Balsero",
    "areaLead": "Balsero",
    "pickups": [
      {
        "areaLead": "Balsero",
        "direction": "· SR-25 · billboard GTA Six Map lists another area: Little Cuba.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-050",
    "conflict": "GTA Six Map lists another area: Little Cuba (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:zaria-ri-ri-luckett:gold",
    "person": "Zaria “RI RI” Luckett",
    "variant": "gold",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Southern peninsula, chair on sand — Little Hardin Island",
    "areaLead": "Little Hardin Island",
    "pickups": [
      {
        "areaLead": "Little Hardin Island",
        "direction": "· Southern peninsula · chair on sand GTA Six Map lists another area: Peanut Island.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-014",
    "conflict": "GTA Six Map lists another area: Peanut Island (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:zaria-ri-ri-luckett:silver",
    "person": "Zaria “RI RI” Luckett",
    "variant": "silver",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "South, abandoned yellow railcar — Port Gellhorn",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· South · abandoned yellow railcar Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-025",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:aimie:deep-red",
    "person": "Aimie",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "Marsh, picnic area bench — Buckskin Swamp",
    "areaLead": "Buckskin Swamp",
    "pickups": [
      {
        "areaLead": "Buckskin Swamp",
        "direction": "· Marsh · picnic area bench GTA Six Map lists another area: Emerald Springs.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-043",
    "conflict": "GTA Six Map lists another area: Emerald Springs (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:aimie:pink",
    "person": "Aimie",
    "variant": "pink",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "On top of the toilet tank in the bar toilet stall at The Rusty Anchor, Key Lento",
    "areaLead": "Key Lento",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· Bar toilet stall. The printed name reads Aimie (also indexed as Amie). Area cross-checked At The Rusty Anchor, look on top of the toilet tank. The collection screen identifies pink Aimie. Pickup, map and card front on GTADB",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L325",
        "hostName": "The Rusty Anchor"
      }
    ],
    "hostId": "L325",
    "catalogueId": "loot:guide-rusty-anchor-card",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:aimie:purple",
    "person": "Aimie",
    "variant": "purple",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Vela Rota Dr, house — Capri",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Vela Rota Dr · house Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-052",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:braelynn:deep-red",
    "person": "Braelynn",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "Dirt road, observatory top floor — Northern Kelly County",
    "areaLead": "Northern Kelly County",
    "pickups": [
      {
        "areaLead": "Northern Kelly County",
        "direction": "· Dirt road · observatory top floor GTA Six Map lists another area: Mount Kalaga.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-016",
    "conflict": "GTA Six Map lists another area: Mount Kalaga (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:braelynn:pink",
    "person": "Braelynn",
    "variant": "pink",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "Gellhorn Raceway, Xero Gas sign",
    "areaLead": "Gellhorn",
    "pickups": [
      {
        "areaLead": "Gellhorn",
        "direction": "· Gellhorn Raceway · Xero Gas sign GTA Six Map lists another area: Capri.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L281",
        "hostName": "Gellhorn International Raceway"
      }
    ],
    "hostId": "L281",
    "catalogueId": "card:braelynn-pink",
    "conflict": "GTA Six Map lists another area: Capri (third-party note, not used for placement). Open GTA 6 Map import — host-pinned; cited fbrito record collectible-card-034 sits 608u from the host pin — host wins, disagreement recorded",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:braelynn:purple",
    "person": "Braelynn",
    "variant": "purple",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Bear Hollow Dr, mattress  Joseph. — Millport",
    "areaLead": "Millport",
    "pickups": [
      {
        "areaLead": "Millport",
        "direction": "· Bear Hollow Dr · mattress GTA Six Map lists another area: St. Joseph.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-008",
    "conflict": "GTA Six Map lists another area: St (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:chrissie:deep-red",
    "person": "Chrissie",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "MacAlister mine, red blanket in cave — Moreau",
    "areaLead": "Moreau",
    "pickups": [
      {
        "areaLead": "Moreau",
        "direction": "· MacAlister mine · red blanket in cave GTA Six Map lists another area: Redhill.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L996",
        "hostName": "MacAlister Gold Mine"
      }
    ],
    "hostId": "L996",
    "catalogueId": "card:chrissie-deep-red",
    "conflict": "GTA Six Map lists another area: Redhill (third-party note, not used for placement). Open GTA 6 Map import — host-pinned; cited fbrito record collectible-card-004 sits 850u from the host pin — host wins, disagreement recorded",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:chrissie:pink",
    "person": "Chrissie",
    "variant": "pink",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "Baywood Rd, red trailer armchair — Port Gellhorn",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Baywood Rd · red trailer armchair Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-021",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:chrissie:purple",
    "person": "Chrissie",
    "variant": "purple",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Rail line, cave campsite — Manifest Canyon",
    "areaLead": "Manifest Canyon",
    "pickups": [
      {
        "areaLead": "Manifest Canyon",
        "direction": "· Rail line · cave campsite GTA Six Map lists another area: Bridge Ridge.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-017",
    "conflict": "GTA Six Map lists another area: Bridge Ridge (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:clarissa:bronze",
    "person": "Clarissa",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "NW 3rd Ave, chair — Little Cuba",
    "areaLead": "Little Cuba",
    "pickups": [
      {
        "areaLead": "Little Cuba",
        "direction": "· NW 3rd Ave · chair Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-062",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:clarissa:gold",
    "person": "Clarissa",
    "variant": "gold",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Leonida Industrial Services, lounge chair — Northern Mariana County",
    "areaLead": "Northern Mariana County",
    "pickups": [
      {
        "areaLead": "Northern Mariana County",
        "direction": "· Leonida Industrial Services · lounge chair GTA Six Map lists another area: Goliath.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-071",
    "conflict": "GTA Six Map lists another area: Goliath (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:clarissa:silver",
    "person": "Clarissa",
    "variant": "silver",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Northwestern peninsula, yellow villa garage — Capri",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Northwestern peninsula · yellow villa garage Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-051",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:georgia:deep-red",
    "person": "Georgia",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "Forest Mill Rd, lounge chair  Joseph. — Millport",
    "areaLead": "Millport",
    "pickups": [
      {
        "areaLead": "Millport",
        "direction": "· Forest Mill Rd · lounge chair GTA Six Map lists another area: St. Joseph.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-011",
    "conflict": "GTA Six Map lists another area: St (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:georgia:pink",
    "person": "Georgia",
    "variant": "pink",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "NW 11th St, mattress — La Perle",
    "areaLead": "La Perle",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· NW 11th St · mattress GTA Six Map lists another area: Little Cuba.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-041",
    "conflict": "GTA Six Map lists another area: Little Cuba (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:georgia:purple",
    "person": "Georgia",
    "variant": "purple",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Boxes in the storage area behind the main building of Steven Strachan Construction, Sunbelt Highway, Key Lento",
    "areaLead": "Key Lento",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· Find Steven Strachan Construction on Sunbelt Highway. Look at the boxes in the storage area behind the main building. Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-084",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:jesenia:bronze",
    "person": "Jesenia",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "SR-120, lounge chair — Balsero",
    "areaLead": "Balsero",
    "pickups": [
      {
        "areaLead": "Balsero",
        "direction": "· SR-120 · lounge chair GTA Six Map lists another area: Belville.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-037",
    "conflict": "GTA Six Map lists another area: Belville (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:jesenia:gold",
    "person": "Jesenia",
    "variant": "gold",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Northwestern coast, villa TV stand — Vespucci Island",
    "areaLead": "Vespucci Island",
    "pickups": [
      {
        "areaLead": "Vespucci Island",
        "direction": "· Northwestern coast · villa TV stand GTA Six Map lists another area: Rialto Islands.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-039",
    "conflict": "GTA Six Map lists another area: Rialto Islands (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:jesenia:silver",
    "person": "Jesenia",
    "variant": "silver",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Red circular table surrounded by short log stools on the beach, sandbar off the north coast, Permit Keys",
    "areaLead": "Permit Keys",
    "pickups": [
      {
        "areaLead": "Permit Keys",
        "direction": "· Sandbar off north coast · parasol GTA Six Map lists another area: Leonida Keys. On the beach, look for the red circular table surrounded by short log stools. Pickup, map and card front on GTADB",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-083",
    "conflict": "GTA Six Map lists another area: Leonida Keys (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:julia:bronze",
    "person": "Julia",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Airfield, control tower shack — Wild Hog Point",
    "areaLead": "Wild Hog Point",
    "pickups": [
      {
        "areaLead": "Wild Hog Point",
        "direction": "· Airfield · control tower shack GTA Six Map lists another area: Port Gellhorn.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L3764",
        "hostName": "Wild Hog Airfield ATC Tower"
      }
    ],
    "hostId": "L3764",
    "catalogueId": "card:julia-bronze",
    "conflict": "GTA Six Map lists another area: Port Gellhorn (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:julia:gold",
    "person": "Julia",
    "variant": "gold",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Huevo St, roof — Ocean Beach",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Huevo St · roof Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-053",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:julia:silver",
    "person": "Julia",
    "variant": "silver",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "SW 5th Ave, roof — Peacock Bay",
    "areaLead": "Peacock Bay",
    "pickups": [
      {
        "areaLead": "Peacock Bay",
        "direction": "· SW 5th Ave · roof Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-073",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:lavinia:deep-red",
    "person": "Lavinia",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "Xero Draper Refinery Engineering Maintenance, desk — Draper Island",
    "areaLead": "Draper Island",
    "pickups": [
      {
        "areaLead": "Draper Island",
        "direction": "· Xero Draper Refinery Engineering Maintenance · desk Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-015",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:lavinia:pink",
    "person": "Lavinia",
    "variant": "pink",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "Chestnut Dr, barrel  Joseph. — Millport",
    "areaLead": "Millport",
    "pickups": [
      {
        "areaLead": "Millport",
        "direction": "· Chestnut Dr · barrel GTA Six Map lists another area: St. Joseph.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-010",
    "conflict": "GTA Six Map lists another area: St (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:lavinia:purple",
    "person": "Lavinia",
    "variant": "purple",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Southern river, wrecked red railcar — Moreau",
    "areaLead": "Moreau",
    "pickups": [
      {
        "areaLead": "Moreau",
        "direction": "· Southern river · wrecked red railcar GTA Six Map lists another area: Redhill.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-006",
    "conflict": "GTA Six Map lists another area: Redhill (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:lenora:deep-red",
    "person": "Lenora",
    "variant": "Deep Red",
    "variantAlias": "dark red",
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "deep red"
    },
    "placement": "pinned",
    "spotDescription": "Bayside Dr, sofa — Tequesta Retreat",
    "areaLead": "Tequesta Retreat",
    "pickups": [
      {
        "areaLead": "Tequesta Retreat",
        "direction": "· Bayside Dr · sofa Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-hidden-package-006",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:lenora:pink",
    "person": "Lenora",
    "variant": "pink",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "Rialto Cswy, table — Rockridge",
    "areaLead": "Rockridge",
    "pickups": [
      {
        "areaLead": "Rockridge",
        "direction": "· Rialto Cswy · table GTA Six Map lists another area: Little Cuba.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-046",
    "conflict": "GTA Six Map lists another area: Little Cuba (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:lenora:purple",
    "person": "Lenora",
    "variant": "purple",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "SW 4th Ave, stairs — Tequesta",
    "areaLead": "Tequesta",
    "pickups": [
      {
        "areaLead": "Tequesta",
        "direction": "· SW 4th Ave · stairs GTA Six Map lists another area: Little Cuba.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-068",
    "conflict": "GTA Six Map lists another area: Little Cuba (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:louise:bronze",
    "person": "Louise",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Westbrook Dr, roof — Salton",
    "areaLead": "Salton",
    "pickups": [
      {
        "areaLead": "Salton",
        "direction": "· Westbrook Dr · roof GTA Six Map lists another area: Little Cuba.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-066",
    "conflict": "GTA Six Map lists another area: Little Cuba (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:louise:gold",
    "person": "Louise",
    "variant": "gold",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "NW 15th Ave, tower — Balsero",
    "areaLead": "Balsero",
    "pickups": [
      {
        "areaLead": "Balsero",
        "direction": "· NW 15th Ave · tower GTA Six Map lists another area: Little Cuba.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-055",
    "conflict": "GTA Six Map lists another area: Little Cuba (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:louise:silver",
    "person": "Louise",
    "variant": "silver",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Southeast of Lake Leonida, rest area restroom — Belville",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· Southeast of Lake Leonida · rest area restroom GTA Six Map lists another area: Lake Leonida.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-019",
    "conflict": "GTA Six Map lists another area: Lake Leonida (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:meghan:bronze",
    "person": "Meghan",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "NE 3rd Ave, shelf — Crosstown",
    "areaLead": "Crosstown",
    "pickups": [
      {
        "areaLead": "Crosstown",
        "direction": "· NE 3rd Ave · shelf GTA Six Map lists another area: Bohemia.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L539",
        "hostName": "Vice City Pawn"
      }
    ],
    "hostId": "L539",
    "catalogueId": "card:meghan-bronze",
    "conflict": "GTA Six Map lists another area: Bohemia (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:meghan:gold",
    "person": "Meghan",
    "variant": "gold",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "US-183, tower",
    "areaLead": "US-183",
    "pickups": [
      {
        "areaLead": "US-183",
        "direction": "· US-183 · tower GTA Six Map lists another area: Buckskin.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-044",
    "conflict": "GTA Six Map lists another area: Buckskin (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:meghan:silver",
    "person": "Meghan",
    "variant": "silver",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Southern seawall, garden gnome near mattress — Waning Sands",
    "areaLead": "Waning Sands",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· Southern seawall · garden gnome near mattress GTA Six Map lists another area: Osborn Reef.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-027",
    "conflict": "GTA Six Map lists another area: Osborn Reef (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:serena:bronze",
    "person": "Serena",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Forest Mill Rd, sofa — Mount Kalaga National Park",
    "areaLead": "Mount Kalaga National Park",
    "pickups": [
      {
        "areaLead": "Mount Kalaga National Park",
        "direction": "· Forest Mill Rd · sofa GTA Six Map lists another area: Fairyland Forest.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-009",
    "conflict": "GTA Six Map lists another area: Fairyland Forest (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:serena:gold",
    "person": "Serena",
    "variant": "gold",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Palladia Ln, garage — Peacock Estates",
    "areaLead": "Peacock Estates",
    "pickups": [
      {
        "areaLead": "Peacock Estates",
        "direction": "· Palladia Ln · garage Area cross-checked GTA Six Map lists another area: Peacock Bay.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-077",
    "conflict": "GTA Six Map lists another area: Peacock Bay (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:serena:silver",
    "person": "Serena",
    "variant": "silver",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Beach southwest of Grayson, brown armchair",
    "areaLead": "Grayson",
    "pickups": [
      {
        "areaLead": "Grayson",
        "direction": "· Beach southwest of Grayson · brown armchair GTA Six Map lists another area: Redhill.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-hidden-package-005",
    "conflict": "GTA Six Map lists another area: Redhill (third-party note, not used for placement).",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:captain-kreuks:blue",
    "person": "Captain Kreuks",
    "variant": "blue",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Parking area on Del Rio Blvd, La Perle",
    "areaLead": "La Perle - Del Rio Blvd",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· Del Rio Blvd · parking area Also recorded by PowerPyx as Captain Kreuks.",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-009",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:captain-kreuks:maroon",
    "person": "Captain Kreuks",
    "variant": "Maroon",
    "variantAlias": "burgundy",
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "maroon"
    },
    "placement": "area-known",
    "spotDescription": "Dispenser on Ocean Sound Rd, Corsair Key",
    "areaLead": "Corsair Key - Ocean Sound Rd",
    "pickups": [
      {
        "areaLead": "Corsair Key",
        "direction": "· Ocean Sound Rd · dispenser",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:captain-kreuks:purple",
    "person": "Captain Kreuks",
    "variant": "purple",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "area-known",
    "spotDescription": "House on NW 11th Pl, La Perle",
    "areaLead": "La Perle - NW 11th Pl",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· NW 11th Pl · house",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:death-of-swallow:blue",
    "person": "Death of Swallow",
    "variant": "blue",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Bookshelf on Surfside Dr, Key Lento",
    "areaLead": "Key Lento - Surfside Dr",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· Surfside Dr · bookshelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-024",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:death-of-swallow:maroon",
    "person": "Death of Swallow",
    "variant": "Maroon",
    "variantAlias": "burgundy",
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "maroon"
    },
    "placement": "pinned",
    "spotDescription": "House on SW 9th Ave, Southside",
    "areaLead": "Southside - SW 9th Ave",
    "pickups": [
      {
        "areaLead": "Southside",
        "direction": "· SW 9th Ave · house",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-025",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:death-of-swallow:purple",
    "person": "Death of Swallow",
    "variant": "purple",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "area-known",
    "spotDescription": "Hotel on NW 8th St, Crosstown",
    "areaLead": "Crosstown - NW 8th St",
    "pickups": [
      {
        "areaLead": "Crosstown",
        "direction": "· NW 8th St · hotel",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:diddler:blue",
    "person": "Diddler",
    "variant": "blue",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Locker beneath bleachers at the Bay, Gloriana Key",
    "areaLead": "Gloriana Key - Bay",
    "pickups": [
      {
        "areaLead": "Gloriana Key",
        "direction": "· Bay · locker beneath bleachers",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-034",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:diddler:maroon",
    "person": "Diddler",
    "variant": "Maroon",
    "variantAlias": "burgundy",
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "maroon"
    },
    "placement": "pinned",
    "spotDescription": "Tower on Terrapin Rd, Capri",
    "areaLead": "Capri - Terrapin Rd",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Terrapin Rd · tower",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-027",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:diddler:purple",
    "person": "Diddler",
    "variant": "purple",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Billboard on NE 2nd Ave, Crosstown",
    "areaLead": "Crosstown - NE 2nd Ave",
    "pickups": [
      {
        "areaLead": "Crosstown",
        "direction": "· NE 2nd Ave · billboard",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-026",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:disastrous-duo:blue",
    "person": "Disastrous Duo",
    "variant": "blue",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "area-known",
    "spotDescription": "Roof on Cedar St, Ambrosia",
    "areaLead": "Ambrosia - Cedar St",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Cedar St · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:disastrous-duo:maroon",
    "person": "Disastrous Duo",
    "variant": "Maroon",
    "variantAlias": "burgundy",
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "maroon"
    },
    "placement": "area-known",
    "spotDescription": "Sofa and crate on the west beach, Southern Kelly County",
    "areaLead": "Southern Kelly County - west beach",
    "pickups": [
      {
        "areaLead": "Southern Kelly County",
        "direction": "· West beach · sofa and crate",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:disastrous-duo:purple",
    "person": "Disastrous Duo",
    "variant": "purple",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Terrace on Terrapin Rd, Northern Mariana County",
    "areaLead": "Northern Mariana County - Terrapin Rd",
    "pickups": [
      {
        "areaLead": "Northern Mariana County",
        "direction": "· Terrapin Rd · terrace",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-035",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:ifred:blue",
    "person": "iFred",
    "variant": "blue",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Dock at Tamarro Spritz, Downtown",
    "areaLead": "Downtown - Tamarro Spritz",
    "pickups": [
      {
        "areaLead": "Downtown",
        "direction": "· Tamarro Spritz · dock",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-037",
    "conflict": "named host Tamarro exists only as GTADB L2894 Tamarro, Ocean Beach; guide says Downtown - area disagrees, not pinned",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:ifred:maroon",
    "person": "iFred",
    "variant": "Maroon",
    "variantAlias": "burgundy",
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "maroon"
    },
    "placement": "area-known",
    "spotDescription": "Barn on Kingston Rd, Watson Bay",
    "areaLead": "Watson Bay - Kingston Rd",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Kingston Rd · barn",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:ifred:purple",
    "person": "iFred",
    "variant": "purple",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Bookshelf on NW 21st Pl, Balsero",
    "areaLead": "Balsero - NW 21st Pl",
    "pickups": [
      {
        "areaLead": "Balsero",
        "direction": "· NW 21st Pl · bookshelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-032",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:illuminaughty:blue",
    "person": "Illuminaughty",
    "variant": "blue",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "area-known",
    "spotDescription": "Refrigerator on Formosa Ave, Hamlet",
    "areaLead": "Hamlet - Formosa Ave",
    "pickups": [
      {
        "areaLead": "Hamlet",
        "direction": "· Formosa Ave · refrigerator",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:illuminaughty:maroon",
    "person": "Illuminaughty",
    "variant": "Maroon",
    "variantAlias": "burgundy",
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "maroon"
    },
    "placement": "pinned",
    "spotDescription": "Roof on NE 5th Ave, Stockyard",
    "areaLead": "Stockyard - NE 5th Ave",
    "pickups": [
      {
        "areaLead": "Stockyard",
        "direction": "· NE 5th Ave · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-028",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:illuminaughty:purple",
    "person": "Illuminaughty",
    "variant": "purple",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "area-known",
    "spotDescription": "Garage on Grace Ave, Belville",
    "areaLead": "Belville - Grace Ave",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· Grace Ave · garage Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:ratface:blue",
    "person": "Ratface",
    "variant": "blue",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "area-known",
    "spotDescription": "Python enclosure at Marshland Animal Park, Gullet Marsh",
    "areaLead": "Gullet Marsh - Marshland Animal Park",
    "pickups": [
      {
        "areaLead": "Gullet Marsh",
        "direction": "· Marshland Animal Park · python enclosure",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:ratface:maroon",
    "person": "Ratface",
    "variant": "Maroon",
    "variantAlias": "burgundy",
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "maroon"
    },
    "placement": "area-known",
    "spotDescription": "Roof on Coconut Cove Ct, Capri",
    "areaLead": "Capri - Coconut Cove Ct",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Coconut Cove Ct · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:ratface:purple",
    "person": "Ratface",
    "variant": "purple",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "House on Tidewater Dr, Eastern Lummox County",
    "areaLead": "Eastern Lummox County - Tidewater Dr",
    "pickups": [
      {
        "areaLead": "Eastern Lummox County",
        "direction": "· Tidewater Dr · house",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-033",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:silver-age-betrayal:blue",
    "person": "Silver Age Betrayal",
    "variant": "blue",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Microwave at LTD on Seaview Blvd, Ocean Beach",
    "areaLead": "Ocean Beach - LTD, Seaview Blvd",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· LTD, Seaview Blvd · microwave",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-038",
    "conflict": "named host LTD exists only as GTADB L260 LTD Gas Station, Hamlet; guide says Ocean Beach (Seaview Blvd) - area disagrees, not pinned",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:silver-age-betrayal:maroon",
    "person": "Silver Age Betrayal",
    "variant": "Maroon",
    "variantAlias": "burgundy",
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "maroon"
    },
    "placement": "area-known",
    "spotDescription": "Restrooms on Loggerhead Rd, Bobcat Key",
    "areaLead": "Bobcat Key - Loggerhead Rd",
    "pickups": [
      {
        "areaLead": "Bobcat Key",
        "direction": "· Loggerhead Rd · restrooms",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:silver-age-betrayal:purple",
    "person": "Silver Age Betrayal",
    "variant": "purple",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "House on Buckeye Rd, Watson Bay",
    "areaLead": "Watson Bay - Buckeye Rd",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Buckeye Rd · house",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-012",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:swallow:blue",
    "person": "Swallow",
    "variant": "blue",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Terrace on SW 6th St, Salton",
    "areaLead": "Salton - SW 6th St",
    "pickups": [
      {
        "areaLead": "Salton",
        "direction": "· SW 6th St · terrace",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-029",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:swallow:maroon",
    "person": "Swallow",
    "variant": "Maroon",
    "variantAlias": "burgundy",
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "maroon"
    },
    "placement": "pinned",
    "spotDescription": "Station at Vice City Airport Village, Salton",
    "areaLead": "Salton - Vice City Airport Village",
    "pickups": [
      {
        "areaLead": "Salton",
        "direction": "· Vice City Airport Village · station",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-036",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:swallow:purple",
    "person": "Swallow",
    "variant": "purple",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "area-known",
    "spotDescription": "Cassette rack in a trailer on Gellhorn Ave, Port Gellhorn",
    "areaLead": "Port Gellhorn - Gellhorn Ave",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Gellhorn Ave · trailer cassette rack",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:the-ratster:blue",
    "person": "The Ratster",
    "variant": "blue",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Microwave at LTD on Vela Rota Dr, Capri",
    "areaLead": "Capri - LTD, Vela Rota Dr",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· LTD, Vela Rota Dr · microwave",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-006",
    "conflict": "named host LTD exists only as GTADB L260 LTD Gas Station, Hamlet; guide says Capri (Vela Rota Dr) - area disagrees, not pinned",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:the-ratster:maroon",
    "person": "The Ratster",
    "variant": "Maroon",
    "variantAlias": "burgundy",
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "maroon"
    },
    "placement": "area-known",
    "spotDescription": "Sewer access gate in the south, Eastern Lummox County",
    "areaLead": "Eastern Lummox County - south",
    "pickups": [
      {
        "areaLead": "Eastern Lummox County",
        "direction": "· South · sewer access gate",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:the-ratster:purple",
    "person": "The Ratster",
    "variant": "purple",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Rail at the top of the swamp lookout, Buckskin Swamp",
    "areaLead": "Buckskin Swamp - swamp lookout",
    "pickups": [
      {
        "areaLead": "Buckskin Swamp",
        "direction": "· Climb the swamp lookout and check the rail at the top. Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-004",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:todd:blue",
    "person": "Todd",
    "variant": "blue",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "area-known",
    "spotDescription": "Utility closet at Xero on Bayside Dr, Tequesta",
    "areaLead": "Tequesta - Xero, Bayside Dr",
    "pickups": [
      {
        "areaLead": "Tequesta",
        "direction": "· Xero, Bayside Dr · utility closet",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": "Held from the Open GTA 6 Map import: bucket C2, gtatown does not show it",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:todd:maroon",
    "person": "Todd",
    "variant": "Maroon",
    "variantAlias": "burgundy",
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "maroon"
    },
    "placement": "pinned",
    "spotDescription": "Table on Fairview Dr, Waning Sands",
    "areaLead": "Waning Sands - Fairview Dr",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· Fairview Dr · table",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-030",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:todd:purple",
    "person": "Todd",
    "variant": "purple",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "area-known",
    "spotDescription": "Lookout tower on the south beach, Richard Barebone State Park",
    "areaLead": "Richard Barebone State Park - south beach",
    "pickups": [
      {
        "areaLead": "Richard Barebone State Park",
        "direction": "· South beach · lookout tower",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": "Held from the Open GTA 6 Map import: bucket C2, gtatown does not show it",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:wokester:blue",
    "person": "Wokester",
    "variant": "blue",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Bench on Sunbelt Hwy at Wonder Whale, against a wall painted with sunflowers, a sun and a peace sign, Key Lento",
    "areaLead": "Key Lento - Wonder Whale, Sunbelt Hwy",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· Sunbelt Hwy · bench Area cross-checked The Wonder Whale bench stands against a wall painted with sunflowers, a sun and a peace sign. Pickup, map and card front on GTADB",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L332",
        "hostName": "Wonder Whale"
      }
    ],
    "hostId": "L332",
    "catalogueId": "card:wokester-blue",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:wokester:maroon",
    "person": "Wokester",
    "variant": "Maroon",
    "variantAlias": "burgundy",
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "maroon"
    },
    "placement": "pinned",
    "spotDescription": "Filing cabinet on Seabell Ave, Watson Bay",
    "areaLead": "Watson Bay - Seabell Ave",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Seabell Ave · filing cabinet",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-039",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:the-legends-of-ratface:wokester:purple",
    "person": "Wokester",
    "variant": "purple",
    "variantAlias": null,
    "setId": "the-legends-of-ratface",
    "setName": "The Legends of Ratface",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "purple"
    },
    "placement": "pinned",
    "spotDescription": "Shelf on Del Rio Blvd, La Perle",
    "areaLead": "La Perle - Del Rio Blvd",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· Del Rio Blvd · shelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-legends-of-ratface-019",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:flamer:blue",
    "person": "Flamer",
    "variant": "blue",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Railing at the northern dock, Catalan Key",
    "areaLead": "Catalan Key - northern dock",
    "pickups": [
      {
        "areaLead": "Catalan Key",
        "direction": "· Northern dock · railing",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-027",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:flamer:red",
    "person": "Flamer",
    "variant": "red",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "pinned",
    "spotDescription": "Bookshelf at Williams Guest House, Grayson",
    "areaLead": "Grayson - Williams Guest House",
    "pickups": [
      {
        "areaLead": "Grayson",
        "direction": "· Williams Guest House · bookshelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L3783",
        "hostName": "Williams Guest House"
      }
    ],
    "hostId": "L3783",
    "catalogueId": "card:flamer-red",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:flamer:white",
    "person": "Flamer",
    "variant": "white",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "white"
    },
    "placement": "area-known",
    "spotDescription": "Restrooms at Paradise RV Park, Watson Bay",
    "areaLead": "Watson Bay - Paradise RV Park",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Paradise RV Park · restrooms",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:flamer-right-wing:blue",
    "person": "Flamer & Right Wing",
    "variant": "blue",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "area-known",
    "spotDescription": "Desk at Xero Food Mart, Ambrosia",
    "areaLead": "Ambrosia - Xero Food Mart",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Xero Food Mart · desk",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": "Held from the Open GTA 6 Map import: bucket D, gtatown does not show it",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:flamer-right-wing:red",
    "person": "Flamer & Right Wing",
    "variant": "red",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "area-known",
    "spotDescription": "Above the entrance of an abandoned office building, north Capri",
    "areaLead": "Capri - north, abandoned office building",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· North · above abandoned office building entrance",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": "Held from the Open GTA 6 Map import: bucket D, gtatown does not show it",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:flamer-right-wing:white",
    "person": "Flamer & Right Wing",
    "variant": "white",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "white"
    },
    "placement": "area-known",
    "spotDescription": "Key rack in the garage of the southern white house, Waning Sands",
    "areaLead": "Waning Sands - southern white house",
    "pickups": [
      {
        "areaLead": "Waning Sands",
        "direction": "· Southern white house · garage key rack",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": "Held from the Open GTA 6 Map import: bucket D, gtatown does not show it",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:great-uncle-sam:blue",
    "person": "Great Uncle Sam",
    "variant": "blue",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "area-known",
    "spotDescription": "Workbench in the garage opposite the farm, Northern Leonard County",
    "areaLead": "Northern Leonard County - opposite farm",
    "pickups": [
      {
        "areaLead": "Northern Leonard County",
        "direction": "· Opposite farm · garage workbench",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:great-uncle-sam:red",
    "person": "Great Uncle Sam",
    "variant": "red",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "pinned",
    "spotDescription": "Restrooms on SW 4th St, Washington Beach (Oldby Island)",
    "areaLead": "Washington Beach (Oldby Island) - SW 4th St",
    "pickups": [
      {
        "areaLead": "Washington Beach (Oldby Island)",
        "direction": "· SW 4th St · restrooms",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-029",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:great-uncle-sam:white",
    "person": "Great Uncle Sam",
    "variant": "white",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "white"
    },
    "placement": "area-known",
    "spotDescription": "Entrance railing at Anakala Sam's, Ambrosia",
    "areaLead": "Ambrosia - Anakala Sam's",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Anakala Sam’s · entrance railing",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:great-uncle-sam-president-blunt:blue",
    "person": "Great Uncle Sam & President Blunt",
    "variant": "blue",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "area-known",
    "spotDescription": "Chair at Domestic Timbers, Balsero",
    "areaLead": "Balsero - Domestic Timbers",
    "pickups": [
      {
        "areaLead": "Balsero",
        "direction": "· Domestic Timbers · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": "Held from the Open GTA 6 Map import: bucket D, gtatown does not show it",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:great-uncle-sam-president-blunt:red",
    "person": "Great Uncle Sam & President Blunt",
    "variant": "red",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "area-known",
    "spotDescription": "Restrooms on Emerald Springs Dr, Emerald Springs",
    "areaLead": "Emerald Springs - Emerald Springs Dr",
    "pickups": [
      {
        "areaLead": "Emerald Springs",
        "direction": "· Emerald Springs Dr · restrooms",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": "Held from the Open GTA 6 Map import: bucket D, gtatown does not show it",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:great-uncle-sam-president-blunt:white",
    "person": "Great Uncle Sam & President Blunt",
    "variant": "white",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "white"
    },
    "placement": "area-known",
    "spotDescription": "Washing machine in the northern trailer, Port Gellhorn",
    "areaLead": "Port Gellhorn - northern trailer",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Northern trailer · washing machine",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": "Held from the Open GTA 6 Map import: bucket D, gtatown does not show it",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:immigrantasma:blue",
    "person": "Immigrantasma",
    "variant": "blue",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Water tower with US flag in north Ambrosia",
    "areaLead": "Ambrosia - north, water tower",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· North · water tower with US flag",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-009",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:immigrantasma:red",
    "person": "Immigrantasma",
    "variant": "red",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "pinned",
    "spotDescription": "Restrooms at Abismo Key",
    "areaLead": "Abismo Key",
    "pickups": [
      {
        "areaLead": "Abismo Key",
        "direction": "· Abismo Key · restrooms",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-002",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:immigrantasma:white",
    "person": "Immigrantasma",
    "variant": "white",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "white"
    },
    "placement": "pinned",
    "spotDescription": "Refrigerator on NW 10th Ave, La Perle",
    "areaLead": "La Perle - NW 10th Ave",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· NW 10th Ave · refrigerator",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-017",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:president-blunt:blue",
    "person": "President Blunt",
    "variant": "blue",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Sofa in Port Gellhorn",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Port Gellhorn · sofa",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-011",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:president-blunt:red",
    "person": "President Blunt",
    "variant": "red",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "pinned",
    "spotDescription": "Billboard on I-404, Port Gellhorn",
    "areaLead": "Port Gellhorn - I-404",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· I-404 · billboard",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-023",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:president-blunt:white",
    "person": "President Blunt",
    "variant": "white",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "white"
    },
    "placement": "pinned",
    "spotDescription": "Restaurant at Cor Blimey!, Capri",
    "areaLead": "Capri - Cor Blimey!",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· Cor Blimey! · restaurant",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-030",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:president-quinn:blue",
    "person": "President Quinn",
    "variant": "blue",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Billboard on US-628, Eastern Lummox County",
    "areaLead": "Eastern Lummox County - US-628",
    "pickups": [
      {
        "areaLead": "Eastern Lummox County",
        "direction": "· US-628 · billboard",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-024",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:president-quinn:red",
    "person": "President Quinn",
    "variant": "red",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "pinned",
    "spotDescription": "Roof on Vine St, Hamlet",
    "areaLead": "Hamlet - Vine St",
    "pickups": [
      {
        "areaLead": "Hamlet",
        "direction": "· Vine St · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-007",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:president-quinn:white",
    "person": "President Quinn",
    "variant": "white",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "white"
    },
    "placement": "pinned",
    "spotDescription": "Computer in the southwestern hunter's warehouse, Mount Kalaga National Park",
    "areaLead": "Mount Kalaga National Park - southwestern hunter's warehouse",
    "pickups": [
      {
        "areaLead": "Mount Kalaga National Park",
        "direction": "· Southwestern hunter’s warehouse · computer",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-015",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:right-wing:blue",
    "person": "Right Wing",
    "variant": "blue",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Old tower west of Leonida State Prison, Gellhorn",
    "areaLead": "Gellhorn - west of Leonida State Prison",
    "pickups": [
      {
        "areaLead": "Gellhorn",
        "direction": "· West of Leonida State Prison · old tower",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-001",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:right-wing:red",
    "person": "Right Wing",
    "variant": "red",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "pinned",
    "spotDescription": "Table at Bayside Apartments, Bayside",
    "areaLead": "Bayside - Bayside Apartments",
    "pickups": [
      {
        "areaLead": "Bayside",
        "direction": "· Bayside Apartments · table",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L475",
        "hostName": "Bayside Apartments"
      },
      {
        "areaLead": "Grassrivers",
        "direction": "· US-82 · shelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": "L475",
    "catalogueId": "card:right-wing-red",
    "conflict": "Open GTA 6 Map import — Two Open GTA 6 Map records claim this slot (card-right-wing-004, card-right-wing-014) — held for arbitration; host position kept.",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:right-wing:white",
    "person": "Right Wing",
    "variant": "white",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "white"
    },
    "placement": "pinned",
    "spotDescription": "Terrace on Forest Mill Rd, Mount Kalaga National Park",
    "areaLead": "Mount Kalaga National Park - Forest Mill Rd",
    "pickups": [
      {
        "areaLead": "Mount Kalaga National Park",
        "direction": "· Forest Mill Rd · terrace",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-012",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:right-wing-vs-left-wing:blue",
    "person": "Right Wing vs Left Wing",
    "variant": "blue",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Barrel on the back terrace at Beachie's, Watson Bay",
    "areaLead": "Watson Bay - Beachie's",
    "pickups": [
      {
        "areaLead": "Watson Bay",
        "direction": "· Beachie’s · back terrace barrel",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-107",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:right-wing-vs-left-wing:red",
    "person": "Right Wing vs Left Wing",
    "variant": "red",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "pinned",
    "spotDescription": "Bumper car at the abandoned amusement park, Port Gellhorn",
    "areaLead": "Port Gellhorn - abandoned amusement park",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Abandoned amusement park · bumper car",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-006",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:right-wing-vs-left-wing:white",
    "person": "Right Wing vs Left Wing",
    "variant": "white",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "white"
    },
    "placement": "pinned",
    "spotDescription": "Restroom at the northern construction site, Millport",
    "areaLead": "Millport - northern construction site",
    "pickups": [
      {
        "areaLead": "Millport",
        "direction": "· Northern construction site · restroom",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-018",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:right-wings-truck:blue",
    "person": "Right Wing's Truck",
    "variant": "blue",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Shelf at Ambrosia Raceway, Ambrosia",
    "areaLead": "Ambrosia - Ambrosia Raceway",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Ambrosia Raceway · shelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L590",
        "hostName": "Ambrosia Raceway Park"
      }
    ],
    "hostId": "L590",
    "catalogueId": "card:right-wings-truck-blue",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:right-wings-truck:red",
    "person": "Right Wing's Truck",
    "variant": "red",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "pinned",
    "spotDescription": "Upper grandstand at Thrillbilly Mud Club, Frogswater",
    "areaLead": "Frogswater - Thrillbilly Mud Club",
    "pickups": [
      {
        "areaLead": "Frogswater",
        "direction": "· Thrillbilly Mud Club · upper grandstand",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L512",
        "hostName": "Thrillbilly Mud Club"
      }
    ],
    "hostId": "L512",
    "catalogueId": "card:right-wings-truck-red",
    "conflict": "Open GTA 6 Map import — host-pinned; cited fbrito record card-right-wing-028 sits 236u from the host pin — host wins, disagreement recorded",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:right-wings-truck:white",
    "person": "Right Wing's Truck",
    "variant": "white",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "white"
    },
    "placement": "pinned",
    "spotDescription": "Terrace at Farmers Walk, Bluegrass",
    "areaLead": "Bluegrass - Farmers Walk",
    "pickups": [
      {
        "areaLead": "Bluegrass",
        "direction": "· Farmers Walk · terrace",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-031",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:the-educated-woman:blue",
    "person": "The Educated Woman",
    "variant": "blue",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Desk at Globe Oil, Crosstown",
    "areaLead": "Crosstown - Globe Oil",
    "pickups": [
      {
        "areaLead": "Crosstown",
        "direction": "· Globe Oil · desk",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-025",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:the-educated-woman:red",
    "person": "The Educated Woman",
    "variant": "red",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "area-known",
    "spotDescription": "Lounge chair on the eastern rooftop, Stockyard",
    "areaLead": "Stockyard - eastern rooftop",
    "pickups": [
      {
        "areaLead": "Stockyard",
        "direction": "· Eastern rooftop · lounge chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:the-educated-woman:white",
    "person": "The Educated Woman",
    "variant": "white",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "white"
    },
    "placement": "pinned",
    "spotDescription": "Trailer steps on Scuttlebutt Dr, Key Lento",
    "areaLead": "Key Lento - Scuttlebutt Dr",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· Scuttlebutt Dr · trailer steps",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-003",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:they:blue",
    "person": "They",
    "variant": "blue",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "pinned",
    "spotDescription": "Refrigerator on NW 3rd St, Little Cuba",
    "areaLead": "Little Cuba - NW 3rd St",
    "pickups": [
      {
        "areaLead": "Little Cuba",
        "direction": "· NW 3rd St · refrigerator",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-032",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:they:red",
    "person": "They",
    "variant": "red",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "pinned",
    "spotDescription": "Billboard at Tisha-Wocka market, Balsero",
    "areaLead": "Balsero - Tisha-Wocka market",
    "pickups": [
      {
        "areaLead": "Balsero",
        "direction": "· Tisha-Wocka market · billboard",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L1006",
        "hostName": "Tisha-Wocka Flea Market"
      }
    ],
    "hostId": "L1006",
    "catalogueId": "card:they-red",
    "conflict": "Open GTA 6 Map import — host-pinned; cited fbrito record card-right-wing-034 sits 173u from the host pin — host wins, disagreement recorded",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:right-wing-americas-hero:they:white",
    "person": "They",
    "variant": "white",
    "variantAlias": null,
    "setId": "right-wing-americas-hero",
    "setName": "Right Wing: America's Hero",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "white"
    },
    "placement": "pinned",
    "spotDescription": "Refrigerator on Aralia Court, Peacock Bay",
    "areaLead": "Peacock Bay - Aralia Court",
    "pickups": [
      {
        "areaLead": "Peacock Bay",
        "direction": "· Aralia Court · refrigerator",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-right-wing-026",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:capsule:light-blue",
    "person": "Capsule",
    "variant": "Light Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "light blue"
    },
    "placement": "pinned",
    "spotDescription": "Chessboard on SW 4th Ave, Tequesta.",
    "areaLead": "Tequesta",
    "pickups": [
      {
        "areaLead": "Tequesta",
        "direction": "· SW 4th Ave · chessboard",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-016",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:capsule:orange",
    "person": "Capsule",
    "variant": "orange",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "orange"
    },
    "placement": "pinned",
    "spotDescription": "Parking lot barrier on the east beach, Belville.",
    "areaLead": "Belville",
    "pickups": [
      {
        "areaLead": "Belville",
        "direction": "· East beach · parking lot barrier",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-021",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:capsule:pink",
    "person": "Capsule",
    "variant": "pink",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "Restrooms on Birch St, Ambrosia.",
    "areaLead": "Ambrosia",
    "pickups": [
      {
        "areaLead": "Ambrosia",
        "direction": "· Birch St · restrooms",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-009",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:diagnosis:light-blue",
    "person": "Diagnosis",
    "variant": "Light Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "light blue"
    },
    "placement": "area-known",
    "spotDescription": "Kitchen off I-97, La Perle.",
    "areaLead": "La Perle",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· I-97 · kitchen",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:diagnosis:orange",
    "person": "Diagnosis",
    "variant": "orange",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "orange"
    },
    "placement": "pinned",
    "spotDescription": "Rooftop nest on the roof of the Grassrivers Visitor Center.",
    "areaLead": "Grassrivers",
    "pickups": [
      {
        "areaLead": "Grassrivers",
        "direction": "· Grassrivers visitor center · rooftop nest",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L625",
        "hostName": "Grassrivers Visitor Center"
      }
    ],
    "hostId": "L625",
    "catalogueId": "card:diagnosis-orange",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:diagnosis:pink",
    "person": "Diagnosis",
    "variant": "pink",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "Billboard off I-97, Bluegrass.",
    "areaLead": "Bluegrass",
    "pickups": [
      {
        "areaLead": "Bluegrass",
        "direction": "· I-97 · billboard",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-023",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:dr-placebo:light-blue",
    "person": "Dr. Placebo",
    "variant": "Light Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "light blue"
    },
    "placement": "area-known",
    "spotDescription": "Shelf on NW 8th Ave, La Perle. Area cross-checked.",
    "areaLead": "La Perle",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· NW 8th Ave · shelf Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:dr-placebo:orange",
    "person": "Dr. Placebo",
    "variant": "orange",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "orange"
    },
    "placement": "area-known",
    "spotDescription": "Garage on Sallow Springs Dr, Western Vice-Dale County.",
    "areaLead": "Western Vice-Dale County",
    "pickups": [
      {
        "areaLead": "Western Vice-Dale County",
        "direction": "· Sallow Springs Dr · garage",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:dr-placebo:pink",
    "person": "Dr. Placebo",
    "variant": "pink",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "Stockroom shelf in the Northern RON station, Bayside.",
    "areaLead": "Bayside",
    "pickups": [
      {
        "areaLead": "Bayside",
        "direction": "· Northern RON station · stockroom shelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-018",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:femi-nemesis:bronze",
    "person": "Femi-Nemesis",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "First viewing platform on the road towards the blimp, beside the blue chair, off Aerostat Rd, Maroon Key.",
    "areaLead": "Maroon Key",
    "pickups": [
      {
        "areaLead": "Maroon Key",
        "direction": "· Aerostat Rd · tower On the road towards the blimp, climb to the first viewing platform and look beside the blue chair. Pickup, map and card front on GTADB",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-collectible-card-100",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:femi-nemesis:gold",
    "person": "Femi-Nemesis",
    "variant": "gold",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "area-known",
    "spotDescription": "Shop on NW 11th St, La Perle.",
    "areaLead": "La Perle",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· NW 11th St · shop",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:femi-nemesis:silver",
    "person": "Femi-Nemesis",
    "variant": "silver",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Washing machine in a trailer on SW 19th St, VCIA. Area cross-checked.",
    "areaLead": "VCIA",
    "pickups": [
      {
        "areaLead": "VCIA",
        "direction": "· SW 19th St · trailer washing machine Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-031",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:fornicator:light-blue",
    "person": "Fornicator",
    "variant": "Light Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "light blue"
    },
    "placement": "pinned",
    "spotDescription": "Barrel inside King Gator Adventure Golf.",
    "areaLead": "King Gator miniature golf",
    "pickups": [
      {
        "areaLead": "King Gator miniature golf",
        "direction": "· King Gator Adventure Golf · barrel",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": "L3785",
        "hostName": "King Gator Adventure Golf"
      }
    ],
    "hostId": "L3785",
    "catalogueId": "card:fornicator-light-blue",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:fornicator:orange",
    "person": "Fornicator",
    "variant": "orange",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "orange"
    },
    "placement": "pinned",
    "spotDescription": "Bin at the side entrance of the Northern Xero station, Southern Kelly County.",
    "areaLead": "Southern Kelly County",
    "pickups": [
      {
        "areaLead": "Southern Kelly County",
        "direction": "· Northern Xero station · side entrance bin",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-comics-001",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:fornicator:pink",
    "person": "Fornicator",
    "variant": "pink",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "area-known",
    "spotDescription": "Sofa on Pitchpole Rd, Gellhorn.",
    "areaLead": "Gellhorn",
    "pickups": [
      {
        "areaLead": "Gellhorn",
        "direction": "· Pitchpole Rd · sofa",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:funny-bones:light-blue",
    "person": "Funny Bones",
    "variant": "Light Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "light blue"
    },
    "placement": "pinned",
    "spotDescription": "Kitchen on NW 24th Pl, Balsero.",
    "areaLead": "Balsero",
    "pickups": [
      {
        "areaLead": "Balsero",
        "direction": "· NW 24th Pl · kitchen",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-026",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:funny-bones:orange",
    "person": "Funny Bones",
    "variant": "orange",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "orange"
    },
    "placement": "area-known",
    "spotDescription": "Chair on Old Post Rd, Port Gellhorn.",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Old Post Rd · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:funny-bones:pink",
    "person": "Funny Bones",
    "variant": "pink",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "Restrooms at Globe Oil, Hamlet.",
    "areaLead": "Hamlet",
    "pickups": [
      {
        "areaLead": "Hamlet",
        "direction": "· Globe Oil · restrooms",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-022",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:general-surgeon:light-blue",
    "person": "General Surgeon",
    "variant": "Light Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "light blue"
    },
    "placement": "pinned",
    "spotDescription": "Garage noticeboard at the 247 station, Western Vice-Dale County.",
    "areaLead": "Western Vice-Dale County",
    "pickups": [
      {
        "areaLead": "Western Vice-Dale County",
        "direction": "· 247 station · garage noticeboard",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-002",
    "conflict": "Only GTADB 247 record is L1670 247 Supermarket, Crosstown, Vice City; guide places the 247 station in Western Vice-Dale County - area disagrees, not pinned.",
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:general-surgeon:orange",
    "person": "General Surgeon",
    "variant": "orange",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "orange"
    },
    "placement": "area-known",
    "spotDescription": "Desk on Palmetto Ave, Hamlet.",
    "areaLead": "Hamlet",
    "pickups": [
      {
        "areaLead": "Hamlet",
        "direction": "· Palmetto Ave · desk",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:general-surgeon:pink",
    "person": "General Surgeon",
    "variant": "pink",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "area-known",
    "spotDescription": "Refrigerator on Orchard Ave, Port Gellhorn.",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Orchard Ave · refrigerator",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:mr-i:light-blue",
    "person": "MR.I",
    "variant": "Light Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "light blue"
    },
    "placement": "pinned",
    "spotDescription": "Barrel on Omega Pkwy, Buckskin Swamp.",
    "areaLead": "Buckskin Swamp",
    "pickups": [
      {
        "areaLead": "Buckskin Swamp",
        "direction": "· Omega Pkwy · barrel",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-030",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:mr-i:orange",
    "person": "MR.I",
    "variant": "orange",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "orange"
    },
    "placement": "pinned",
    "spotDescription": "Chair on NE 1st Ave, Downtown.",
    "areaLead": "Downtown",
    "pickups": [
      {
        "areaLead": "Downtown",
        "direction": "· NE 1st Ave · chair",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-028",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:mr-i:pink",
    "person": "MR.I",
    "variant": "pink",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "Walkway on NE 6th Ave, Decor District.",
    "areaLead": "Decor District",
    "pickups": [
      {
        "areaLead": "Decor District",
        "direction": "· NE 6th Ave · walkway",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-008",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:ratface:bronze",
    "person": "Ratface",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "pinned",
    "spotDescription": "Warehouse on NW 8th Ave, La Perle. Area cross-checked.",
    "areaLead": "La Perle",
    "pickups": [
      {
        "areaLead": "La Perle",
        "direction": "· NW 8th Ave · warehouse Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-012",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:ratface:gold",
    "person": "Ratface",
    "variant": "gold",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Roof on Harborside Ave, Ocean Beach.",
    "areaLead": "Ocean Beach",
    "pickups": [
      {
        "areaLead": "Ocean Beach",
        "direction": "· Harborside Ave · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-027",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:ratface:silver",
    "person": "Ratface",
    "variant": "silver",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Roof on Cicada Ave, Hamlet.",
    "areaLead": "Hamlet",
    "pickups": [
      {
        "areaLead": "Hamlet",
        "direction": "· Cicada Ave · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-003",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:right-wing:bronze",
    "person": "Right Wing",
    "variant": "bronze",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "bronze"
    },
    "placement": "area-known",
    "spotDescription": "Sculpture on Sunbelt Hwy, Key Lento.",
    "areaLead": "Key Lento",
    "pickups": [
      {
        "areaLead": "Key Lento",
        "direction": "· Sunbelt Hwy · sculpture",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:right-wing:gold",
    "person": "Right Wing",
    "variant": "gold",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "gold"
    },
    "placement": "pinned",
    "spotDescription": "Bench on El Joven Blvd, VCIA.",
    "areaLead": "VCIA",
    "pickups": [
      {
        "areaLead": "VCIA",
        "direction": "· El Joven Blvd · bench",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-032",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:right-wing:silver",
    "person": "Right Wing",
    "variant": "silver",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "silver"
    },
    "placement": "pinned",
    "spotDescription": "Crate on SW 5th Ave, Peacock Bay.",
    "areaLead": "Peacock Bay",
    "pickups": [
      {
        "areaLead": "Peacock Bay",
        "direction": "· SW 5th Ave · crate",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-029",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:side-effect:light-blue",
    "person": "Side Effect",
    "variant": "Light Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "light blue"
    },
    "placement": "pinned",
    "spotDescription": "Bedroom on Crescent Ct, Port Gellhorn. Area cross-checked.",
    "areaLead": "Port Gellhorn",
    "pickups": [
      {
        "areaLead": "Port Gellhorn",
        "direction": "· Crescent Ct · bedroom Area cross-checked",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-004",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:side-effect:orange",
    "person": "Side Effect",
    "variant": "orange",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "orange"
    },
    "placement": "area-known",
    "spotDescription": "Restrooms on Northbrook Dr, Rockridge.",
    "areaLead": "Rockridge",
    "pickups": [
      {
        "areaLead": "Rockridge",
        "direction": "· Northbrook Dr · restrooms",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:side-effect:pink",
    "person": "Side Effect",
    "variant": "pink",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "pinned",
    "spotDescription": "Gas station at Finn's Diner, Eastern Lummox County.",
    "areaLead": "Eastern Lummox County",
    "pickups": [
      {
        "areaLead": "Eastern Lummox County",
        "direction": "· Finn's Diner · gas station",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-025",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:vaccerine:light-blue",
    "person": "Vaccerine",
    "variant": "Light Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "light blue"
    },
    "placement": "area-known",
    "spotDescription": "Billboard off I-97, Hamlet.",
    "areaLead": "Hamlet",
    "pickups": [
      {
        "areaLead": "Hamlet",
        "direction": "· I-97 · billboard",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:vaccerine:orange",
    "person": "Vaccerine",
    "variant": "orange",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "orange"
    },
    "placement": "pinned",
    "spotDescription": "Roof on South Cunningham Dr, Capri.",
    "areaLead": "Capri",
    "pickups": [
      {
        "areaLead": "Capri",
        "direction": "· South Cunningham Dr · roof",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": "card:fbrito-card-ed-comics-033",
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:vaccerine:pink",
    "person": "Vaccerine",
    "variant": "pink",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": true,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "area-known",
    "spotDescription": "Shelf off US-82, Grassrivers.",
    "areaLead": "Grassrivers",
    "pickups": [
      {
        "areaLead": "Grassrivers",
        "direction": "· US-82 · shelf",
        "sourceTitle": "lorenzone.fr · GTA 6 Trading Cards checklist",
        "sourceUrl": "https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations",
        "evidence": "approximate",
        "hostId": null,
        "hostName": null
      }
    ],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:aimie:red",
    "person": "Aimie",
    "variant": "Red",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:alexander-avain:blue",
    "person": "Alexander Avain",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:alexander-avain:orange",
    "person": "Alexander Avain",
    "variant": "Orange",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "orange"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:angel-cienfuegos:blue",
    "person": "Angel Cienfuegos",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:anne-florence:pink",
    "person": "Anne Florence",
    "variant": "Pink",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:anthony-poke-ii:blue",
    "person": "Anthony Poke II",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:anthony-poke-ii:red",
    "person": "Anthony Poke II",
    "variant": "Red",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:anthony-ross:pink",
    "person": "Anthony Ross",
    "variant": "Pink",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:badge:pink",
    "person": "Badge",
    "variant": "Pink",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:braelynn:red",
    "person": "Braelynn",
    "variant": "Red",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:brianna-blue:red",
    "person": "Brianna Blue",
    "variant": "Red",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:capsule:blue",
    "person": "Capsule",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:chrissie:red",
    "person": "Chrissie",
    "variant": "Red",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:christel:red",
    "person": "Christel",
    "variant": "Red",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:christian-freeman:blue",
    "person": "Christian Freeman",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:christian-freeman:red",
    "person": "Christian Freeman",
    "variant": "Red",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:christian-yee:blue",
    "person": "Christian Yee",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:christian-yee:red",
    "person": "Christian Yee",
    "variant": "Red",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:diagnosis:blue",
    "person": "Diagnosis",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:dr-placebo:blue",
    "person": "Dr. Placebo",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:dravy-mease:red",
    "person": "Dravy Mease",
    "variant": "Red",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:duke-king:blue",
    "person": "Duke King",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:duke-king:red",
    "person": "Duke King",
    "variant": "Red",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:elias-delgado:blue",
    "person": "Elias Delgado",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:ellie-burke:pink",
    "person": "Ellie Burke",
    "variant": "Pink",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:emma-croydon:pink",
    "person": "Emma Croydon",
    "variant": "Pink",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:exekkkutioner:bright-green",
    "person": "ExeKKKutioner",
    "variant": "Bright Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:exekkkutioner:bright-red",
    "person": "ExeKKKutioner",
    "variant": "Bright Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:exekkkutioner:green",
    "person": "ExeKKKutioner",
    "variant": "Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:exekkkutioner:red",
    "person": "ExeKKKutioner",
    "variant": "Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:exekkkutioner:violet",
    "person": "ExeKKKutioner",
    "variant": "Violet",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "violet"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:fornicator:blue",
    "person": "Fornicator",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:founding-fathers:bright-green",
    "person": "Founding Fathers",
    "variant": "Bright Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:founding-fathers:bright-red",
    "person": "Founding Fathers",
    "variant": "Bright Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:founding-fathers:green",
    "person": "Founding Fathers",
    "variant": "Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:founding-fathers:red",
    "person": "Founding Fathers",
    "variant": "Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:founding-fathers:violet",
    "person": "Founding Fathers",
    "variant": "Violet",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "violet"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:foxy-ho:bright-green",
    "person": "Foxy Ho",
    "variant": "Bright Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:foxy-ho:bright-red",
    "person": "Foxy Ho",
    "variant": "Bright Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:foxy-ho:green",
    "person": "Foxy Ho",
    "variant": "Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:foxy-ho:red",
    "person": "Foxy Ho",
    "variant": "Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:foxy-ho:violet",
    "person": "Foxy Ho",
    "variant": "Violet",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "violet"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:funny-bones:blue",
    "person": "Funny Bones",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:general-surgeon:blue",
    "person": "General Surgeon",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:georgia:red",
    "person": "Georgia",
    "variant": "Red",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-flamingos:harold-toye:blue",
    "person": "Harold Toye",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "vice-city-flamingos",
    "setName": "Vice City Flamingos",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:ian-harris:pink",
    "person": "Ian Harris",
    "variant": "Pink",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:james-bowery:blue",
    "person": "James Bowery",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-wrath:james-bowery:red",
    "person": "James Bowery",
    "variant": "Red",
    "variantAlias": null,
    "setId": "liberty-city-wrath",
    "setName": "Liberty City Wrath",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:jemila:red",
    "person": "Jemila",
    "variant": "Red",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:john-morgan:pink",
    "person": "John Morgan",
    "variant": "Pink",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:jonah-clemmons:blue",
    "person": "Jonah Clemmons",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:jonah-clemmons:red",
    "person": "Jonah Clemmons",
    "variant": "Red",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:kadisha:red",
    "person": "Kadisha",
    "variant": "Red",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:kelly:red",
    "person": "Kelly",
    "variant": "Red",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:kkklash:bright-green",
    "person": "KKKlash",
    "variant": "Bright Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:kkklash:bright-red",
    "person": "KKKlash",
    "variant": "Bright Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:kkklash:green",
    "person": "KKKlash",
    "variant": "Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:kkklash:red",
    "person": "KKKlash",
    "variant": "Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:kkklash:violet",
    "person": "KKKlash",
    "variant": "Violet",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "violet"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:lavinia:red",
    "person": "Lavinia",
    "variant": "Red",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:nine1nine-dancers:lenora:red",
    "person": "Lenora",
    "variant": "Red",
    "variantAlias": null,
    "setId": "nine1nine-dancers",
    "setName": "Nine1Nine Dancers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:leon-correo:pink",
    "person": "Leon Correo",
    "variant": "Pink",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:jack-of-hearts-dancers:malena:red",
    "person": "Malena",
    "variant": "Red",
    "variantAlias": null,
    "setId": "jack-of-hearts-dancers",
    "setName": "Jack of Hearts Dancers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:mario-rugama:blue",
    "person": "Mario Rugama",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-swingers:mario-rugama:red",
    "person": "Mario Rugama",
    "variant": "Red",
    "variantAlias": null,
    "setId": "liberty-city-swingers",
    "setName": "Liberty City Swingers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:maximus-goldbart:red",
    "person": "Maximus Goldbart",
    "variant": "Red",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:mayor-tom:bright-green",
    "person": "Mayor Tom",
    "variant": "Bright Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:mayor-tom:bright-red",
    "person": "Mayor Tom",
    "variant": "Bright Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:mayor-tom:green",
    "person": "Mayor Tom",
    "variant": "Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:mayor-tom:red",
    "person": "Mayor Tom",
    "variant": "Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:mayor-tom:violet",
    "person": "Mayor Tom",
    "variant": "Violet",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "violet"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:mr-i:blue",
    "person": "MR.I",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:officer-pig:bright-green",
    "person": "Officer Pig",
    "variant": "Bright Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:officer-pig:bright-red",
    "person": "Officer Pig",
    "variant": "Bright Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:officer-pig:green",
    "person": "Officer Pig",
    "variant": "Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:officer-pig:red",
    "person": "Officer Pig",
    "variant": "Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:officer-pig:violet",
    "person": "Officer Pig",
    "variant": "Violet",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "violet"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:oskar-wolff:pink",
    "person": "Oskar Wolff",
    "variant": "Pink",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:remy-herbert:blue",
    "person": "Remy Herbert",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:remy-herbert:orange",
    "person": "Remy Herbert",
    "variant": "Orange",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "orange"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-club-de-futbol:renata-vasquez:pink",
    "person": "Renata Vasquez",
    "variant": "Pink",
    "variantAlias": null,
    "setId": "vice-city-club-de-futbol",
    "setName": "Vice City Club De Fútbol",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:ride-or-die:bright-green",
    "person": "Ride or Die",
    "variant": "Bright Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:ride-or-die:bright-red",
    "person": "Ride or Die",
    "variant": "Bright Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:ride-or-die:green",
    "person": "Ride or Die",
    "variant": "Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:ride-or-die:red",
    "person": "Ride or Die",
    "variant": "Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:ride-or-die:violet",
    "person": "Ride or Die",
    "variant": "Violet",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "violet"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:rion-yapa:blue",
    "person": "Rion Yapa",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:liberty-city-penetrators:rion-yapa:orange",
    "person": "Rion Yapa",
    "variant": "Orange",
    "variantAlias": null,
    "setId": "liberty-city-penetrators",
    "setName": "Liberty City Penetrators",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "orange"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:samuel-buono:blue",
    "person": "Samuel Buono",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:samuel-buono:red",
    "person": "Samuel Buono",
    "variant": "Red",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:side-effect:blue",
    "person": "Side Effect",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-pounders:sione-apa:red",
    "person": "Sione Apa",
    "variant": "Red",
    "variantAlias": null,
    "setId": "los-santos-pounders",
    "setName": "Los Santos Pounders",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:snowbunny:bright-green",
    "person": "Snowbunny",
    "variant": "Bright Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:snowbunny:bright-red",
    "person": "Snowbunny",
    "variant": "Bright Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:snowbunny:green",
    "person": "Snowbunny",
    "variant": "Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:snowbunny:red",
    "person": "Snowbunny",
    "variant": "Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:snowbunny:violet",
    "person": "Snowbunny",
    "variant": "Violet",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "violet"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:terrence-jackson:blue",
    "person": "Terrence Jackson",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:los-santos-corkers:terrence-jackson:red",
    "person": "Terrence Jackson",
    "variant": "Red",
    "variantAlias": null,
    "setId": "los-santos-corkers",
    "setName": "Los Santos Corkers",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:the-o-g:bright-green",
    "person": "The O.G.",
    "variant": "Bright Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:the-o-g:bright-red",
    "person": "The O.G.",
    "variant": "Bright Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:the-o-g:green",
    "person": "The O.G.",
    "variant": "Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:the-o-g:red",
    "person": "The O.G.",
    "variant": "Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:the-o-g:violet",
    "person": "The O.G.",
    "variant": "Violet",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "violet"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:vice-city-manatees:tusi-taufua:pink",
    "person": "Tusi Taufua",
    "variant": "Pink",
    "variantAlias": null,
    "setId": "vice-city-manatees",
    "setName": "Vice City Manatees",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "pink"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:ed-comics-universe:vaccerine:blue",
    "person": "Vaccerine",
    "variant": "Blue",
    "variantAlias": null,
    "setId": "ed-comics-universe",
    "setName": "Ed Comics Universe",
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "blue"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:white-devil:bright-green",
    "person": "White Devil",
    "variant": "Bright Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:white-devil:bright-red",
    "person": "White Devil",
    "variant": "Bright Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:white-devil:green",
    "person": "White Devil",
    "variant": "Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:white-devil:red",
    "person": "White Devil",
    "variant": "Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:white-devil:violet",
    "person": "White Devil",
    "variant": "Violet",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "violet"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:whitewash:bright-green",
    "person": "Whitewash",
    "variant": "Bright Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:whitewash:bright-red",
    "person": "Whitewash",
    "variant": "Bright Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "bright red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:whitewash:green",
    "person": "Whitewash",
    "variant": "Green",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "green"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:whitewash:red",
    "person": "Whitewash",
    "variant": "Red",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "red"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  },
  {
    "id": "card-checklist:unattributed:whitewash:violet",
    "person": "Whitewash",
    "variant": "Violet",
    "variantAlias": null,
    "setId": null,
    "setName": null,
    "checklistSlot": false,
    "rarity": {
      "tier": "standard",
      "colour": "violet"
    },
    "placement": "unmapped",
    "spotDescription": "",
    "areaLead": "",
    "pickups": [],
    "hostId": null,
    "catalogueId": null,
    "conflict": null,
    "printedText": null,
    "artwork": {
      "front": null,
      "back": null
    }
  }
];

export const CARD_CHECKLIST_SLOTS: CardChecklistItem[] = CARD_CHECKLIST_ITEMS.filter(
  (item) => item.checklistSlot,
);

export const CARD_CHECKLIST_EXTRAS: CardChecklistItem[] = CARD_CHECKLIST_ITEMS.filter(
  (item) => !item.checklistSlot,
);
