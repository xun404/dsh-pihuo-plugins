/**
 * Process-agnostic worker identity and the in-process session pool.
 */
export { fingerprintOf, reuseKeyId } from './fingerprint.js'
export type { FingerprintInput } from './fingerprint.js'
export { PoolFullError, WorkerSessionPool } from './pool.js'
export type { PooledSession, PoolEntryState, SessionFactory, WorkerSessionPoolOptions } from './pool.js'
export type { WorkerReuseKey } from '@pihuo/dsh-worker-protocol'
