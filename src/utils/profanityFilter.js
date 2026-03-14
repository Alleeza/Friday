/**
 * profanityFilter.js — Reusable profanity detection and filtering utility.
 *
 * Uses the `bad-words` library to detect and censor offensive language.
 * This module is designed to sit in the chat message pipeline BEFORE any
 * user message reaches the AI service, ensuring offensive content is
 * sanitised at the earliest possible stage.
 *
 * Architecture:
 *   User input → profanityFilter.cleanMessage() → AI processing
 *
 * The filter is applied in two places for defence-in-depth:
 *   1. useAIChat hook   — immediate UI feedback to the user
 *   2. AIService layer  — final gate before the network request
 *
 * Usage:
 *   import { cleanMessage, containsProfanity, addCustomBannedWords } from './profanityFilter';
 *
 *   const safe = cleanMessage('some user text');   // offensive words → "****"
 *   const hasBad = containsProfanity('some text'); // true / false
 *   addCustomBannedWords(['badword1', 'badword2']); // extend the list
 */

import { Filter } from 'bad-words';

// ── Singleton filter instance ────────────────────────────────────────────────
// We keep a single instance so that custom words added at runtime persist
// across calls without needing dependency injection.
const filter = new Filter();

// The placeholder string used to replace every detected profane word.
const REPLACEMENT = '****';

// Configure the filter to use our fixed-length placeholder instead of the
// default per-character replacement (e.g. "s***" → "****").
filter.replaceWord = () => REPLACEMENT;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Sanitise a message by replacing every profane word with "****".
 *
 * This is the primary function used in the chat pipeline. It always returns
 * a string — if the input is falsy it returns an empty string.
 *
 * @param {string} message - Raw user input
 * @returns {string} The cleaned message with offensive words replaced by "****"
 *
 * @example
 *   cleanMessage('hello damn world');  // → 'hello **** world'
 *   cleanMessage('nice day');          // → 'nice day'  (unchanged)
 */
export function cleanMessage(message) {
  if (!message || typeof message !== 'string') return '';
  try {
    return filter.clean(message);
  } catch {
    // If the filter throws for any reason (e.g. unusual unicode),
    // return the original message rather than blocking the user.
    console.warn('[profanityFilter] filter.clean() threw — returning original message');
    return message;
  }
}

/**
 * Check whether a message contains any profane words.
 *
 * Useful when you want to warn the user or block the message entirely
 * instead of silently replacing words.
 *
 * @param {string} message - Raw user input
 * @returns {boolean} true if at least one offensive word is detected
 *
 * @example
 *   containsProfanity('hello world');   // → false
 *   containsProfanity('hello damn');    // → true
 */
export function containsProfanity(message) {
  if (!message || typeof message !== 'string') return false;
  try {
    return filter.isProfane(message);
  } catch {
    return false;
  }
}

/**
 * Extend the built-in ban list with additional custom words.
 *
 * Call this at app startup (or whenever an admin updates the list) to add
 * domain-specific terms that the default dictionary doesn't cover.
 *
 * @param {string[]} words - Array of words to ban
 *
 * @example
 *   addCustomBannedWords(['cheatcode', 'exploit']);
 */
export function addCustomBannedWords(words = []) {
  if (!Array.isArray(words)) return;
  const valid = words.filter((w) => typeof w === 'string' && w.trim());
  if (valid.length) {
    filter.addWords(...valid);
  }
}

/**
 * Remove words from the ban list (useful for whitelisting false positives).
 *
 * @param {string[]} words - Array of words to allow
 *
 * @example
 *   removeWordsFromFilter(['hell']); // allow "hell" in a game context
 */
export function removeWordsFromFilter(words = []) {
  if (!Array.isArray(words)) return;
  const valid = words.filter((w) => typeof w === 'string' && w.trim());
  if (valid.length) {
    filter.removeWords(...valid);
  }
}
