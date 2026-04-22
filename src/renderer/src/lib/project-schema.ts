import type { Markup } from '../types/markup'
import type { ScaleUnit } from '../types/scale'
import type { ViewportState } from '../types/viewer'

export interface ProjectFileV1 {
  formatVersion: 1
  createdAt: string // ISO-8601
  updatedAt: string // ISO-8601
  pdf: {
    absolutePath: string
    relativePath: string | null // null when cross-drive at save time (Pitfall 4)
    totalPages: number
    sha256: string
  }
  globalUnit: ScaleUnit
  categories: Record<string, { id: string; name: string; color: string; paletteIndex: number }>
  categoryOrder: string[]
  currentPage: number
  pages: Array<{
    pageIndex: number
    dimensions: { width: number; height: number } // PDF points at rotation 0
    scale: { pixelsPerMm: number; displayUnit: ScaleUnit } | null
    viewport: ViewportState
    markups: Markup[]
  }>
}

export type ProjectFile = ProjectFileV1

export function validateV1(raw: unknown): ProjectFileV1 {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid project file: not an object')
  const r = raw as Record<string, unknown>

  if (r.formatVersion !== 1) {
    throw new Error(`Expected formatVersion 1, got ${String(r.formatVersion)}`)
  }
  if (typeof r.createdAt !== 'string') throw new Error('Invalid createdAt')
  if (typeof r.updatedAt !== 'string') throw new Error('Invalid updatedAt')
  if (!r.pdf || typeof r.pdf !== 'object') throw new Error('Missing pdf block')

  const pdf = r.pdf as Record<string, unknown>
  if (typeof pdf.absolutePath !== 'string') throw new Error('Invalid pdf.absolutePath')
  if (pdf.relativePath !== null && typeof pdf.relativePath !== 'string') {
    throw new Error('Invalid pdf.relativePath (must be string or null)')
  }
  if (typeof pdf.totalPages !== 'number') throw new Error('Invalid pdf.totalPages')
  if (typeof pdf.sha256 !== 'string') throw new Error('Invalid pdf.sha256')

  if (typeof r.globalUnit !== 'string') throw new Error('Invalid globalUnit')
  if (!r.categories || typeof r.categories !== 'object' || Array.isArray(r.categories)) {
    throw new Error('Invalid categories')
  }
  if (!Array.isArray(r.categoryOrder)) throw new Error('Invalid categoryOrder')
  if (typeof r.currentPage !== 'number') throw new Error('Invalid currentPage')
  if (!Array.isArray(r.pages)) throw new Error('Invalid pages')

  return raw as ProjectFileV1
}

export function migrate(raw: unknown, fromVersion: number): ProjectFile {
  if (fromVersion === 1) return validateV1(raw)
  throw new Error(
    `Unsupported formatVersion: ${fromVersion}. Expected 1. ` +
      `File may be corrupt or from a newer app version.`
  )
}
