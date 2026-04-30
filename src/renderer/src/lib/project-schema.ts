import type { Markup } from '../types/markup'
import type { ScaleUnit, PageScale } from '../types/scale'
import type { ViewportState } from '../types/viewer'

// ----- v1 (legacy plain-JSON .clmc) -----
// Kept for migration source. New code should use ProjectFileV2.

export interface ProjectFileV1 {
  formatVersion: 1
  createdAt: string
  updatedAt: string
  pdf: {
    absolutePath: string
    relativePath: string | null
    totalPages: number
    sha256: string
  }
  globalUnit: ScaleUnit
  categories: Record<string, { id: string; name: string; color: string; paletteIndex: number }>
  categoryOrder: string[]
  currentPage: number
  pages: Array<{
    pageIndex: number
    dimensions: { width: number; height: number }
    scale: PageScale | null
    viewport: ViewportState
    markups: Markup[]
  }>
}

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

// ----- v2 (ZIP-embedded .clmc) -----

export interface ProjectFileV2 {
  formatVersion: 2
  createdAt: string
  updatedAt: string
  pdf: {
    originalFilename: string
    sha256: string
    totalPages: number
  }
  globalUnit: ScaleUnit
  categories: Record<string, { id: string; name: string; color: string; paletteIndex: number }>
  categoryOrder: string[]
  currentPage: number
  pages: Array<{
    pageIndex: number
    dimensions: { width: number; height: number }
    scale: PageScale | null
    viewport: ViewportState
    markups: Markup[]
  }>
}

export type ProjectFile = ProjectFileV2

export function validateV2(raw: unknown): ProjectFileV2 {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid project file: not an object')
  const r = raw as Record<string, unknown>

  if (r.formatVersion !== 2) {
    throw new Error(`Expected formatVersion 2, got ${String(r.formatVersion)}`)
  }
  if (typeof r.createdAt !== 'string') throw new Error('Invalid createdAt')
  if (typeof r.updatedAt !== 'string') throw new Error('Invalid updatedAt')
  if (!r.pdf || typeof r.pdf !== 'object') throw new Error('Missing pdf block')

  const pdf = r.pdf as Record<string, unknown>
  if (typeof pdf.originalFilename !== 'string') {
    throw new Error('Invalid pdf.originalFilename (v2 requires originalFilename)')
  }
  if (typeof pdf.sha256 !== 'string') throw new Error('Invalid pdf.sha256')
  if (typeof pdf.totalPages !== 'number') throw new Error('Invalid pdf.totalPages')

  if (typeof r.globalUnit !== 'string') throw new Error('Invalid globalUnit')
  if (!r.categories || typeof r.categories !== 'object' || Array.isArray(r.categories)) {
    throw new Error('Invalid categories')
  }
  if (!Array.isArray(r.categoryOrder)) throw new Error('Invalid categoryOrder')
  if (typeof r.currentPage !== 'number') throw new Error('Invalid currentPage')
  if (!Array.isArray(r.pages)) throw new Error('Invalid pages')

  return raw as ProjectFileV2
}

/**
 * Platform-agnostic basename — handles both `/` and `\\` separators.
 * v1 files written by Windows main process use `\\`, but be defensive.
 */
function basenameAny(p: string): string {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return idx >= 0 ? p.slice(idx + 1) : p
}

function migrateV1ToV2(v1: ProjectFileV1): ProjectFileV2 {
  return {
    formatVersion: 2,
    createdAt: v1.createdAt,
    updatedAt: v1.updatedAt,
    pdf: {
      originalFilename: basenameAny(v1.pdf.absolutePath),
      sha256: v1.pdf.sha256,
      totalPages: v1.pdf.totalPages
    },
    globalUnit: v1.globalUnit,
    categories: v1.categories,
    categoryOrder: v1.categoryOrder,
    currentPage: v1.currentPage,
    pages: v1.pages
  }
}

/**
 * Migrate raw project data to ProjectFileV2.
 * Returns { data, wasMigrated }:
 *   - wasMigrated=true: input was v1; caller should mark project dirty (D-06)
 *   - wasMigrated=false: input was already v2
 * Throws on unsupported versions.
 */
export function migrate(
  raw: unknown,
  fromVersion: number
): { data: ProjectFileV2; wasMigrated: boolean } {
  if (fromVersion === 2) return { data: validateV2(raw), wasMigrated: false }
  if (fromVersion === 1) {
    const v1 = validateV1(raw)
    return { data: migrateV1ToV2(v1), wasMigrated: true }
  }
  throw new Error(
    `Unsupported formatVersion: ${fromVersion}. Expected 1 or 2. ` +
      `File may be corrupt or from a newer app version.`
  )
}
