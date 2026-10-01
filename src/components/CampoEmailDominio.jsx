import { useRef } from 'react'

// Campo de email con dominio fijo.
//
// El dominio va DENTRO del input, como una etiqueta pegada a la derecha, para
// que se lea el correo completo (`nombre@ctpmedica.com`) sin que el usuario
// tenga que escribirlo. La `@` y el dominio no se pueden teclear: se recortan
// en cuanto se escriben, porque el dominio ya está puesto en la etiqueta.
//
// CONTRATO: `onChange` recibe el TEXTO ya leído y normalizado, no el evento. Se
// lee del input porque el autocompletado del navegador escribe en el DOM sin
// pasar por React y el evento puede llegar sin `target`. Quien lo use junto a
// CampoClave (que sí entrega el evento) tiene que aceptar las dos formas en su
// handler.
//
// El input real no lleva ni borde ni fondo propios: los pinta el contenedor. Así
// el campo se ve igual que el de contraseña de al lado (mismo alto, mismo radio)
// en vez de ser dos cajas pegadas.
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
  value = '',
  onChange,
  onBlur,
  placeholder = 'Correo',
  dominio = DOMINIO_POR_DEFECTO,
  required = true,
  autoComplete = 'username',
  disabled = false,
  className = '',
  tono = 'oscuro',
  error = false,
  invalid,
  name,
  ...resto
}) {
  const inputRef = useRef(null)
  const estilos = TONOS[tono] || TONOS.oscuro
  const marcaError = error || invalid

  // Normaliza a la parte anterior a la `@`, que es lo único que se escribe: el
  // dominio lo pone la etiqueta de al lado.
  const normalizar = (texto) => {
    const i = texto.indexOf('@')
    return i >= 0 ? texto.slice(0, i) : texto
  }

  // Se lee del DOM, no del evento: si el navegador autocompletó un correo
  // entero sin avisar a React, aquí es donde se recoge y se recorta igual.
  const alEscribir = () => onChange?.(normalizar(inputRef.current?.value ?? ''))

  // Red de seguridad para el autocompletado que no dispara ningún evento: si al
  // salir el DOM trae la `@`, se normaliza igualmente.
  const alSalir = () => {
    const limpio = normalizar(inputRef.current?.value ?? '')
    if (limpio !== value) onChange?.(limpio)
    onBlur?.()
  }

  return (
    <div className={`relative flex items-center transition ${estilos.contenedor} ${className}`}>
      <input
        ref={inputRef}
        type="text"
        name={name}
        value={value}
        onChange={alEscribir}
        onBlur={alSalir}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        maxLength={190 - dominio.length}
        aria-label={`Correo, se completa con ${dominio}`}
        aria-invalid={marcaError || undefined}
        className={`autofill-transparente min-w-0 flex-1 bg-transparent px-4 py-3 outline-none ${estilos.input}`}
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
