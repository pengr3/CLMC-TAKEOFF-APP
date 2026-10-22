/** @vitest-environment jsdom */
/**
 * Specified oracle: the selected measurement tool owns the committed type;
 * switching tools starts a new item, while same-type chaining retains metadata.
 * Only PDF rasterization and Konva's rendering surface are replaced. The actual
 * ToolRail, CanvasViewport, drawing hook, stores, naming UI and archive code run.
 */
import React, { act, useImperativeHandle, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import Konva from 'konva'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasViewport, setChainArmedFromTotals } from '@renderer/components/CanvasViewport'
import { ToolRail } from '@renderer/components/ToolRail'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { snapshotProject, hydrateStores } from '@renderer/lib/project-serialize'
import { aggregateBoq } from '@renderer/lib/boq-aggregator'
import { MARKUP_PALETTE } from '@renderer/lib/markup-palette'
import { setReopenSnapshot } from '@renderer/lib/markup-reopen-ref'
import type { Markup } from '@renderer/types/markup'
import type { ProjectFileV3 } from '@renderer/lib/project-schema'
import { assembleClmcZip, extractClmcZip, sha256Buffer } from '../main/project-io'

type Point = { x: number; y: number }
type Tool = Markup['type']
type ClickHandler = (event: Konva.KonvaEventObject<MouseEvent>) => void

const surface = vi.hoisted(() => ({
  stage: null as Konva.Stage | null,
  click: null as ClickHandler | null,
  canvas: null as HTMLCanvasElement | null,
  size: { width: 1200, height: 1200 }
}))

vi.mock('@renderer/hooks/usePdfRenderer', () => ({
  usePdfRenderer: () => ({ pageCanvas: surface.canvas, pageSize: surface.size })
}))
vi.mock('react-konva', () => ({
  Stage: React.forwardRef(function Stage(
    { onClick }: { onClick: ClickHandler },
    ref: React.ForwardedRef<Konva.Stage>
  ): React.JSX.Element {
    useImperativeHandle(ref, () => surface.stage!, [])
    useLayoutEffect(() => {
      surface.click = onClick
    }, [onClick])
    // Rendering child shapes is outside this semantic commit regression.
    return React.createElement('div', { 'data-testid': 'drawing-surface' })
  }),
  Layer: () => null,
  Circle: () => null,
  Line: () => null,
  Rect: () => null,
  Group: () => null,
  Text: () => null,
  Image: () => null,
  Shape: () => null
}))

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const TOOLS: Tool[] = ['count', 'linear', 'area', 'perimeter', 'wall']
const SQUARE: Point[] = [
  { x: 100, y: 100 },
  { x: 1100, y: 100 },
  { x: 1100, y: 1100 },
  { x: 100, y: 1100 }
]
const QUANTITY: Record<Tool, number> = { count: 1, linear: 10, area: 100, perimeter: 40, wall: 30 }
const PDF = Buffer.from('%PDF-1.7\nTool switching fixture\n%%EOF')
let root: Root
let container: HTMLDivElement
let pointer: Point
let scale: number
let position: Point

function selectTool(tool: Tool): void {
  act(() => {
    container.querySelector<HTMLButtonElement>(`[data-testid="rail-tool-${tool}"]`)!.click()
  })
  expect(useViewerStore.getState().activeTool).toBe(tool)
  expect(
    container.querySelector(`[data-testid="rail-tool-${tool}"]`)!.getAttribute('aria-pressed')
  ).toBe('true')
}

function clickPoint(point: Point): void {
  pointer = { x: point.x * scale + position.x, y: point.y * scale + position.y }
  act(() =>
    surface.click!({
      evt: new MouseEvent('click', { button: 0 }),
      target: surface.stage!
    } as Konva.KonvaEventObject<MouseEvent>)
  )
}

function enter(): void {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  })
}

