import type { CSSProperties } from 'react'
import { COLORS } from './constants'

export const compatibilityButton: CSSProperties = {
  minHeight: 28,
  padding: '4px 8px',
  borderRadius: 4,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.secondary,
  color: COLORS.textPrimary,
  fontSize: 13,
  fontWeight: 600
}
