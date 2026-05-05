import { describe, it } from 'vitest'
// Wave 0 RED stub — will use vi.useFakeTimers + vi.spyOn(window, 'requestAnimationFrame')
import { PulseHighlight } from '../renderer/src/components/PulseHighlight'

void PulseHighlight

describe('PulseHighlight animation', () => {
  it.todo('opacity starts at 0.85 and reaches ~0 after 1500ms (D-12)')
  it.todo('stroke decreases from 6/zoom to 2/zoom linearly over 1500ms (D-12)')
  it.todo('calls onComplete when fade reaches t=1')
  it.todo('cancelAnimationFrame is called on unmount (no state-update-on-unmounted-component) (D-12)')
})
