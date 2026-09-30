import { useState } from 'react'
import { MdVisibility, MdVisibilityOff } from 'react-icons/md'

// Campo de contraseña con botón para verla. Se usa en el login, en el alta de
// cuenta y en el cambio de clave, así que vive en su propio componente: tres
// copias del mismo input con el mismo botón se desincronizan solas.
//
// El botón va dentro del input (a la derecha) y no debajo, porque en el móvil
// añade altura y empuja el formulario hacia abajo.
export default function CampoClave({
  value,
  onChange,
  label,
  placeholder = 'Contraseña',
  autoComplete,
  required = true,
  minLength,
  maxLength = 200,
  className = '',
  autoFocus = false,
  name,
  invalid = false,
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        name={name}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={label || placeholder}
        aria-invalid={invalid || undefined}
        className={`${className} pr-12`}
      />
      <button
        type="button"
        // Sin `name`, para que el formulario no lo mande como campo al hacer submit.
        aria-label={visible ? `Ocultar ${label || 'la contraseña'}` : `Ver ${label || 'la contraseña'}`}
        title={visible ? 'Ocultar' : 'Ver'}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 grid place-items-center w-12 text-brand-mist/60 hover:text-brand-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40 rounded-r-xl"
      >
        {visible ? <MdVisibilityOff className="text-xl" /> : <MdVisibility className="text-xl" />}
      </button>
    </div>
  )
}
