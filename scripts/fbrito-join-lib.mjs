/**
 * Pure functions for the fbrito card join (scripts/fbrito-join.mjs).
 *
 * Extracted verbatim from the derivation that produced
 * scripts/fbrito-import-manifest.json (pinned fbrito commit
 * 77cd5024140f8ff857363998a210750191d9c777, 2026-11-28). No I/O here:
 * the join script owns file loading and the pool passes; this module
 * owns only normalisation, parsing, conversion and description
 * scoring, so unit tests can import it without running the join.
 */
export function norm(s) {
  // Collapse to bare alphanumerics: "O'Glade" and "O' Glade" are the same
  // person, as are "Mary-Kate" and "Mary Kate". A leading "The" is not
  // part of the identity ("The Ratster" = "Ratster", "The Fornicator" =
  // "Fornicator"), and neither is a standalone particle ("Lupin de
  // Juarez" = "Lupin Juarez"). Applied to BOTH sides, so "The Educated
  // Woman" stays consistent.
  let n = (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  // A leading "The" is not part of the identity ("The Ratster" =
  // "Ratster"). NOTE: do NOT strip standalone particles like "de" here —
  // set names contain one ("Club De Fútbol") and the set-type lookup
  // depends on it. Particle variants live in PERSON_ALIASES instead.
  n = n.replace(/^the\s+/, '');
  return n.replace(/[^a-z0-9]/g, '');
}

// Person spelling aliases, evidenced (same card, different community
// spelling): "Amie" (gtatown/fbrito) = "Aimie" (six.mics.dev game text);
// "Lupin de Juarez" (gtatown/fbrito) = "Lupin Juarez" (game text).
export const PERSON_ALIASES = { amie: 'aimie', lupindejuarez: 'lupinjuarez' };
export function normPerson(s) {
  const n = norm(s);
  return PERSON_ALIASES[n] ?? n;
}

export const SET_BY_FBRITO_TYPE = {
  'vicecityflamingoscard': 'vice-city-flamingos',
  'vicecitynarcoscard': 'vice-city-narcos',
  'vicecitymanateescard': 'vice-city-manatees',
  'vicecityclubdefutbolcard': 'vice-city-club-de-futbol',
  'libertycityswingerscard': 'liberty-city-swingers',
  'libertycitypenetratorscard': 'liberty-city-penetrators',
  'libertycitywrathcard': 'liberty-city-wrath',
  'lossantoscorkerscard': 'los-santos-corkers',
  'lossantospaniccard': 'los-santos-panic',
  'lossantospounderscard': 'los-santos-pounders',
  'backyardwrestlingcard': 'backyard-wrestling',
  'americasnexttophookercard': 'americas-next-top-hooker',
  'delightscard': 'delights-dancers',
  'jackofheartscard': 'jack-of-hearts-dancers',
  'nine1ninecard': 'nine1nine-dancers',
  'legendsofratfacecard': 'the-legends-of-ratface',
  'rightwingcard': 'right-wing-americas-hero',
  'edcomicscard': 'ed-comics-universe',
};

export const SET_NAMES = {
  'vice-city-flamingos': 'Vice City Flamingos', 'vice-city-narcos': 'Vice City Narcos',
  'vice-city-manatees': 'Vice City Manatees', 'vice-city-club-de-futbol': 'Vice City Club De Fútbol',
  'liberty-city-swingers': 'Liberty City Swingers', 'liberty-city-penetrators': 'Liberty City Penetrators',
  'liberty-city-wrath': 'Liberty City Wrath', 'los-santos-corkers': 'Los Santos Corkers',
  'los-santos-panic': 'Los Santos Panic', 'los-santos-pounders': 'Los Santos Pounders',
  'backyard-wrestling': 'Backyard Wrestling', 'americas-next-top-hooker': "America's Next Top Hooker",
  'delights-dancers': 'Delights Dancers', 'jack-of-hearts-dancers': 'Jack of Hearts Dancers',
  'nine1nine-dancers': 'Nine1Nine Dancers', 'the-legends-of-ratface': 'The Legends of Ratface',
  'right-wing-americas-hero': "Right Wing: America's Hero", 'ed-comics-universe': 'Ed Comics Universe',
};

export const SET_NAMES_BY_NORM = Object.fromEntries(Object.values(SET_NAMES).map((n) => [norm(n), n]));

/** Parse one fbrito `kind: "card"` record into { setId, person, variant }. */
export function parseFbrito(rec) {
  if (rec.kind !== 'card') return null;
  const setId = SET_BY_FBRITO_TYPE[norm(rec.type)] ?? null;
  const name = (rec.name ?? '').trim();
  const desc = (rec.description ?? '').trim();
  // "Set card: Person (Variant)" / "Set card: Person"
  let m = name.match(/^(.+?)\s+card:\s*(.+?)\s*\(([^)]+)\)\s*$/i);
  if (m) return { id: rec.id, setId, person: m[2].trim(), variant: m[3].trim(), x: rec.x, y: rec.y, parsed: 'named-variant', description: desc };
  m = name.match(/^(.+?)\s+card:\s*(.+?)\s*$/i);
  if (m) return { id: rec.id, setId, person: m[2].trim(), variant: null, x: rec.x, y: rec.y, parsed: 'named-novariant', description: desc };
  // Generic "Collectible Card" — person in description (a bare name, no
  // sentence). This must come BEFORE the "Person card" branch below:
  // "Collectible Card" ends in "card" and would otherwise parse as the
  // person "Collectible" and the branch would never be reached.
  if (/^collectible card$/i.test(name) && desc && /^[\p{L} .'\-$]{1,40}$/u.test(desc) && !/[.!?,;:]$/.test(desc) && desc.split(' ').length <= 4) {
    return { id: rec.id, setId, person: desc, variant: null, x: rec.x, y: rec.y, parsed: 'generic-desc-person', description: desc };
  }
  // "Person card (Variant)" / "Person card" — no colon (e.g. "Sue Prettyman card (Standard)", "Malik Rivers card")
  m = name.match(/^(.+?)\s+card\s*\(([^)]+)\)\s*$/i);
  if (m) return { id: rec.id, setId, person: m[1].trim().replace(/\s+Signed\s*$/i, ''), variant: m[2].trim(), x: rec.x, y: rec.y, parsed: 'person-card-variant', description: desc };
  m = name.match(/^(.+?)\s+card\s*$/i);
  if (m) {
    // A set-only name ('The Legends of Ratface card') is not a person.
    const maybe = m[1].trim().replace(/\s+Signed\s*$/i, '');
    if (SET_NAMES_BY_NORM[norm(maybe)]) return { id: rec.id, setId, person: null, variant: null, x: rec.x, y: rec.y, parsed: 'set-only', description: desc };
    return { id: rec.id, setId, person: maybe, variant: null, x: rec.x, y: rec.y, parsed: 'person-card', description: desc };
  }
  // Bare person name, set from type (e.g. "Otis Adams", "Tusi Taufua (Silver)", "Demario Richardson Signed Card")
  if (setId && !/card|loot|football|basketball/i.test(name)) {
    m = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (m) return { id: rec.id, setId, person: m[1].trim(), variant: m[2].trim(), x: rec.x, y: rec.y, parsed: 'bare-person-variant', description: desc };
    const person = name.replace(/\s+Signed Card\s*$/i, '').trim();
    if (person && person.split(' ').length <= 4) {
      return { id: rec.id, setId, person, variant: null, x: rec.x, y: rec.y, parsed: 'bare-person', description: desc };
    }
  }
  return { id: rec.id, setId, person: null, variant: null, x: rec.x, y: rec.y, parsed: 'unparseable', rawName: name, rawDesc: desc.slice(0, 80), description: desc };
}

