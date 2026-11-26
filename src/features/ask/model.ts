/**
 * The Ask / matcher model default — a leaf module with no imports, so
 * the ask chain (openai.ts) and the categorise chain (categories.ts)
 * can both use it without a circular import. openai.ts re-exports it;
 * every existing import site keeps working.
 *
 * The cycle it breaks: openai.ts imported aiCategoryDisplay from
 * categories.ts, and categories.ts imported DEFAULT_ASK_MODEL from
 * openai.ts. Bundlers tolerated it; tsx's ESM loader did not
 * ("Cannot access 'DEFAULT_ASK_MODEL' before initialization" when
 * categories evaluated first) — any script importing the ask chain
 * crashed on load.
 */
export const DEFAULT_ASK_MODEL = 'gpt-4o-mini';
