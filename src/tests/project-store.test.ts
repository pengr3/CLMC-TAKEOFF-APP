import { describe, it, expect } from 'vitest'
// import { useProjectStore } from '@renderer/stores/projectStore'
// import { useMarkupStore } from '@renderer/stores/markupStore'
// import { useScaleStore } from '@renderer/stores/scaleStore'
// import { useViewerStore } from '@renderer/stores/viewerStore'

describe('projectStore', () => {
  it('dirty on place — placing a markup flips isDirty=true', () => {
    expect(true).toBe(false)
  })

  it('dirty on scale — setScale flips isDirty=true', () => {
    expect(true).toBe(false)
  })

  it('dirty on viewport — setZoom flips isDirty=true', () => {
    expect(true).toBe(false)
  })

  it('stays clean on hydrate — hydrating stores does NOT flip isDirty', () => {
    expect(true).toBe(false)
  })

  it('clean after save — setSaved(path) sets isDirty=false and currentFilePath', () => {
    expect(true).toBe(false)
  })

  it('reset clears currentFilePath and isDirty', () => {
    expect(true).toBe(false)
  })
})
