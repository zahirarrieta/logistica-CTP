import { useState, useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes/index.jsx'
import Loader from './loader/Loader.jsx'

export default function App() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1800)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <RouterProvider router={router} />
      {loading && <Loader />}
    </>
  )
}
