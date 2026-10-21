import { readFile } from 'node:fs/promises'
import type { ReleaseInfo, ReleaseNotes } from '../shared/release-info'

export async function readReleaseInfo(version: string, notesPath: string): Promise<ReleaseInfo> {
  const result: ReleaseInfo = {
    version: version.trim() || null,
    notes: null,
    notesStatus: 'unavailable',
    releaseReady: false
  }
  try {
    const notes: ReleaseNotes = JSON.parse(await readFile(notesPath, 'utf8'))
    if (
      !notes ||
      typeof notes.version !== 'string' ||
      !Array.isArray(notes.changes) ||
      notes.changes.length === 0 ||
      !notes.changes.every((line) => typeof line === 'string' && line.trim()) ||
      typeof notes.compatibility !== 'string' ||
      !notes.compatibility.trim()
    )
      return result
    if (notes.version !== result.version) return { ...result, notesStatus: 'version-mismatch' }
    return { ...result, notes, notesStatus: 'available', releaseReady: true }
  } catch {
    return result
  }
}
