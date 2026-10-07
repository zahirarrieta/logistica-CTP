// ============================================================================
// CHEQUEO DE JSX SIN IMPORTAR
// ============================================================================
// `eslint` con `no-undef` NO revisa los nombres de los componentes JSX, así
// que un `<MdTimer />` o un `<RiSteering2Line />` sin import aparece limpio en
// `npm run lint` y revienta en producción con un ReferenceError en el bundle
// (fue exactamente el fallo de Solicitudes / SeguimientoModal).
//
// Este chequeo recorre src/, saca las etiquetas `<Mayúscula` de cada archivo y
// las compara con lo que ese archivo importa o declara. Si algo queda suelto,
// sale con código 1 y `npm run lint` falla.
//
// Uso:  node scripts/checar-jsx.cjs
// ============================================================================
'use strict'

const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..', 'src')
const archivos = []

function caminar(dir) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name)
    if (entrada.isDirectory()) caminar(ruta)
    else if (/\.(jsx?|tsx?)$/.test(entrada.name)) archivos.push(ruta)
  }
}
caminar(RAIZ)

// Nombres que el archivo trae de fuera o define él mismo.
function definidos(texto) {
  const nombres = new Set()

  // import X, { a, b as c } from '…'  ·  import '…' (sin cláusula: se omite)
  for (const m of texto.matchAll(
    /import\s+(?:([^;'"]+?)\s+from\s+)?['"][^'"]+['"]/g
  )) {
    const clause = m[1]
    if (!clause) continue
    const named = clause.match(/\{([^}]+)\}/)
    if (named) {
      for (const parte of named[1].split(',')) {
        const item = parte.trim()
        if (!item) continue
        const alias = item.split(/\s+as\s+/)[1]
        nombres.add((alias || item).trim())
      }
    }
    const porDefecto = clause
      .replace(/\{[^}]+\}/, '')
      .replace(/,/g, ' ')
      .trim()
      .split(/\s+/)[0]
    if (porDefecto && porDefecto !== 'from') nombres.add(porDefecto)
  }

  // function foo / class Foo / const foo = … (cubre también los componentes
  // declarados en el mismo archivo)
  for (const m of texto.matchAll(
    /\b(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g
  )) {
    nombres.add(m[1])
  }

  return nombres
}

const problemas = []
for (const archivo of archivos) {
  const texto = fs.readFileSync(archivo, 'utf8')
  const nombres = definidos(texto)
  const usados = new Set()
  for (const m of texto.matchAll(/<([A-Z][A-Za-z0-9_$]*)/g)) usados.add(m[1])
  for (const usado of usados) {
    if (!nombres.has(usado)) {
      problemas.push(
        `${path.relative(path.join(__dirname, '..'), archivo)} → <${usado}>`
      )
    }
  }
}

if (problemas.length === 0) {
  console.log('[checar-jsx] sin componentes JSX sin importar')
  process.exit(0)
}
console.error('[checar-jsx] componentes usados sin importar ni declarar:')
for (const p of problemas) console.error(`  ${p}`)
process.exit(1)
