import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id)
    }, 3000)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  const styles = {
    success: {
      bg: 'bg-emerald-500',
      icon: CheckCircle,
    },
    error: {
      bg: 'bg-red-500',
      icon: AlertCircle,
    },
    info: {
      bg: 'bg-blue-500',
      icon: Info,
    },
  }

  const { bg, icon: Icon } = styles[toast.type]

  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium animate-in slide-in-from-right-5 fade-in-0 duration-300 ${bg}`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-1 p-0.5 hover:bg-white/20 rounded transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}