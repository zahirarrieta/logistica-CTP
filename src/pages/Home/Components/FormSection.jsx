export default function FormSection({ title, icon: Icon, children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl shadow-[0_8px_24px_rgba(2,6,23,0.06)] border border-gray-200 overflow-hidden ${className}`}>
      <div className="px-4 sm:px-6 py-3 text-white bg-gradient-to-r from-brand-ink to-brand-deep">
        <h3 className="text-base sm:text-lg font-extrabold tracking-wide inline-flex items-center gap-2">
          {Icon ? <Icon className="text-brand-cyan" /> : null}
          {title}
        </h3>
      </div>
      <div className="p-6 space-y-4">
        {children}
      </div>
    </div>
  )
}