function setInput(selector: string, value: string): void {
  const input = container.querySelector<HTMLInputElement>(selector)
  if (!input) throw new Error(`Missing naming input: ${selector}`)
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function nameItem(name: string, categoryName: string, colorIndex: number, wallHeight = 3000): void {
  setInput('input[placeholder="e.g. Light Switch"]', name)
  setInput('input[placeholder="e.g. Electrical"]', categoryName)
  if (container.querySelector('input[placeholder="2400"]'))
    setInput('input[placeholder="2400"]', String(wallHeight))
  act(() => {
    container
      .querySelector<HTMLButtonElement>(`[aria-label="Color ${MARKUP_PALETTE[colorIndex]}"]`)!
      .click()
  })
  const save = Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === 'Start Count' || button.textContent === 'Save Markup'
  )
  if (!save) throw new Error('Expected new-item naming before commit')
  act(() => save.click())
}

function draw(tool: Tool, name?: string, categoryName = 'Grid', colorIndex = 2): void {
  if (tool === 'count') {
    if (name) {
      if (!container.querySelector('input[placeholder="e.g. Light Switch"]')) {
        expect(
          useMarkupStore.getState().pageMarkups[1].at(-1)?.type,
          'Switch must not silently commit the previous tool'
        ).toBe(tool)
      }
      nameItem(name, categoryName, colorIndex)
    }
    clickPoint(SQUARE[0])
  } else {
    for (const point of tool === 'area' || tool === 'perimeter' ? SQUARE : SQUARE.slice(0, 2))
      clickPoint(point)
    enter()
    if (name) {
      if (!container.querySelector('input[placeholder="e.g. Light Switch"]')) {
        expect(
          useMarkupStore.getState().pageMarkups[1].at(-1)?.type,
          'Switch must not silently commit the previous tool'
        ).toBe(tool)
      }
      nameItem(name, categoryName, colorIndex)
    }
  }
}

function assertQuantity(tool: Tool, quantity: number, name: string): void {
  const rows = aggregateBoq().categories.flatMap((category) => category.items)
  const row = rows.find((item) => item.type === tool && item.label.startsWith(name))
  expect(row, `Expected ${name} ${tool} row`).toBeDefined()
  expect(row!.quantity).toBeCloseTo(quantity, 8)
  expect(row!.uom).toBe(tool === 'count' ? 'ea' : tool === 'area' || tool === 'wall' ? 'm²' : 'm')
}

