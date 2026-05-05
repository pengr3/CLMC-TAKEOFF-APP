import { describe, it } from 'vitest'
// Wave 0 RED stub
import { useUiPanels } from '../renderer/src/hooks/useUiPanels'

void useUiPanels

describe('useUiPanels', () => {
  it.todo('reads localStorage clmc.ui on mount; returns stored values (D-03)')
  it.todo('returns DEFAULTS when localStorage has no entry (D-03)')
  it.todo('returns DEFAULTS silently when localStorage entry fails JSON.parse (D-03)')
  it.todo('writes localStorage when setThumbnailsOpen is called')
  it.todo('writes localStorage when setTotalsWidth is called')
  it.todo('toggleCategoryCollapsed adds name when not present')
  it.todo('toggleCategoryCollapsed removes name when already present')
})
