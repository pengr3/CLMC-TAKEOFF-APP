export interface ReleaseNotes {
  version: string
  changes: string[]
  compatibility: string
}

export interface ReleaseInfo {
  version: string | null
  notes: ReleaseNotes | null
  notesStatus: 'available' | 'unavailable' | 'version-mismatch'
  releaseReady: boolean
}