beforeEach(() => {
  useViewerStore.getState().resetViewer()
  useProjectStore.getState().reset()
  useMarkupStore.getState().reset()
  useScaleStore.getState().reset()
  setReopenSnapshot(null)
  useViewerStore.setState({
    totalPages: 1,
    currentPage: 1,
    snapEnabled: false,
    pageViewports: { 1: { zoom: 1, panX: 1, panY: 1 } }
  })
  // 1000 canonical pixels = 10000mm = 10m.
  useScaleStore.setState({
    pageScales: { 1: { pixelsPerMm: 0.1, displayUnit: 'm' } },
    globalUnit: 'm'
  })
  surface.canvas = document.createElement('canvas')
  surface.click = null
  pointer = { x: 0, y: 0 }
  scale = 1
  position = { x: 0, y: 0 }
  const stageElement = document.createElement('div')
  surface.stage = {
    getAbsoluteTransform: () => new Konva.Transform([scale, 0, 0, scale, position.x, position.y]),
    getPointerPosition: () => pointer,
    scale: (value: Point) => {
      scale = value.x
    },
    scaleX: () => scale,
    position: (value?: Point) => {
      if (value) position = value
      return position
    },
    container: () => stageElement
  } as unknown as Konva.Stage
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {
        /* fixed test viewport */
      }
      disconnect(): void {
        /* no subscription */
      }
    }
  )
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() =>
    root.render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ToolRail),
        React.createElement(CanvasViewport)
      )
    )
  )
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('selected measurement tool through production commit and persistence', () => {
  it.each(TOOLS.flatMap((from) => TOOLS.filter((to) => to !== from).map((to) => ({ from, to }))))(
    '$from → $to starts a fresh item and commits the selected type',
    async ({ from, to }) => {
      selectTool(from)
      draw(from, 'Original', 'Old category', 1)
      selectTool(to)
      draw(to, 'Switched', 'New category', 4)

      const markups = useMarkupStore.getState().pageMarkups[1]
      expect(markups.map((markup) => markup.type)).toEqual([from, to])
      expect(markups.map((markup) => markup.name)).toEqual(['Original', 'Switched'])
      expect(markups.map((markup) => markup.color)).toEqual([MARKUP_PALETTE[1], MARKUP_PALETTE[4]])
      expect(
        markups.map((markup) => useMarkupStore.getState().getCategory(markup.categoryId)?.name)
      ).toEqual(['Old category', 'New category'])
      assertQuantity(from, QUANTITY[from], 'Original')
      assertQuantity(to, QUANTITY[to], 'Switched')

      const snapshot = snapshotProject({
        pdfOriginalFilename: 'grid.pdf',
        pdfSha256: sha256Buffer(PDF),
        pdfTotalPages: 1,
        perPageDimensions: { 1: surface.size }
      })
      const archive = await assembleClmcZip(JSON.stringify(snapshot), PDF)
      const extracted = await extractClmcZip(archive)
      const saved = JSON.parse(extracted.projectJson) as ProjectFileV3
      expect(saved.formatVersion).toBe(3)
      expect(saved.pages[0].markups).toEqual(markups)
      expect(extracted.pdfBytes).toEqual(PDF)
      act(() => hydrateStores(saved))
      assertQuantity(from, QUANTITY[from], 'Original')
      assertQuantity(to, QUANTITY[to], 'Switched')
    }
  )

  it.each(TOOLS)('%s keeps intentional same-type chaining and its item metadata', (tool) => {
    selectTool(tool)
    draw(tool, 'Chained', 'Same category', 3)
    draw(tool)
    const markups = useMarkupStore.getState().pageMarkups[1]
    expect(markups).toHaveLength(2)
    for (const markup of markups) {
      expect(markup).toMatchObject({
        type: tool,
        name: 'Chained',
        color: MARKUP_PALETTE[3],
        categoryId: markups[0].categoryId
      })
      if (markup.type === 'wall') expect(markup.wallHeight).toBe(3000)
    }
    assertQuantity(tool, QUANTITY[tool] * 2, 'Chained')
  })

  it.each(TOOLS)('retains an explicitly armed %s preset when active tool changes', (tool) => {
    selectTool(tool === 'area' ? 'linear' : 'area')
    act(() => {
      setChainArmedFromTotals({
        toolType: tool,
        name: 'Preset',
        categoryName: 'Preset category',
        color: MARKUP_PALETTE[5],
        wallHeight: 3000
      })
      useViewerStore.getState().setActiveTool(tool)
    })
    draw(tool)
    expect(useMarkupStore.getState().pageMarkups[1][0]).toMatchObject({
      type: tool,
      name: 'Preset',
      color: MARKUP_PALETTE[5]
    })
    assertQuantity(tool, QUANTITY[tool], 'Preset')
  })

  it('creates the native 10m → 100m² → 40m sequence with snap enabled after Area', () => {
    selectTool('linear')
    draw('linear', 'Grid length')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    selectTool('area')
    draw('area', 'Grid area')
    act(() => useViewerStore.getState().setSnapEnabled(true))
    selectTool('perimeter')
    draw('perimeter', 'Grid perimeter')
    expect(useMarkupStore.getState().pageMarkups[1].map((markup) => markup.type)).toEqual([
      'linear',
      'area',
      'perimeter'
    ])
    assertQuantity('linear', 10, 'Grid length')
    assertQuantity('area', 100, 'Grid area')
    assertQuantity('perimeter', 40, 'Grid perimeter')
  })
})
