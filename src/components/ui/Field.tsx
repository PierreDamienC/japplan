import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  children: ReactNode
  hint?: string
  className?: string
  // 'div' pour un groupe de plusieurs contrôles (ex: chips) : dans un <label>,
  // un clic sur le libellé activerait le premier bouton du groupe.
  as?: 'label' | 'div'
}

export default function Field({ label, children, hint, className, as = 'label' }: FieldProps) {
  const Tag = as
  return (
    <Tag
      className={['field', className].filter(Boolean).join(' ')}
      role={as === 'div' ? 'group' : undefined}
      aria-label={as === 'div' ? label : undefined}
    >
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </Tag>
  )
}
