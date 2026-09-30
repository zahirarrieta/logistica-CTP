import { useState, forwardRef } from 'react'

// Campo de email con dominio fijo, mismo diseño visual que CampoClave.
// Se ve como un solo input con el dominio fijo a la derecha (como el botón de ver clave).
// El usuario ve:  [ usuario_______________ @ctpmedica.com ]
// Donde @ctpmedica.com tiene el mismo estilo que el botón "ver clave".
const CampoEmailDominio = forwardRef(function CampoEmailDominio({
  value,
  onChange,
  onBlur,
  placeholder = 'Usuario',
  maxLength,
  required = true,
  autoComplete = 'username',
  disabled = false,
  className = '',
  dominio = '@ctpmedica.com',
  error = false,
  'aria-label': ariaLabel,
  ...resto
}, ref) {
  const [foco, setFoco] = useState(false)

  const manejarCambio = (e) => {
    let v = e.target.value
    const i = v.indexOf('@')
    if (i >= 0) v = v.slice(0, i)
    onChange?.(v)
  }

  const manejarBlur = (e) => {
    const limpio = e.target.value.split('@')[0]
    if (limpio !== e.target.value) onChange?.(limpio)
    onBlur?.(e)
  }

  const largoMax = maxLength ? maxLength - dominio.length : undefined

  // Mismas clases base que CampoClave (input + botón derecho)
  const baseInput =
    'w-full rounded-xl border bg-white px-4 py-3 text-brand-ink ' +
    'placeholder:text-brand-ink/40 outline-none transition ' +
    'focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 ' +
    'disabled:bg-brand-ink/5 disabled:cursor-not-allowed'

  const baseBoton =
    'absolute inset-y-0 right-0 grid place-items-center w-24 ' +
    'text-brand-ink/40 select-none pointer-events-none ' +
    'rounded-r-xl border-l border-brand-ink/10 bg-brand-ink/5'

  const bordeError = error
    ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
    : foco
      ? 'border-brand-cyan'
      : 'border-brand-ink/15'

  return (
    <div className={`relative ${className}`}>
      <input
        ref={ref}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          let v = e.target.value
          const i = v.indexOf('@')
          if (i >= 0) v = v.slice(0, i)
          onChange?.(v)
        }}
        onBlur={(e) => {
          const limpio = e.target.value.split('@')[0]
          if (limpio !== e.target.value) onChange?.(limpio)
          onBlur?.(e)
        }}
        onFocus={() => setFoco(true)}
        onBlurCapture={() => setFoco(false)}
        maxLength={maxLength ? maxLength - dominio.length : undefined}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-label={ariaLabel || `Usuario (se añade ${dominio} automáticamente)`}
        aria-invalid={error}
        className={`${baseInput} pr-28 ${bordeError}`}
        {...resto}
      />
      <div
        className={`${baseBoton} ${error ? 'text-red-400 border-red-400' : ''}`}
        aria-hidden="true"
      >
        {dominio}
      </div>
    </div>
  )
})

CampoEmailDominio.displayName = 'CampoEmailDominio'

export default CampoEmailDominio