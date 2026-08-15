/**
 * Host half of the ACP Worker tool card.
 * Empty apply: client-modules only scans Loader rows that declare `dsh.client`.
 */

/** Loader display name. The boot graph id is the package name, not this string. */
export const name = 'ui-acp-worker'

/** No Host registrations. The browser factory lives at `exports["./client"]`. */
export function apply(): void {}
