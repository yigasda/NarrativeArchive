// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), packages/shared/src/utils/text-matching.ts, at fc0333c.
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive: TypeScript types removed; nothing else.
export function normalizeTextForMatch(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/gu, " ") : "";
}

export function includesTextForMatch(value, query) {
  const normalizedQuery = normalizeTextForMatch(query);
  if (!normalizedQuery) return true;
  return normalizeTextForMatch(value).includes(normalizedQuery);
}

export function startsWithTextForMatch(value, query) {
  const normalizedQuery = normalizeTextForMatch(query);
  if (!normalizedQuery) return true;
  return normalizeTextForMatch(value).startsWith(normalizedQuery);
}

/** Positive card tags are space/comma separated; quote tags containing either. */
export function parseCardTagSearchTerms(text) {
  const terms = Array.from(normalizeTextForMatch(text).matchAll(/"([^"]+)"|([^\s,"]+)/gu), (match) =>
    normalizeTextForMatch(match[1] ?? match[2]),
  );
  return [...new Set(terms.filter(Boolean))];
}

export function matchesAllCardSearchTags(tags, terms) {
  if (!Array.isArray(tags) || terms.length === 0) return false;
  const normalizedTags = new Set(tags.filter((tag) => typeof tag === "string").map(normalizeTextForMatch));
  return terms.every((term) => normalizedTags.has(term));
}
