import { useState, useEffect, useCallback } from 'react'
import { FileUp } from 'lucide-react'
import { usePdfDocument } from '../hooks/usePdfDocument'

export function EmptyState(): React.JSX.Element {
  const [isDragOver, setIsDragOver] = useState(false)
  const { loadPdf } = usePdfDocument()

  // Prevent default drag behavior at window level to stop Chromium navigation
  useEffect(() => {
    const preventDefaults = (e: DragEvent): void => {
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('dragover', preventDefaults)
    window.addEventListener('drop', preventDefaults)
    return () => {
      window.removeEventListener('dragover', preventDefaults)
      window.removeEventListener('drop', preventDefaults)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const files = e.dataTransfer.files
      if (files.length > 0) {
        const file = files[0]
        if (file.name.toLowerCase().endsWith('.pdf')) {
          const filePath = (file as File & { path?: string }).path ?? file.name

          // Read the file as ArrayBuffer and load via PDF.js
          const reader = new FileReader()
          reader.onload = (): void => {
            const arrayBuffer = reader.result as ArrayBuffer
            if (arrayBuffer) {
              loadPdf(arrayBuffer, filePath)
            }
          }
          reader.readAsArrayBuffer(file)
        }
      }
    },
    [loadPdf]
  )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%'
      }}
    >
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
          border: `2px dashed ${isDragOver ? '#0078d4' : '#3c3c3c'}`,
          borderRadius: 8,
          transition: 'border-color 0.2s ease'
        }}
        role="region"
        aria-label="File drop zone"
      >
        <FileUp size={48} color="#808080" />
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#cccccc',
            marginTop: 16,
            lineHeight: 1.2
          }}
        >
          Open a PDF floor plan to begin
        </h2>
        <p
          style={{
            fontSize: 13,
            fontWeight: 400,
            color: '#808080',
            marginTop: 8,
            lineHeight: 1.4,
            textAlign: 'center'
          }}
        >
          Drag and drop a file here, or use the Open PDF button above.
        </p>
      </div>
    </div>
  )
}
