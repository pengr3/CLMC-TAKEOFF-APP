import { createReadStream, existsSync } from 'fs'
import { createHash } from 'crypto'
import { extname, isAbsolute, parse, relative, resolve, dirname } from 'path'

/**
 * Stream-based SHA256 hash of a file.
 * Uses fs.createReadStream — never loads the entire file into memory (Pitfall 3).
 * Returns a 64-char lowercase hex string.
 */
export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolveP, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolveP(hash.digest('hex')))
    stream.on('error', reject)
  })
}

export interface ResolvedPdfPath {
  resolvedPath: string
  source: 'absolute' | 'relative'
}

/**
 * Resolve the PDF path from a .clmc project file.
 * Strategy: try absolutePath first; if missing, resolve relativePath relative to
 * the .clmc file's directory. Returns null when neither resolves to an existing file.
 *
 * relativePath may be null (cross-drive save — see Pitfall 4 / D-10).
 */
export function resolvePdfPath(
  clmcFilePath: string,
  absolutePath: string,
  relativePath: string | null
): ResolvedPdfPath | null {
  // Try absolute path first (D-10)
  if (absolutePath && existsSync(absolutePath)) {
    return { resolvedPath: absolutePath, source: 'absolute' }
  }

  // Fall back to relative path (D-10)
  if (relativePath) {
    const resolved = isAbsolute(relativePath)
      ? relativePath
      : resolve(dirname(clmcFilePath), relativePath)
    if (existsSync(resolved)) {
      return { resolvedPath: resolved, source: 'relative' }
    }
  }

  return null
}

/**
 * Compute a relative path from a .clmc file to its PDF.
 * Returns null when the two paths are on different Windows drive letters (Pitfall 4).
 * Uses parse(...).root to detect cross-drive — this is the canonical Node.js guard.
 */
export function computeRelativePath(clmcFilePath: string, pdfPath: string): string | null {
  // Cross-drive guard (Pitfall 4): path.relative returns an absolute path when roots differ,
  // which is not useful as a portability-enabling relative fallback.
  if (parse(clmcFilePath).root !== parse(pdfPath).root) return null
  return relative(dirname(clmcFilePath), pdfPath)
}

/**
 * Ensure the given file path ends with the .clmc extension (case-insensitive).
 * Appends '.clmc' if the current extension is anything else (Pitfall 6).
 */
export function enforceClmcExtension(filePath: string): string {
  return extname(filePath).toLowerCase() === '.clmc' ? filePath : filePath + '.clmc'
}
