import { apiFetch, iniciarSesion } from './apiClient.js'

// ============================================================================
// CHATBOT INVENTARIO
// Consulta el inventario mediante lenguaje natural
// ============================================================================

export async function preguntarInventario(pregunta) {
  await iniciarSesion()
  const data = await apiFetch('/api/chatbot/inventario', {
    method: 'POST',
    body: { pregunta }
  })
  return data
}