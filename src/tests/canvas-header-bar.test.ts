import { describe, it } from 'vitest'
// Wave 0 RED stub
import { CanvasHeaderBar } from '../renderer/src/components/CanvasHeaderBar'

void CanvasHeaderBar

describe('CanvasHeaderBar', () => {
  it.todo('renders null when totalPages === 0 (D-20)')
  it.todo('shows current page label left-aligned')
  it.todo('shows "Not Set" in textSecondary when uncalibrated but no non-count markups')
  it.todo('shows "Page not calibrated." + Set Scale link when uncalibrated AND has non-count markups (D-20)')
  it.todo('"Set Scale" link click invokes getCalibrationControls().activate() — NOT duplicate code (D-20)')
  it.todo('shows 1:N ratio text when calibrated')
})
