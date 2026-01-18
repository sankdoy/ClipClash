import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['functions', 'workers']
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.wrangler'])

const DISALLOWED_SRC = /(^|\/)src\//
const ALLOWED_SRC_TYPES = /(^|\/)src\/types(\/|$)/

const importRegex = /(?:from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\))/g

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue
      walk(join(dir, entry.name), files)
    } else if (EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      files.push(join(dir, entry.name))
    }
  }
  return files
}

function checkImports(filePath) {
  const text = readFileSync(filePath, 'utf8')
  const problems = []
  let match
  while ((match = importRegex.exec(text)) !== null) {
    const path = match[1] || match[2] || match[3] || ''
    if (!path) continue
    if (DISALLOWED_SRC.test(path) && !ALLOWED_SRC_TYPES.test(path)) {
      problems.push(path)
    }
  }
  return problems
}

let hasErrors = false
for (const root of ROOTS) {
  for (const filePath of walk(root)) {
    const problems = checkImports(filePath)
    if (problems.length > 0) {
      hasErrors = true
      console.error(`Disallowed import in ${filePath}:`)
      for (const entry of problems) {
        console.error(`  - ${entry}`)
      }
    }
  }
}

if (hasErrors) {
  process.exit(1)
}
