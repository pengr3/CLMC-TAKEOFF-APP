/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest'
// import React from 'react'
// import { renderToStaticMarkup } from 'react-dom/server'
// import { TitleBar } from '@renderer/components/TitleBar'
// import { useProjectStore } from '@renderer/stores/projectStore'

describe('title-bar-dirty', () => {
  it('asterisk when dirty — title renders "<file>.clmc * — CLMC Takeoff" when isDirty=true', () => {
    expect(true).toBe(false)
  })

  it('no asterisk when clean — title renders "<file>.clmc — CLMC Takeoff" when isDirty=false', () => {
    expect(true).toBe(false)
  })

  it('falls back to viewerStore.fileName when currentFilePath is null', () => {
    expect(true).toBe(false)
  })
})
