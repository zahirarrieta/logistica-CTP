import './loaderInventario.css'

// Loader tipo electrocardiograma (línea roja) con el barrido de la animación.
// El color de fondo del barrido debe coincidir con el fondo donde se pinte.
export default function LoaderInventario({ className = '' }) {
  return (
    <div className={`inv-loader ${className}`}>
      <svg
        viewBox="0 0 150 73"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <polyline
          points="0,45.486 38.514,45.486 44.595,33.324 50.676,45.486 57.771,45.486 62.838,55.622 71.959,9 80.067,63.729 84.122,45.486 97.297,45.486 103.379,40.419 110.473,45.486 150,45.486"
          stroke="#dc2626"
          strokeWidth="3"
          strokeMiterlimit="10"
          fill="none"
        />
      </svg>
      <div className="inv-fade-in" />
      <div className="inv-fade-out" />
    </div>
  )
}
