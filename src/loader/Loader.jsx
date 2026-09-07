import './loader.css'

export default function Loader() {
  return (
    <div className="ctp-loader">
      <div className="ctp-content">
        <div className="ctp-pill">
          <div className="ctp-medicine">
            {Array.from({ length: 20 }).map((_, i) => (
              <i key={i} />
            ))}
          </div>
          <div className="ctp-side" />
          <div className="ctp-side" />
        </div>
      </div>
    </div>
  )
}
