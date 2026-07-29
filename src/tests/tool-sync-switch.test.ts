/**
 * Regression — tool-switch-placement-stuck (2026-07-29).
 *
 * Bug: switching from an actively-placing tool (Count in mode 'placing', chain
 * armed) to another markup tool (Linear) updated viewerStore.activeTool and the
 * rail/context-bar chrome, but the internal useMarkupTool machine kept
 * toolType='count'/mode='placing'. The CanvasViewport tool-sync effect gated
 * re-activation on `mode === 'idle'`, so activateMarkup(newTool) never fired and
 * subsequent workspace clicks kept placing Count pins.
 *
 * resolveToolSync is the extracted, pure decision the effect now delegates to.
 * These tests pin its contract: a manual switch (toolType !== activeTool) must
 * yield 'activate' REGARDLESS of mode, while preset flows (toolType ===
 * activeTool) must yield 'none' so an armed preset is never clobbered.
 */
import { describe, it, expect } from 'vitest'
import { resolveToolSync } from '@renderer/types/viewer'

describe('resolveToolSync — tool-switch reset (regression)', () => {
  it('manual switch mid-placement: Count("placing") -> Linear yields "activate" (the bug)', () => {
    // Previously returned 'none' because mode !== 'idle'. That left the machine
    // on count/placing so clicks kept dropping count pins under the Linear tool.
    expect(resolveToolSync('linear', 'count', 'placing')).toBe('activate')
  })

  it('manual switch mid-draw: Linear("drawing") -> Area yields "activate"', () => {
    expect(resolveToolSync('area', 'linear', 'drawing')).toBe('activate')
  })

  it('first activation from select (idle machine) yields "activate"', () => {
    expect(resolveToolSync('count', null, 'idle')).toBe('activate')
  })

  it('preset arm / already-running tool (toolType === activeTool) yields "none" in every mode', () => {
    // activatePreset converges toolType===activeTool in the batched render — must
    // NOT re-activate (that would erase the armed preset / interrupt the draw).
    expect(resolveToolSync('count', 'count', 'placing')).toBe('none')
    expect(resolveToolSync('linear', 'linear', 'drawing')).toBe('none')
    expect(resolveToolSync('area', 'area', 'confirming')).toBe('none')
    expect(resolveToolSync('wall', 'wall', 'naming')).toBe('none')
    expect(resolveToolSync('perimeter', 'perimeter', 'idle')).toBe('none')
  })

  it('leaving markup mode mid-flow: select while machine non-idle yields "cancel"', () => {
    expect(resolveToolSync('select', 'linear', 'drawing')).toBe('cancel')
    expect(resolveToolSync('select', 'count', 'placing')).toBe('cancel')
    expect(resolveToolSync('scale', 'area', 'confirming')).toBe('cancel')
  })

  it('non-markup tool with idle machine yields "none" (nothing to cancel)', () => {
    expect(resolveToolSync('select', null, 'idle')).toBe('none')
    expect(resolveToolSync('scale', null, 'idle')).toBe('none')
  })
})