/** fbrito 1024-unit map → game units. Validated: meditations 10/10, median ~21u. */
export const convert = (c) => ({ x: c.x * 32 - 16384, y: 16384 - c.y * 32 });
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const variantMatches = (slot, variant) => {
  if (variant == null) return false;
  const v = norm(variant);
  return v === norm(slot.variant) || (slot.variantAlias != null && v === norm(slot.variantAlias));
};

// Tier/colour labels are variants; anything else in the parens (a title
// like "Hotshot Rookie", a place like "Rialto Islands") is not a variant.
export const TIER_VARIANTS = new Set(['standard', 'bronze', 'silver', 'gold', 'red', 'blue', 'pink', 'purple', 'teal', 'orange', 'green', 'yellow', 'white', 'lightblue', 'deepred', 'darkred', 'dustypink', 'dustyrose', 'navyblue', 'navy', 'maroon', 'burgundy', 'brightorange', 'black']);
export function isTierVariant(v) { return TIER_VARIANTS.has(norm(v)); }

export const KNOWN_VARIANTS = new Set(['standard', 'bronze', 'silver', 'gold', 'red', 'blue', 'pink', 'purple', 'teal', 'orange', 'green', 'yellow', 'white', 'lightblue', 'deepred', 'darkred', 'dustypink', 'dustyrose', 'navyblue', 'navy', 'maroon', 'burgundy', 'brightorange', 'black']);

/**
 * Parse a gtatown card name: "<Set> card #N: Person (Variant)" or
 * "<Set> card: Person (Variant)" or "...: Person".
 * NOTE: parens sometimes hold a PLACE, not a variant (e.g. "Ichiro
 * Yamada (Rialto Islands)") — only accept the paren content as a
 * variant if it is a known tier/colour word.
 */
export function parseGtName(gtName, _setId) {
  let m = gtName.match(/card\s*#\d+:\s*(.+?)\s*\(([^)]+)\)\s*$/i) || gtName.match(/card:\s*(.+?)\s*\(([^)]+)\)\s*$/i);
  if (m) {
    const v = norm(m[2].trim());
    return { person: m[1].trim(), variant: KNOWN_VARIANTS.has(v) ? m[2].trim() : null };
  }
  m = gtName.match(/card\s*#\d+:\s*(.+?)\s*$/i) || gtName.match(/card:\s*(.+?)\s*$/i);
  if (m) return { person: m[1].trim(), variant: null };
  return { person: null, variant: null };
}

/** Area names compared ignoring a "of" ("Port of Vice City" = "Port Vice City"). */
export const normArea = (s) => norm(s).replace(/of/g, '');

export const STOPWORDS = new Set(('the a an and or of in on at to from with next near behind under over inside outside top bottom edge side front back room house building area place spot there here it is are was were be been has have had this that these those for by as into onto upon about around through between within without toward towards against along across after before during while where when which what who whom whose how all any some no not only own same so than too very can will just should now then once here there when where why how'.split(' ')));

export function tokens(text) {
  return new Set(((text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z]{3,}/g) ?? []).filter((t) => !STOPWORDS.has(t)));
}

/** Shared distinctive-token count between a slot's text and an fbrito description. */
export function descScore(slot, rec) {
  // Slot text: lorenzone spot + direction + area. Record text: fbrito description.
  const slotText = [slot.spotDescription, slot.areaLead, ...(slot.pickups ?? []).map((p) => p.direction)].join(' ');
  const st = tokens(slotText);
  const rt = tokens(rec.description ?? '');
  const shared = [...rt].filter((t) => st.has(t));
  return { shared, score: shared.length };
}
