/**
 * Host half of the ACP Worker tool card.
 * Empty apply: client-modules only scans Loader rows that declare `dsh.client`.
 */

/** Loader display name. Inventory id is the patch row `pihuo-acp-ui`. */
export const name = 'pihuo-acp-ui'

/** No Host registrations. The browser factory lives at `exports["./client"]`. */
export function apply(): void {}
