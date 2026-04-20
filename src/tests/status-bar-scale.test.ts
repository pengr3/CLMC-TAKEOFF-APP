import { describe, it, expect, beforeEach } from 'vitest'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { formatScaleRatio } from '@renderer/lib/scale-math'
import { DEFAULT_UNIT } from '@renderer/types/scale'
import type { PageScale } from '@renderer/types/scale'

type ScaleDisplay = { text: string; isWarning: boolean }

function selectScaleDisplay(
  hasFile: boolean,
  pageScale: PageScale | null
): ScaleDisplay {
  if (!hasFile) return { text: '\u2014', isWarning: false }
  if (pageScale === null) return { text: 'Not Set', isWarning: true }
  return { text: formatScaleRatio(pageScale.pixelsPerMm), isWarning: false }
}

describe('StatusBar scale segment selection (SCAL-03)', () => {
  beforeEach(() => {
    useViewerStore.setState({
      filePath: null,
      fileName: null,
      currentPage: 1,
      totalPages: 0,
      pageViewports: {},
      pdfDocument: null
    })
    useScaleStore.setState({ pageScales: {}, globalUnit: DEFAULT_UNIT, calibMode: 'idle' })
  })

  it('shows em-dash when no PDF loaded', () => {
    const result = selectScaleDisplay(false, null)
    expect(result.text).toBe('\u2014')
    expect(result.isWarning).toBe(false)
  })

  it('shows "Not Set" in warning color when PDF loaded but page has no scale', () => {
    useViewerStore.setState({
      filePath: '/a.pdf',
      fileName: 'a.pdf',
      currentPage: 1,
      totalPages: 5,
      pageViewports: {},
      pdfDocument: null
    })
    const scale = useScaleStore.getState().getScale(1)
    const result = selectScaleDisplay(true, scale)
    expect(result.text).toBe('Not Set')
    expect(result.isWarning).toBe(true)
  })

  it('shows "1:90" in primary color when page has a 1:90 scale set in meters', () => {
    // For a 1:90 drawing: 1 drawing-unit represents 90 real-world-units.
    // In mm: pixelsPerMm = 1/90 pixels per mm (i.e. 90 mm of real-world per 1 pixel).
    useScaleStore.getState().setScale(1, 1 / 90, 'm')
    const scale = useScaleStore.getState().getScale(1)
    expect(scale).not.toBeNull()
    const result = selectScaleDisplay(true, scale)
    expect(result.text).toBe('1:90')
    expect(result.isWarning).toBe(false)
  })

  it('shows different scale per page (SCAL-02 cross-reference)', () => {
    useScaleStore.getState().setScale(1, 1 / 90, 'm')
    useScaleStore.getState().setScale(2, 1 / 50, 'm')
    const scale1 = useScaleStore.getState().getScale(1)
    const scale2 = useScaleStore.getState().getScale(2)
    expect(selectScaleDisplay(true, scale1).text).toBe('1:90')
    expect(selectScaleDisplay(true, scale2).text).toBe('1:50')
  })

  it('page with scale transitions to "Not Set" after clearScale', () => {
    useScaleStore.getState().setScale(1, 1 / 90, 'm')
    useScaleStore.getState().clearScale(1)
    const scale = useScaleStore.getState().getScale(1)
    const result = selectScaleDisplay(true, scale)
    expect(result.text).toBe('Not Set')
    expect(result.isWarning).toBe(true)
  })

  it('display is unit-independent: 1 m and 1000 mm scales render the same ratio', () => {
    // Same underlying pixelsPerMm, different displayUnit — ratio text must match
    useScaleStore.getState().setScale(1, 1 / 90, 'm')
    useScaleStore.getState().setScale(2, 1 / 90, 'mm')
    const scale1 = useScaleStore.getState().getScale(1)
    const scale2 = useScaleStore.getState().getScale(2)
    expect(selectScaleDisplay(true, scale1).text).toBe('1:90')
    expect(selectScaleDisplay(true, scale2).text).toBe('1:90')
  })
})
