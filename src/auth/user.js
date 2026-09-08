export function shortName(account) {
  const name = account?.name?.trim()
  if (!name) return 'Usuario'
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1][0]}.`
}