/** Local auxiliary codecs are required even when a PDF opens and page.render resolves. */
export function pdfDecoderOptions(
  baseUrl = typeof document === 'undefined' ? import.meta.url : document.baseURI
): { wasmUrl: string } {
  return { wasmUrl: new URL('./pdfjs/wasm/', baseUrl).href }
}
