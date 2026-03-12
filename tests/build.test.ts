import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const distElectron = path.join(root, 'dist-electron')
const assetsDir = path.join(dist, 'assets')

// ─── helpers ───────────────────────────────────────────────────────────────

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8')
}

function assetsOf(ext: string): string[] {
  if (!fs.existsSync(assetsDir)) return []
  return fs.readdirSync(assetsDir).filter((f) => f.endsWith(ext))
}

// ─── frontend (Vite renderer) ──────────────────────────────────────────────

describe('dist/ (renderer build)', () => {
  it('index.html existe', () => {
    expect(fs.existsSync(path.join(dist, 'index.html'))).toBe(true)
  })

  it('index.html não está vazio', () => {
    const html = readFile(path.join(dist, 'index.html'))
    expect(html.length).toBeGreaterThan(100)
  })

  it('index.html referencia o bundle JS gerado', () => {
    const html = readFile(path.join(dist, 'index.html'))
    const jsFiles = assetsOf('.js')
    expect(jsFiles.length).toBeGreaterThanOrEqual(1)
    // algum script tag aponta para assets/
    expect(html).toMatch(/src="[./]*assets\/[^"]+\.js"/)
  })

  it('exatamente um bundle JS principal em assets/', () => {
    const jsFiles = assetsOf('.js')
    expect(jsFiles.length).toBeGreaterThanOrEqual(1)
  })

  it('bundle JS principal tem tamanho realista (> 50 KB)', () => {
    const jsFiles = assetsOf('.js')
    expect(jsFiles.length).toBeGreaterThanOrEqual(1)

    const mainBundle = jsFiles.find((f) => f.startsWith('index')) ?? jsFiles[0]
    const size = fs.statSync(path.join(assetsDir, mainBundle)).size
    expect(size).toBeGreaterThan(50 * 1024)
  })

  it('exatamente um CSS em assets/', () => {
    const cssFiles = assetsOf('.css')
    expect(cssFiles.length).toBeGreaterThanOrEqual(1)
  })

  it('CSS principal tem tamanho realista (> 1 KB)', () => {
    const cssFiles = assetsOf('.css')
    const mainCss = cssFiles.find((f) => f.startsWith('index')) ?? cssFiles[0]
    const size = fs.statSync(path.join(assetsDir, mainCss)).size
    expect(size).toBeGreaterThan(1024)
  })
})

// ─── electron main process ─────────────────────────────────────────────────

describe('dist-electron/main.js', () => {
  let content: string

  beforeAll(() => {
    content = readFile(path.join(distElectron, 'main.js'))
  })

  it('arquivo existe', () => {
    expect(fs.existsSync(path.join(distElectron, 'main.js'))).toBe(true)
  })

  it('não está vazio (> 5 KB)', () => {
    const size = fs.statSync(path.join(distElectron, 'main.js')).size
    expect(size).toBeGreaterThan(5 * 1024)
  })

  it('começa com "use strict"', () => {
    expect(content.trimStart()).toMatch(/^"use strict"/)
  })

  it('contém BrowserWindow', () => {
    expect(content).toContain('BrowserWindow')
  })

  it('contém ipcMain.handle', () => {
    expect(content).toMatch(/ipcMain\.handle|ipcMain\[/)
  })

  it('contém contextIsolation: true', () => {
    expect(content).toContain('contextIsolation:!0')
  })

  it('registra handler session:check', () => {
    expect(content).toContain('"session:check"')
  })

  it('registra handler session:login', () => {
    expect(content).toContain('"session:login"')
  })

  it('registra handler odoo:tasks', () => {
    expect(content).toContain('"odoo:tasks"')
  })

  it('registra handler activity:open', () => {
    expect(content).toContain('"activity:open"')
  })

  it('registra handler activity:close', () => {
    expect(content).toContain('"activity:close"')
  })
})

// ─── electron preload ──────────────────────────────────────────────────────

describe('dist-electron/preload.js', () => {
  let content: string

  beforeAll(() => {
    content = readFile(path.join(distElectron, 'preload.js'))
  })

  it('arquivo existe', () => {
    expect(fs.existsSync(path.join(distElectron, 'preload.js'))).toBe(true)
  })

  it('não está vazio', () => {
    expect(content.length).toBeGreaterThan(200)
  })

  it('usa contextBridge.exposeInMainWorld', () => {
    expect(content).toContain('contextBridge')
    expect(content).toContain('exposeInMainWorld')
  })

  it('expõe a API "api" ao renderer', () => {
    expect(content).toContain('"api"')
  })

  it('expõe getTasks', () => {
    expect(content).toContain('getTasks')
  })

  it('expõe login', () => {
    expect(content).toContain('login')
  })

  it('expõe getCurrentActivity', () => {
    expect(content).toContain('getCurrentActivity')
  })

  it('expõe openActivity', () => {
    expect(content).toContain('openActivity')
  })

  it('expõe closeActivity', () => {
    expect(content).toContain('closeActivity')
  })
})
