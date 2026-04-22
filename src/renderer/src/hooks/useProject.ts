// Full useProject implementation lands in Task 2. This file is created here so
// the open-routing test can import routeOpenByExtension without depending on
// the rest of the hook.

export function routeOpenByExtension(extension: string): 'pdf' | 'clmc' | 'unknown' {
  const normalized = extension.toLowerCase()
  if (normalized === '.pdf') return 'pdf'
  if (normalized === '.clmc') return 'clmc'
  return 'unknown'
}
