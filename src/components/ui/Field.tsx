import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  children: ReactNode
  hint?: string
  className?: string
}

export default function Field({ label, children, hint, className }: FieldProps) {
  return (
    <label className={['field', className].filter(Boolean).join(' ')}>
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  )
}
