import { forwardRef, useRef, useEffect } from 'react'

// 带行号的文本编辑器
interface CodeEditorProps {
  value: string
  onChange: (v: string) => void
  readOnly?: boolean
  placeholder?: string
  autoFocus?: boolean
  textareaRef?: React.RefObject<HTMLTextAreaElement>
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  className?: string
  editorKey?: string
}

export default forwardRef<HTMLTextAreaElement, CodeEditorProps>(function CodeEditor(
  { value, onChange, readOnly, placeholder, autoFocus, textareaRef, onKeyDown, className = '' },
  ref
) {
  const editorElementRef = useRef<HTMLTextAreaElement | null>(null)

  const combinedRef = (elem: HTMLTextAreaElement | null) => {
    editorElementRef.current = elem
    if (typeof ref === 'function') {
      ref(elem)
    } else if (ref) {
      ;(ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = elem
    }
    if (textareaRef) {
      const refObject = textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>
      refObject.current = elem
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  return (
    <div className="flex overflow-hidden h-full">
      <textarea
        ref={combinedRef}
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        readOnly={readOnly}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`flex-1 w-full p-2 bg-transparent text-gray-900 dark:text-white focus:outline-none font-mono resize-none ${className}`}
        spellCheck={false}
        style={{ lineHeight: '1.5', caretColor: '#f59e0b' }}
      />
    </div>
  )
})