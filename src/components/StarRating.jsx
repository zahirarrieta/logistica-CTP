import { Fragment, useId } from 'react'
import './starRating.css'

const STAR_PATH =
  'M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z'

export default function StarRating({ value = 0, onChange, disabled = false, compact = false, max = 5 }) {
  const uid = useId()
  const niveles = Array.from({ length: max }, (_, i) => max - i)

  return (
    <div className={`sr-wrap${compact ? ' sr-compact' : ''}${disabled ? ' sr-disabled' : ''}`} role="radiogroup" aria-label="Calificación">
      {niveles.map((n) => {
        const id = `${uid}-${n}`
        return (
          <Fragment key={n}>
            <input
              type="radio"
              className="sr-input"
              id={id}
              name={uid}
              value={n}
              checked={value === n}
              disabled={disabled}
              onChange={(e) => {
                if (e.target.checked) onChange?.(n)
              }}
            />
            <label className="sr-label" htmlFor={id} title={`${n} estrellas`}>
              <svg viewBox="0 0 576 512" height="1em" xmlns="http://www.w3.org/2000/svg">
                <path d={STAR_PATH} />
              </svg>
            </label>
          </Fragment>
        )
      })}
    </div>
  )
}