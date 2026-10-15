import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      // updateViaCache:'none' obliga a buscar siempre el sw.js fresco: con la
      // caché HTTP de por medio un equipo podía quedarse con un service worker
      // viejo (el que servía el bundle anterior) y no salir nunca de esa versión.
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registro) => {
        const buscar = () => registro.update().catch(() => {})
        // Al terminar de cargar y cada vez que el usuario vuelve a la pestaña se
        // busca si hay una versión nueva del service worker.
        buscar()
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) buscar()
        })
        setInterval(buscar, 30 * 60 * 1000)
      })
      .catch(() => {})
  })
}