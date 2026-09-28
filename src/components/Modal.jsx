const OVERLAY_BASE =
  'fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto'

export default function Modal({ onClose, overlayClassName = OVERLAY_BASE, children }) {
  return (
    <div className={overlayClassName} onClick={onClose || undefined}>
      {children}
    </div>
  )
}
