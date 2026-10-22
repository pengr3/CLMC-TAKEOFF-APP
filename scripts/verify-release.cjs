/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type -- Direct Node release tooling. */
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const asar = require('@electron/asar')
const sevenZip = require('7zip-bin').path7za
const hashFile = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
function walk(root, prefix = '') {
  return fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap((entry) => {
    const name = path.posix.join(prefix, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Unexpected payload symlink: ${name}`)
    return entry.isDirectory() ? walk(root, name) : [name]
  })
}
function inspectArchive(archive, contract = {}) {
  const entries = asar
    .listPackage(archive)
    .map((name) => name.replaceAll('\\', '/').replace(/^\//, ''))
  const files = entries.filter((name) => !asar.statFile(archive, path.normalize(name)).files)
  const errors = []
  const read = (name) => asar.extractFile(archive, path.normalize(name))
  const json = (name) => JSON.parse(read(name).toString('utf8'))
  const has = (name) => files.includes(name)
  const requireFile = (name) => {
    if (!has(name)) errors.push(`Missing required resource: ${name}`)
  }
  for (const name of files) {
    if (
      !/^(out\/(main|preload|renderer)\/|node_modules\/|resources\/(release-notes\.json|third-party-notices\.json|icon\.png)$|package\.json$)/.test(
        name
      ) ||
      /(^|\/)(\.planning|\.git|\.codex|\.agents|\.env[^/]*|test|tests|__tests__|fixtures|scratch|\.cache)(\/|$)/i.test(
        name
      ) ||
      /\.(clmc|bak|pdf|xlsx|csv)$/i.test(name) ||
      /(^|\/)(dev-app-update|app-update)\.yml$/i.test(name) ||
      /(^|\/)cost-library-v1\.json$/i.test(name)
    )
      errors.push(`Disallowed payload: ${name}`)
  }
  for (const name of [
    'package.json',
    'out/main/index.js',
    'out/main/cost-library-worker.js',
    'out/preload/index.js',
    'out/renderer/index.html',
    'resources/release-notes.json'
  ])
    requireFile(name)
  if (!files.some((name) => /^out\/renderer\/(assets\/)?pdf\.worker(?:-[\w-]+)?\.mjs$/.test(name)))
    errors.push('Missing local PDF worker')
  if (!files.some((name) => /^out\/renderer\/assets\/.*\.woff2$/.test(name)))
    errors.push('Missing bundled fonts')
  let pkg, notes
  try {
    pkg = json('package.json')
  } catch {
    errors.push('Unreadable package metadata')
  }
  try {
    notes = json('resources/release-notes.json')
  } catch {
    errors.push('Unreadable release notes')
  }
  if (pkg?.name !== 'clmc-takeoff' || pkg?.main !== './out/main/index.js')
    errors.push('Invalid application metadata')
  if (
    !pkg?.version ||
    (contract.version && pkg.version !== contract.version) ||
    notes?.version !== pkg?.version ||
    !notes?.changes?.length ||
    !notes?.compatibility
  )
    errors.push('Candidate/notes version mismatch or incomplete notes')
  if (has('out/main/index.js')) {
    const main = read('out/main/index.js').toString()
    if (!main.includes('com.clmc.takeoff') || !main.includes('clmc-takeoff'))
      errors.push('Final identity/userData missing from built main')
  }
  const packages = new Map()
  let bundledNotices = []
  if (has('resources/third-party-notices.json')) {
    try {
      bundledNotices = json('resources/third-party-notices.json').packages || []
    } catch {
      errors.push('Unreadable third-party notices')
    }
  }
  for (const name of files.filter((name) =>
    /(^|\/)node_modules\/(?:@[^/]+\/)?[^/]+\/package\.json$/.test(name)
  )) {
    try {
      packages.set(name.slice(0, -'/package.json'.length), json(name))
    } catch {
      errors.push(`Unreadable dependency ${name}`)
    }
  }
  function resolveDependency(from, name) {
    let current = from
    while (true) {
      const candidate = path.posix.join(current, 'node_modules', name)
      if (packages.has(candidate)) return candidate
      if (!current) return null
      current = path.posix.dirname(current)
      if (current === '.') current = ''
    }
  }
  const visited = new Set()
  function visit(from, dependencies) {
    for (const name of Object.keys(dependencies || {})) {
      const target = resolveDependency(from, name)
      if (!target) {
        errors.push(`Missing production dependency ${name} from ${from || 'app'}`)
        continue
      }
      if (visited.has(target)) continue
      visited.add(target)
      const dep = packages.get(target)
      const main = path.posix.normalize(path.posix.join(target, dep.main || 'index.js'))
      if (
        !name.startsWith('@types/') &&
        ![main, `${main}.js`, `${main}/index.js`].some(has) &&
        !dep.exports &&
        !dep.bin
      )
        errors.push(`Missing dependency entry: ${main}`)
      if (
        ['exceljs', 'yauzl'].includes(name) &&
        !files.some(
          (file) =>
            file.startsWith(`${target}/`) && /\/(licen[sc]e|copying|notice)(\.[^/]*)?$/i.test(file)
        )
      )
        errors.push(`Missing license: ${target}`)
      const suppliedNotices = bundledNotices.find(
        (item) => item.name === dep.name && item.version === dep.version
      )
      if (!['exceljs', 'yauzl'].includes(name) && !dep.license && !suppliedNotices)
        errors.push(`Missing license provenance: ${target}`)
      visit(target, dep.dependencies)
      for (const optional of Object.keys(dep.optionalDependencies || {}))
        if (resolveDependency(target, optional))
          visit(target, { [optional]: dep.optionalDependencies[optional] })
    }
  }
  visit('', pkg?.dependencies)
  for (const target of packages.keys())
    if (!visited.has(target)) errors.push(`Dependency outside production closure: ${target}`)
  for (const name of ['exceljs', 'yauzl'])
    if (!visited.has(`node_modules/${name}`)) errors.push(`Missing runtime dependency: ${name}`)
  return {
    errors,
    version: pkg?.version,
    files,
    dependencies: [...visited].map((name) => ({
      path: name,
      name: packages.get(name).name,
      version: packages.get(name).version,
      license: packages.get(name).license || 'upstream-unspecified-review-required',
      licenseFiles: files.filter(
        (file) =>
          file.startsWith(`${name}/`) && /\/(licen[sc]e|copying|notice)(\.[^/]*)?$/i.test(file)
      )
    }))
  }
}
function verifyRelease(directory) {
  const root = path.resolve(directory)
  const source = require(path.resolve(__dirname, '../package.json'))
  const installerName = `${source.name}-${source.version}-x64-setup.exe`
  const installer = path.join(root, installerName)
  const unpacked = path.join(root, 'win-unpacked')
  const archive = path.join(unpacked, 'resources/app.asar')
  if (!fs.existsSync(installer) || !fs.existsSync(archive))
    throw new Error('Build the full offline NSIS candidate first')
  const inspected = inspectArchive(archive, { version: source.version })
  if (inspected.errors.length) throw new Error(inspected.errors.join('\n'))
  const exeBytes = fs.readFileSync(path.join(unpacked, 'clmc-takeoff.exe'))
  const peOffset = exeBytes.readUInt32LE(0x3c)
  if (
    exeBytes.toString('ascii', peOffset, peOffset + 4) !== 'PE\0\0' ||
    exeBytes.readUInt16LE(peOffset + 4) !== 0x8664
  )
    throw new Error('Candidate executable is not a Windows x64 PE')
  const quote = (value) => `'${value.replaceAll("'", "''")}'`
  const metadata = JSON.parse(
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$ErrorActionPreference='Stop'; $env:PSModulePath=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/Modules'; $items = @(${quote(installer)},${quote(path.join(unpacked, 'clmc-takeoff.exe'))}); @($items | ForEach-Object { $f = Get-Item -LiteralPath $_; $s = Get-AuthenticodeSignature -LiteralPath $_; [PSCustomObject]@{file=$f.Name;version=$f.VersionInfo.ProductVersion;description=$f.VersionInfo.FileDescription;product=$f.VersionInfo.ProductName;signatureStatus=[string]$s.Status;publisher=$s.SignerCertificate.Subject} }) | ConvertTo-Json -Compress`
      ],
      { encoding: 'utf8', windowsHide: true }
    )
  )
  for (const file of metadata)
    if (
      ![source.version, `${source.version}.0`].includes(file.version) ||
      file.product !== 'CLMC Takeoff'
    )
      throw new Error(`PE version/product mismatch: ${JSON.stringify(file)}`)
  const payload = walk(unpacked)
  for (const name of payload) {
    if (
      /(^|\/)(app-update\.yml|dev-app-update\.yml|\.env[^/]*|\.planning|cost-library-v1\.json)$|\.(clmc|bak|pdf|xlsx|csv)$/i.test(
        name
      )
    )
      throw new Error(`Disallowed external payload: ${name}`)
    if (
      !/^(resources\/(app\.asar(?:\.unpacked\/.*)?|elevate\.exe)|locales\/[^/]+\.pak|[^/]+\.(exe|dll|pak|bin|dat)|vk_swiftshader_icd\.json|version|LICENSE(?:\.electron\.txt|S\.chromium\.html)?)$/.test(
        name
      )
    )
      throw new Error(`Unexpected external payload: ${name}`)
  }
  for (const name of ['clmc-takeoff.exe', 'LICENSE.electron.txt', 'LICENSES.chromium.html'])
    if (!payload.includes(name)) throw new Error(`Missing runtime/license ${name}`)
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'clmc-installer-inspect-'))
  let installerInventory, embeddedInventory, embeddedHash
  try {
    installerInventory = execFileSync(sevenZip, ['l', '-slt', installer], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 ** 2
    })
    if (!fs.readFileSync(installer).includes(Buffer.from('NullsoftInst')))
      throw new Error('Candidate does not contain an NSIS bootstrap')
    // Builder 26 can append the complete 7z payload directly to its NSIS PE.
    // Older layouts expose it as a named plugin archive. Inspect the actual layout.
    let payloadArchive = installer
    if (installerInventory.includes('app-64.7z')) {
      execFileSync(sevenZip, ['x', '-y', `-o${scratch}`, installer, '$PLUGINSDIR/app-64.7z'], {
        windowsHide: true,
        stdio: 'pipe'
      })
      payloadArchive = path.join(scratch, '$PLUGINSDIR', 'app-64.7z')
      embeddedInventory = execFileSync(sevenZip, ['l', '-slt', payloadArchive], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 ** 2
      })
    } else embeddedInventory = installerInventory
    const embeddedFiles = embeddedInventory
      .split(/\r?\n\r?\n/)
      .filter(
        (block) =>
          !/^Type = /m.test(block) && /^Size = /m.test(block) && !/^Attributes = D/m.test(block)
      )
      .map((block) =>
        block
          .match(/^Path = (.+)$/m)?.[1]
          ?.trim()
          .replaceAll('\\', '/')
      )
      .filter(Boolean)
      .sort()
    if (JSON.stringify(embeddedFiles) !== JSON.stringify([...payload].sort()))
      throw new Error('Actual installer inventory disagrees with inspected unpacked payload')
    execFileSync(
      sevenZip,
      ['x', '-y', `-o${scratch}`, payloadArchive, 'resources/app.asar', 'clmc-takeoff.exe'],
      {
        windowsHide: true,
        stdio: 'pipe'
      }
    )
    embeddedHash = hashFile(path.join(scratch, 'resources/app.asar'))
    if (embeddedHash !== hashFile(archive))
      throw new Error('Installer payload disagrees with inspected unpacked ASAR')
    if (
      hashFile(path.join(scratch, 'clmc-takeoff.exe')) !==
      hashFile(path.join(unpacked, 'clmc-takeoff.exe'))
    )
      throw new Error('Installer executable differs from inspected Windows PE')
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true })
  }
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    version: source.version,
    appId: 'com.clmc.takeoff',
    productName: 'CLMC Takeoff',
    userData: 'clmc-takeoff',
    architecture: 'x64',
    platform: 'win32',
    installerType: 'full-offline-nsis-per-user',
    signing: {
      status: metadata.every((file) => file.signatureStatus === 'NotSigned')
        ? 'unsigned'
        : 'review-actual-signatures',
      publisher: null,
      owner: null,
      files: metadata
    },
    installer: {
      file: installerName,
      sha256: hashFile(installer),
      bytes: fs.statSync(installer).size
    },
    archive: {
      file: 'win-unpacked/resources/app.asar',
      sha256: embeddedHash,
      files: inspected.files
    },
    runtime: {
      expectedElectron: source.devDependencies.electron,
      actualRuntimeEvidence: 'packaged-smoke.json'
    },
    dependencies: inspected.dependencies,
    unpacked: payload.map((file) => ({
      file,
      bytes: fs.statSync(path.join(unpacked, file)).size,
      sha256: hashFile(path.join(unpacked, file))
    })),
    installerInventory,
    embeddedInventory
  }
  fs.writeFileSync(
    path.join(root, 'release-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  )
  return manifest
}
module.exports = { inspectArchive, verifyRelease }
if (require.main === module) {
  try {
    const m = verifyRelease(process.argv[2] || 'dist')
    console.log(
      JSON.stringify({
        status: 'pass',
        version: m.version,
        installer: m.installer,
        archive: m.archive.sha256,
        dependencies: m.dependencies.length
      })
    )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
