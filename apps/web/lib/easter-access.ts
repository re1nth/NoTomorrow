import { createHash } from 'node:crypto';

/**
 * Feature-flag helper for the small delight in the bottom-right corner
 * of /counters. Access is decided by matching salted-SHA-256
 * fingerprints of substrings of the account email against a list of
 * pre-computed target fingerprints — the plaintext substrings are
 * never present in the source.
 *
 * If you're adding a new address, hash it with the same salt and add
 * its digest to TARGET_FINGERPRINTS (and its length to FRAGMENT_LENGTHS
 * if new). Never commit plaintext values here.
 */

// Fixed rotation token — bumping it invalidates the fingerprint table
// so old digests need to be regenerated. Not a secret; only used to
// break any precomputed rainbow-table shortcuts on short fragments.
const SALT = 'nt-egg-v1-4b7f2c';

// Substring lengths that any TARGET_FINGERPRINTS entry corresponds to.
// The runtime only hashes email substrings of these lengths, so keeping
// this small and specific keeps the per-lookup cost trivial.
const FRAGMENT_LENGTHS: readonly number[] = [3, 4, 5, 6];

// Opaque digests. Do not add plaintext fragments alongside these.
const TARGET_FINGERPRINTS: ReadonlySet<string> = new Set([
  'b6f0d9b3bbdfd8a618c47517ed5f51109c8c482b5986a9620283a10c7fd8ef0f',
  '0730ca8581b2b388cab5cca4227bc556ceb8642335d631383c6bc82a7b6fbd4d',
  '634035f3eac2a6f77d8b4f48a9fda255e0b325af4acc534b40229aca24d468ac',
  '95e6485fbe92302b19f578a353a824736753b4eb34ce702b1f3eefe47c19402e',
  'd6e684e8675ebd5d77ef0e27aec2193da5d8a0d38454af7c76ce5e68c83c2cce',
  '35b49cc68611e85d43a17a56e0ec1700ff09fbbfe436a34258cc98ce583e84a9',
  '8d73c77d7ab211d89b6f456a69296644977018ae6bd0520061ba873aeb37b11c',
]);

function fingerprint(fragment: string): string {
  return createHash('sha256').update(`${SALT}:${fragment}`).digest('hex');
}

export function hasEasterAccess(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  for (const len of FRAGMENT_LENGTHS) {
    if (normalized.length < len) continue;
    for (let i = 0; i <= normalized.length - len; i++) {
      const frag = normalized.slice(i, i + len);
      if (TARGET_FINGERPRINTS.has(fingerprint(frag))) return true;
    }
  }
  return false;
}
