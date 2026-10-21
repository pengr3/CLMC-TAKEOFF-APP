import { Image } from 'react-konva'

/** One page-space image: backing resolution must never set markup geometry. */
export function PdfPageImage({
  canvas,
  size
}: {
  canvas: HTMLCanvasElement
  size: { width: number; height: number }
}): React.JSX.Element {
  return <Image image={canvas} width={size.width} height={size.height} />
}
