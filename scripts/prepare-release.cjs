/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type -- Reproducible Node packaging hook. */
const fs = require('node:fs')
const path = require('node:path')
function prepareRelease() {
  const root = path.resolve(__dirname, '..')
  const visited = new Map()
  function locate(from, name) {
    let current = from
    while (current.startsWith(root)) {
      const target = path.join(current, 'node_modules', name)
      if (fs.existsSync(path.join(target, 'package.json'))) return target
      if (current === root) break
      current = path.dirname(current)
    }
    return null
  }
  function visit(from, dependencies, optional = false) {
    for (const name of Object.keys(dependencies || {})) {
      const target = locate(from, name)
      if (!target) {
        if (optional) continue
        throw new Error(`Missing production package ${name}`)
      }
      if (visited.has(target)) continue
      const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'))
      const files = fs
        .readdirSync(target)
        .filter((name) => /^(licen[sc]e|copying|notice)(\.|$)/i.test(name))
      const notices = files.map((file) => ({
        file,
        text: fs.readFileSync(path.join(target, file), 'utf8')
      }))
      if (!notices.length) {
        const readme = fs.readdirSync(target).find((name) => /^readme(\.|$)/i.test(name))
        if (readme)
          notices.push({ file: readme, text: fs.readFileSync(path.join(target, readme), 'utf8') })
      }
      visited.set(target, {
        path: path.relative(root, target).replaceAll('\\', '/'),
        name: pkg.name,
        version: pkg.version,
        license: pkg.license || null,
        author: pkg.author || null,
        repository: pkg.repository || null,
        notices
      })
      visit(target, pkg.dependencies)
      visit(target, pkg.optionalDependencies, true)
    }
  }
  visit(root, JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies)
  fs.writeFileSync(
    path.join(root, 'resources/third-party-notices.json'),
    JSON.stringify(
      {
        provenance:
          'Exact installed production dependency metadata and supplied license/readme text; missing upstream declarations remain explicit nulls for release review.',
        packages: [...visited.values()].sort((a, b) => a.path.localeCompare(b.path))
      },
      null,
      2
    ) + '\n'
  )
}
module.exports = prepareRelease
if (require.main === module) prepareRelease()
