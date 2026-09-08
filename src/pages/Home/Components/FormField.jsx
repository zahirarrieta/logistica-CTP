import { useState } from 'react'

export default function FormField({ 
  label, 
  type = "text", 
  required = false, 
  className = "",
  name,
  value,
  onChange,
  options = [],
  unit = "",
  readOnly = false,
  icon,
  invalid = false
}) {
  const [open, setOpen] = useState(false)
  const invalidClasses = "border-red-400 focus:border-red-400 focus:ring-red-200"
  const baseClasses = "peer w-full px-3 py-2 rounded-md bg-white border border-brand-deep/20 focus:outline-none focus:border-brand-deep/60 focus:ring-2 focus:ring-brand-deep/15 text-brand-ink placeholder-transparent"
  const readOnlyClasses = readOnly
    ? "read-only:bg-brand-mist/40 read-only:border-brand-deep/40"
    : ""
  const isFilled = value !== undefined && value !== null && `${value}` !== ""
  const baseLabel = "pointer-events-none absolute left-2 bg-white px-1 rounded transition-all"
  const floatingWhenFilled = isFilled ? "-top-2 text-[0.7rem] text-brand-ink" : "top-2 text-[0.78rem] text-brand-ink"
  const focusFloating = "peer-focus:-top-2 peer-focus:text-[0.7rem] peer-focus:text-brand-deep"
  const alwaysFloatClass = "-top-2 text-[0.7rem] text-brand-ink " + focusFloating
  const fieldIcon = icon ? (
    <span className="shrink-0 text-brand-deep">{icon}</span>
  ) : null
  const iconLabel = `${baseLabel} inline-flex items-center gap-1`

  if (type === "select") {
    const selected = options.find((o) => o.value === value)
    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title={selected?.label}
          className={`appearance-none cursor-pointer text-left w-full px-3 py-2 rounded-md bg-brand-mist/40 border text-brand-ink placeholder-transparent focus:outline-none focus:border-brand-deep/60 focus:ring-2 focus:ring-brand-deep/15 transition-colors ${
            invalid ? invalidClasses : selected?.label ? 'border-brand-deep/60' : 'border-brand-deep/30'
          }`}
        >
          {selected?.label ? (
            <span className="block truncate font-medium text-brand-ink">{selected.label}</span>
          ) : (
            <span className="block truncate text-brand-ink/40">Seleccionar tipo…</span>
          )}
        </button>
        <label className={`${iconLabel} ${alwaysFloatClass}`}>
          {fieldIcon}
          <span>{label}{required && <span className="text-red-500 ml-1">*</span>}</span>
        </label>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg
            className={`w-5 h-5 text-brand-deep/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute z-50 left-0 right-0 top-[calc(100%+6px)] bg-white rounded-md border border-brand-deep/20 shadow-xl max-h-56 overflow-y-auto animate-scaleIn divide-y divide-brand-deep/10">
              {options.map((o) => {
                const isSelected = o.value === value
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange({ target: { name, value: o.value } })
                      setOpen(false)
                    }}
                    title={o.label}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                      isSelected
                        ? "bg-brand-deep/15 text-brand-ink font-bold"
                        : "text-brand-ink hover:bg-brand-deep/15"
                    }`}
                  >
                    <span className="truncate">{o.label}</span>
                    {isSelected && (
                      <svg className="w-4 h-4 shrink-0 text-brand-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    )
  }

  if (type === "date") {
    return (
      <div className={`relative ${className}`}>
        <input
          type="date"
          value={value}
          onChange={onChange}
          placeholder=" "
          name={name}
          className={baseClasses}
          required={required}
        />
        <label className={`${iconLabel} ${alwaysFloatClass}`}>
          {fieldIcon}
          <span>{label}{required && <span className="text-red-500 ml-1">*</span>}</span>
        </label>
      </div>
    )
  }

  if (unit) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center">
          <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder=" "
            name={name}
            className={`${baseClasses} rounded-r-none border-r-0`}
            required={required}
          />
          <span className="px-3 py-2 bg-white border border-l-0 border-brand-deep/20 rounded-r-md text-sm font-medium text-gray-600">
            {unit}
          </span>
        </div>
        <label className={`${iconLabel} ${floatingWhenFilled} ${focusFloating}`}>
          {fieldIcon}
          <span>{label}{required && <span className="text-red-500 ml-1">*</span>}</span>
        </label>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder=" "
        name={name}
        className={`${baseClasses} ${readOnlyClasses} ${invalid ? invalidClasses : ''}`}
        required={required}
        readOnly={readOnly}
      />
      <label className={`${iconLabel} ${floatingWhenFilled} ${focusFloating}`}>
        {fieldIcon}
        <span>{label}{required && <span className="text-red-500 ml-1">*</span>}</span>
      </label>
    </div>
  )
}