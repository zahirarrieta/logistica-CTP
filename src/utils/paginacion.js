// Páginas visibles alrededor de la actual, con «⬦» cuando se salta. Se comparte
// entre las tablas (inventario, solicitudes y demás) para que la paginación se
// vea igual en todas y no se desborde en pantallas pequeñas.
export function paginasVisibles(pagina, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const cerca = [1, 2, pagina - 1, pagina, pagina + 1, total - 1, total]
    .filter((p) => p >= 1 && p <= total)
    .filter((p, i, a) => a.indexOf(p) === i)
    .sort((a, b) => a - b)
  const salida = []
  let anterior = 0
  for (const p of cerca) {
    if (p - anterior > 1) salida.push('⬦')
    salida.push(p)
    anterior = p
  }
  return salida
}
