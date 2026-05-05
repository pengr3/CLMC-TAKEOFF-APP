import { describe, it } from 'vitest'
// Wave 0 RED stub — uses vi.useFakeTimers
import { useThumbnailRender } from '../renderer/src/hooks/useThumbnailRender'

void useThumbnailRender

describe('useThumbnailRender markup overlay debounce', () => {
  it.todo('markup commit schedules overlay refresh within 200ms±50ms (D-19)')
  it.todo('rapid commits collapse into a single refresh (debounce)')
  it.todo('page raster is NOT re-rendered on markup commit (overlay only)')
})
