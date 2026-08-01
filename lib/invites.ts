/**
 * Pure invite-QR helpers (no I/O — unit tested in lib/__tests__).
 * The QR simply carries the invite code inside a deep link — joining still
 * goes through the same join_group RPC as typing the code by hand.
 */

/** Deep link encoded into a group's invite QR. Opens the join screen with
 *  the code prefilled when the app is installed via a dev build; the in-app
 *  scanner parses it directly (Expo Go can't open custom schemes). */
export function inviteUrl(inviteCode: string): string {
  return `lumenz://groups/join?code=${inviteCode}`;
}

/**
 * Extract an invite code from scanned QR content. Accepts our own deep link,
 * any URL with a ?code= param, or a bare 6-character code — so codes shared
 * as plain text (e.g. pasted into a QR generator) still scan fine.
 * Returns null if the content doesn't look like an invite.
 *
 * Being scheme-agnostic is what keeps QR codes printed before the
 * SplitStream→Lumenz rename (splitstream://groups/join?code=…) scannable.
 */
export function parseInviteCode(scanned: string): string | null {
  const text = scanned.trim();

  const fromParam = /[?&]code=([A-Za-z0-9]{6})(?:[&#]|$)/.exec(text);
  if (fromParam) return fromParam[1].toUpperCase();

  if (/^[A-Za-z0-9]{6}$/.test(text)) return text.toUpperCase();

  return null;
}
