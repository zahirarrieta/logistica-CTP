import { useState } from 'react'

// Campo de email con dominio fijo.
//
// El dominio va DENTRO del input, como una etiqueta pegada a la derecha, para
// que se lea el correo completo (`nombre@ctpmedica.com`) sin que el usuario
// tenga que escribirlo ni sospechar que se le va a añadir por sorpresa.
//
// El input real no lleva ni borde ni fondo propios: es el contenedor el que los
// pinta. Así el campo se ve exactamente igual que el de contraseña de al lado
// (mismo alto, mismo radio, mismo borde) en vez de ser dos cajas pegadas.
//
// `tono` permite el mismo componente en el login (oscuro) y en los modales
// blancos de registro y cambio de clave.
const DOMINIO_POR_DEFECTO = '@ctpmedica.com'

const TONOS = {
  oscuro: {
    contenedor:
      'rounded-xl border border-brand-cyan/40 bg-black/25 focus-within:border-brand-cyan/70 ' +
      'focus-within:ring-2 focus-within:ring-brand-cyan/25',
    input: 'text-brand-mist placeholder:text-brand-mist/40',
    chip: 'bg-brand-ink/80 text-brand-cyan ring-brand-cyan/30',
  },
  claro: {
    contenedor:
      'rounded-xl border border-brand-cyan/45 bg-white focus-within:border-brand-cyan ' +
      'focus-within:ring-2 focus-within:ring-brand-cyan/25',
    input: 'text-brand-ink placeholder:text-brand-ink/40',
    chip: 'bg-brand-ink/10 text-brand-ink/60 ring-brand-ink/10',
  },
}

export default function CampoEmailDominio({
  value,
  onChange,
  onBlur,
  placeholder = 'Correo adicional',
  dominio = DOMINIO_POR_DEFECTO,
  required = true,
  autoComplete = 'username',
  disabled = false,
  className = '',
  tono = 'oscuro',
  error = false,
  name,
  invalid,
  ...resto
}) {
  const [foco, setFoco] = useState(false)
  const estilos = TONOS[tono] || TONOS.oscuro
  const marcaError = error || invalid

  // El usuario solo escribe la parte anterior a la `@`. Si el gestor de
  // contraseñas autocompleta el correo entero, se recorta por aquí.
  const sanear = (texto) => {
    const i = texto.indexOf('@')
    return i >= 0 ? texto.slice(0, i) : texto
  }

  const alEscribir = (e) => onChange?.(sanear(e.target.value))
  const alSalir = (e) => {
    const limpio = sanear(e.target.value)
    if (limpio !== e.target.value) onChange?.(limpio)
    onBlur?.(e)
  }

  return (
    <div
      className={`relative flex items-center transition ${estilos.contenedor} ${className}`}
      data-foco={foco || undefined}
    >
      <input
        type="text"
        name={name}
        value={value}
        onChange={alEscribir}
        onBlur={alSalir}
        onFocus={() => setFoco(true)}
        onBlurCapture={() => setFoco(false)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        maxLength={190 - dominio.length}
        aria-label={`Correo adicional, se completa con ${dominio}`}
        aria-invalid={marcaError || undefined}
        className={`min-w-0 flex-1 bg-transparent px-4 py-3 outline-none ${estilos.input}`}
        {...resto}
      />
      <span
        aria-hidden="true"
        className={`mr-2 shrink-0 select-none rounded-lg px-2.5 py-1 text-[13px] font-semibold ring-1 ${estilos.chip}`}
      >
        {dominio}
      </span>
    </div>
  )
}
