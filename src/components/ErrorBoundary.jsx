import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary capturó un error:', error, info)
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div className="min-h-screen grid place-items-center bg-[#dfe9f5] text-brand-ink p-6">
          <div className="w-full max-w-lg rounded-2xl border border-red-300 bg-white p-6 sm:p-8 text-center shadow-2xl">
            <p className="text-lg sm:text-xl font-extrabold text-red-700 mb-2">Ocurrió un error inesperado</p>
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
          </div>
        </div>
      )
    }
    return this.props.children
  }
}