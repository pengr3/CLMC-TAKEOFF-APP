import { describe, it } from 'vitest'
// Wave 0 RED stub
import { usePageLabels } from '../renderer/src/hooks/usePageLabels'

void usePageLabels

describe('usePageLabels', () => {
  it.todo('returns resolved labels array when pdfDocument.getPageLabels() resolves (D-16)')
  it.todo('returns null when getPageLabels() resolves null — callers use Page N fallback')
  it.todo('resets to null when pdfDocument changes to null')
})
