import { useState, forwardRef } from 'react'

// Campo de email con dominio fijo visualmente integrado.
// Se ve como un solo campo "usuario@dominio.com" donde:
// - La parte de usuario es editable
// - @dominio.com es estático, gris, no editable
// Útil para que el usuario vea el email completo que se va a crear/usar.
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

  // Sanitiza al escribir: quita @ y lo que venga después
  const manejarCambio = (e) => {
    let v = e.target.value
    const i = v.indexOf('@')
    if (i >= 0) v = v.slice(0, i)
    onChange?.(v)
  }

  // Al salir, asegura que no haya @ (por si autollenó el navegador)
  const manejarBlur = (e) => {
    const limpio = e.target.value.split('@')[0]
    if (limpio !== e.target.value) onChange?.(limpio)
    onBlur?.(e)
  }

  const largoMax = maxLength ? maxLength - dominio.length : undefined

  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="relative flex-1 flex items-center">
        <input
          ref={ref}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={manejarCambio}
          onBlur={manejarBlur}
          onFocus={() => setFoco(true)}
          onFocusCapture={() => setFoco(true)}
          onBlurCapture={() => setFoco(false)}
          maxLength={largoMax}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-label={ariaLabel || `Usuario (se añade ${dominio} automáticamente)`}
          aria-invalid={error}
          className={`
            w-full rounded-l-xl border border-transparent bg-white px-4 py-3 text-brand-ink
            placeholder:text-brand-ink/40 outline-none transition
            focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20
            ${error ? 'border-red-400 focus:border-red-400' : foco ? 'border-brand-cyan' : 'border-brand-ink/15'}
            ${disabled ? 'bg-brand-ink/5 cursor-not-allowed' : ''}
          `}
          {...resto}
        />
      </div>
      <div className="relative flex items-center bg-brand-ink/5 border-y border-brand-ink/10 border-r-0 px-4 py-3 text-sm font-medium text-brand-ink/50 select-none pointer-events-none">
        {dominio}
      </div>
    </div>
  )
})

CampoEmailDominio.displayName = 'CampoEmailDominio'

export default CampoEmailDominio