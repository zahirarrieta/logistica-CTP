import { createBrowserRouter } from 'react-router-dom'
import Login from '../pages/Login/Login.jsx'
import Home from '../pages/Home/Home.jsx'
import Solicitudes from '../pages/Home/Solicitudes.jsx'
import Administrador from '../pages/Administrador/Administrador.jsx'
import Conductor from '../pages/Conductor/Conductor.jsx'

export const router = createBrowserRouter([
  { path: '/', element: <Login /> },
  { path: '/inicio', element: <Home /> },
  { path: '/solicitudes', element: <Solicitudes /> },
  { path: '/administrador', element: <Administrador /> },
  { path: '/conductor', element: <Conductor /> },
])