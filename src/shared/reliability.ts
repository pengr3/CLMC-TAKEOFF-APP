/** Named bridge contracts: identifiers are opaque; recovery paths never cross IPC. */
export interface RecoveryWrite {
  session: string
  revision: number
  sourcePath: string | null
  lastSavedAt: number | null
  projectJson: string
  pdfBytes: Uint8Array
}
export interface RecoveryCandidate {
  id: string
  session: string
  revision: number
  filename: string
  sourcePath: string | null
  lastSavedAt: number | null
  capturedAt: string
  restorable: boolean
  problem?: 'metadata' | 'pdf'
}
export type RecoveryStage = 'scan' | 'validate' | 'write' | 'quota' | 'read' | 'delete'
export interface RecoveryFailure { ok: false; stage: RecoveryStage; message: string }
export type RecoveryListResult = { ok: true; candidates: RecoveryCandidate[] } | RecoveryFailure
export type RecoveryWriteResult = { ok: true; candidate: RecoveryCandidate; unchanged: boolean } | RecoveryFailure
export type RecoveryReadResult = { ok: true; candidate: RecoveryCandidate; projectJson: string; pdfBytes: Uint8Array } | RecoveryFailure
export type RecoveryDeleteResult = { ok: true } | RecoveryFailure
export interface RecoveryApi {
  listRecovery: () => Promise<RecoveryListResult>
  writeRecovery: (input: RecoveryWrite) => Promise<RecoveryWriteResult>
  readRecovery: (id: string) => Promise<RecoveryReadResult>
  deleteRecovery: (id: string) => Promise<RecoveryDeleteResult>
  retireRecoveryRevision: (session: string, revision: number) => Promise<RecoveryDeleteResult>
  recoveryDestinationWritable: (path: string) => Promise<boolean>
}
