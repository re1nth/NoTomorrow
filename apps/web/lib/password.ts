/**
 * Shared password-strength scoring for client meter and server validation.
 *
 * Uses @zxcvbn-ts (a TypeScript-native rewrite of Dropbox's zxcvbn) with
 * the English + common dictionaries. Score is 0-4:
 *   0 = trivial            1 = weak
 *   2 = OK (minimum ship)  3 = strong
 *   4 = very strong
 *
 * Server-side we reject anything under MIN_SCORE. The client meter uses
 * the same function so what the user sees matches what the server enforces.
 */
import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import * as zxcvbnEn from '@zxcvbn-ts/language-en';

export const MIN_SCORE = 2;

let factory: ZxcvbnFactory | null = null;
function getFactory(): ZxcvbnFactory {
  if (!factory) {
    factory = new ZxcvbnFactory({
      dictionary: {
        ...zxcvbnCommon.dictionary,
        ...zxcvbnEn.dictionary,
      },
      graphs: zxcvbnCommon.adjacencyGraphs,
      translations: zxcvbnEn.translations,
    });
  }
  return factory;
}

export interface StrengthReport {
  score: 0 | 1 | 2 | 3 | 4;
  warning: string;
  suggestions: string[];
  acceptable: boolean;
}

export function scorePassword(password: string, userInputs: string[] = []): StrengthReport {
  const result = getFactory().check(password, userInputs);
  return {
    score: result.score,
    warning: result.feedback.warning ?? '',
    suggestions: result.feedback.suggestions ?? [],
    acceptable: result.score >= MIN_SCORE,
  };
}

export const STRENGTH_LABELS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'Way too weak',
  1: 'Weak',
  2: 'OK',
  3: 'Strong',
  4: 'Very strong',
};
