import type { ButtonHTMLAttributes, ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  type?: 'button' | 'submit' | 'reset'
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  /** Bouton carré, icône seule — `aria-label` alors obligatoire. */
  iconOnly?: boolean
  loading?: boolean
  loadingLabel?: string
  block?: boolean
  children?: ReactNode
}

// `type="button"` par défaut : 9 des 12 bottom sheets sont des <form>, où un
// <button> nu déclenche un submit — le code d'origine l'écrivait à la main
// 40+ fois pour éviter exactement ça.
export default function Button({
  type = 'button',
  variant = 'secondary',
  size = 'md',
  icon,
  iconOnly = false,
  loading = false,
  loadingLabel,
  block = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    iconOnly && 'btn--icon-only',
    block && 'btn--block',
    loading && 'btn--loading',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {icon && !loading && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      {!iconOnly && <span className="btn__label">{loading && loadingLabel ? loadingLabel : children}</span>}
    </button>
  )
}
