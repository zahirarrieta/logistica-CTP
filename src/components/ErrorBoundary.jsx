import { Component } from 'react'

const CLAVE_RECARGA = 'ctp_recarga_auto_1'

// Error típico cuando se publica una versión nueva: el navegador tenía la
// página vieja abierta y pide un chunk (assets/*.js) que ya no existe.
function esErrorDeVersion(error) {
  if (!error) return false
  const msg = String((error && error.message) || error)
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Loading chunk/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  )
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, esVersion: false }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary capturó un error:', error, info)

    // Si es un chunk faltante por una versión nueva, se recarga automáticamente
    // una sola vez por sesión: la página nueva carga los assets vigentes.
    if (esErrorDeVersion(error)) {
      this.setState({ esVersion: true })
      try {
        if (!sessionStorage.getItem(CLAVE_RECARGA)) {
          sessionStorage.setItem(CLAVE_RECARGA, '1')
          window.location.reload()
        }
      } catch {
        // sin almacenamiento disponible: se queda en la pantalla de error
      }
    }
  }

  handleReset = () => {
    this.setState({ error: null, esVersion: false })
  }

  render() {
    const { error, esVersion } = this.state
    if (error) {
      return (
        <div className="min-h-screen grid place-items-center bg-[#dfe9f5] text-brand-ink p-6">
          <div className="w-full max-w-lg rounded-2xl border border-red-300 bg-white p-6 sm:p-8 text-center shadow-2xl">
            {esVersion ? (
              <>
                <p className="text-lg sm:text-xl font-extrabold text-brand-deep mb-2">
                  Se publicó una versión nueva
                </p>
                <p className="text-sm text-brand-ink/70 mb-5">
                  La pantalla quedó abierta con una versión anterior. Recarga para usar la
                  versión más reciente.
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-6 py-2.5 text-sm font-bold text-brand-ink shadow-cyanGlow transition"
                >
                  Actualizar y recargar
                </button>
              </>
            ) : (
              <>
                <p className="text-lg sm:text-xl font-extrabold text-red-700 mb-2">
                  Ocurrió un error inesperado
                </p>
                <p className="text-xs sm:text-sm font-mono text-red-600 break-words bg-red-50 rounded-xl p-3 mb-5 text-left max-h-48 overflow-y-auto">
                  {String(error?.message || error)}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={this.handleReset}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-2 text-sm font-bold text-white hover:bg-brand-deep transition"
                  >
                    Reintentar
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-5 py-2 text-sm font-bold text-brand-ink shadow-cyanGlow transition"
                  >
                    Recargar página
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}