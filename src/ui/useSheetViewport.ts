import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'

type Point = { x: number; y: number }
type View = { zoom: number | 'fit'; left: number; top: number }
const clampZoom = (zoom: number) => Math.max(0.1, Math.min(4, zoom))
const midpoint = (points: Point[]): Point => ({ x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length })
const distance = (points: Point[]) => Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y)

export function useSheetViewport(onSelect: (id: string) => void) {
  const viewport = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ zoom: 'fit', left: 0, top: 0 })
  const [width, setWidth] = useState(1000)
  const scale = view.zoom === 'fit' ? Math.min(1, width / 1600) : view.zoom
  const currentScale = useRef(scale)
  const pending = useRef<View | null>(null)
  const pointers = useRef(new Map<number, Point>())
  const tap = useRef<{ point: Point; box: string | null; moved: boolean } | null>(null)

  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const resize = () => { if (element.clientWidth > 32) setWidth(element.clientWidth - 32) }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    currentScale.current = scale
    const element = viewport.current
    if (!element || !pending.current) return
    element.scrollLeft = view.left
    element.scrollTop = view.top
    pending.current = null
  }, [view, scale])

  const zoomAt = useCallback((requested: number, from: Point, to = from) => {
    const element = viewport.current
    if (!element) return
    const zoom = clampZoom(requested)
    const previous = pending.current
    const ratio = zoom / currentScale.current
    const next = {
      zoom,
      left: ((previous?.left ?? element.scrollLeft) + from.x - 16) * ratio + 16 - to.x,
      top: ((previous?.top ?? element.scrollTop) + from.y - 16) * ratio + 16 - to.y,
    }
    currentScale.current = zoom
    pending.current = next
    setView(next)
  }, [])

  const changeZoom = (zoom: number) => {
    const element = viewport.current
    if (element) zoomAt(zoom, { x: element.clientWidth / 2, y: element.clientHeight / 2 })
  }

  const fitWidth = () => {
    const next: View = { zoom: 'fit', left: 0, top: 0 }
    pending.current = next
    setView(next)
  }

  const showSection = (id: string) => {
    onSelect(id)
    const element = viewport.current
    const target = element?.querySelector<HTMLElement>(`[data-box="${id}"]`)
    const paper = element?.querySelector<HTMLElement>('.paper-sheet')
    if (!element || !target || !paper) return
    const box = target.getBoundingClientRect()
    const sheet = paper.getBoundingClientRect()
    if (!box.width || !box.height) return
    const oldScale = currentScale.current
    const zoom = clampZoom(Math.min((element.clientWidth - 32) * oldScale / box.width, (element.clientHeight - 32) * oldScale / box.height))
    const next = {
      zoom,
      left: 16 + (box.left - sheet.left + box.width / 2) * zoom / oldScale - element.clientWidth / 2,
      top: 16 + (box.top - sheet.top + box.height / 2) * zoom / oldScale - element.clientHeight / 2,
    }
    currentScale.current = zoom
    pending.current = next
    setView(next)
    element.focus({ preventScroll: true })
    element.scrollIntoView?.({ block: 'nearest' })
  }

  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const bounds = element.getBoundingClientRect()
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1)
      zoomAt(currentScale.current * Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.002), { x: event.clientX - bounds.left - element.clientLeft, y: event.clientY - bounds.top - element.clientTop })
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [zoomAt])

  const localPoint = (event: PointerEvent<HTMLDivElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - bounds.left - event.currentTarget.clientLeft, y: event.clientY - bounds.top - event.currentTarget.clientTop }
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || pointers.current.size >= 2) return
    const point = localPoint(event)
    if (!pointers.current.size) tap.current = { point, box: (event.target as Element).closest<HTMLElement>('[data-box]')?.dataset.box ?? null, moved: false }
    else if (tap.current) tap.current.moved = true
    pointers.current.set(event.pointerId, point)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.currentTarget.focus({ preventScroll: true })
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return
    const before = [...pointers.current.values()]
    const point = localPoint(event)
    if (tap.current && Math.hypot(point.x - tap.current.point.x, point.y - tap.current.point.y) > 3) tap.current.moved = true
    pointers.current.set(event.pointerId, point)
    const after = [...pointers.current.values()]
    const factor = after.length === 2 && distance(before) > 0 ? distance(after) / distance(before) : 1
    zoomAt(currentScale.current * factor, midpoint(before), midpoint(after))
  }

  const endPointer = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (!pointers.current.delete(event.pointerId)) return
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (!pointers.current.size) {
      if (!cancelled && tap.current?.box && !tap.current.moved) showSection(tap.current.box)
      tap.current = null
    }
  }

  return {
    viewport, scale, changeZoom, fitWidth, showSection,
    pointerHandlers: {
      onPointerDown, onPointerMove,
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => endPointer(event),
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) => endPointer(event, true),
      onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => endPointer(event, true),
    },
  }
}
