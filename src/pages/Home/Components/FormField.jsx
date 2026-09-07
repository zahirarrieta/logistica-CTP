export default function FormField({ 
  label, 
  type = "text", 
  placeholder, 
  required = false, 
  className = "",
  name,
  value,
  onChange,
  options = [],
  unit = ""
}) {
  const baseClasses = "peer w-full px-3 py-2 rounded-md bg-white border-2 border-black/10 focus:outline-none focus:border-brand-cyan/60 focus:ring-2 focus:ring-brand-cyan/30 text-brand-ink placeholder-transparent"
  const isFilled = value !== undefined && value !== null && `${value}` !== ""
  const baseLabel = "pointer-events-none absolute left-2 bg-white px-1 rounded transition-all"
  const floatingWhenFilled = isFilled ? "-top-2 text-[0.7rem] text-brand-deep" : "top-2 text-[0.78rem] text-brand-deep"
  const focusFloating = "peer-focus:-top-2 peer-focus:text-[0.7rem] peer-focus:text-brand-cyan"
  const alwaysFloatClass = "-top-2 text-[0.7rem] text-brand-deep " + focusFloating
  
  if (type === "select") {
    return (
      <div className={`relative ${className}`}>
        <select 
          value={value}
          onChange={onChange}
          name={name}
          className={`${baseClasses} appearance-none cursor-pointer`}
          required={required}
        >
          <option value="" disabled hidden>{placeholder || ""}</option>
          {options.map((option, index) => (
            <option key={index} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className={`${baseLabel} ${alwaysFloatClass}`}>
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
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
        <label className={`${baseLabel} ${alwaysFloatClass}`}>
          {label}{required && <span className="text-red-500 ml-1">*</span>}
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
          <span className="px-3 py-2 bg-white border-2 border-l-0 border-black/10 rounded-r-md text-sm font-medium text-gray-600">
            {unit}
          </span>
        </div>
        <label className={`${baseLabel} ${floatingWhenFilled} ${focusFloating}`}>
          {label}{required && <span className="text-red-500 ml-1">*</span>}
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
        className={baseClasses}
        required={required}
      />
      <label className={`${baseLabel} ${floatingWhenFilled} ${focusFloating}`}>
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
    </div>
  )
}
