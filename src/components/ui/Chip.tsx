import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import type { ActivityCategory } from '../../types/trip'
import Icon, { type IconName } from './Icon'

type ChipTone = 'neutral' | 'category' | 'gold' | 'indigo' | 'matcha' | 'vermillon'

interface ChipProps {
  children: ReactNode
  active?: boolean
  tone?: ChipTone
  /** Requis quand tone='category' — pilote la couleur via --cat-{category}. */
  category?: ActivityCategory
  count?: number
  icon?: IconName
  as?: 'button' | 'span'
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  'aria-expanded'?: boolean
  className?: string
}

export default function Chip({
  children,
  active = false,
  tone = 'neutral',
  category,
  count,
  icon,
  as = 'button',
  onClick,
  className,
  ...rest
}: ChipProps) {
  const classes = ['chip', tone !== 'neutral' && tone !== 'category' && `chip--tone-${tone}`, active && 'chip--active', className]
    .filter(Boolean)
    .join(' ')

  // Catégorie = seul cas dynamique (6 valeurs) : accent/wash posés inline via
  // --cat-{category}/-wash, écrits sur <html> par writeColorVars() (theme/categories.ts).
  // Les autres tons (gold/indigo/matcha/vermillon) ont leurs variables figées
  // dans la classe `chip--tone-*` (ui.css), pas besoin de style inline.
  const style: CSSProperties | undefined =
    tone === 'category' && category
      ? ({ '--chip-accent': `var(--cat-${category})`, '--chip-wash': `var(--cat-${category}-wash)` } as CSSProperties)
      : undefined

  const content = (
    <>
      {icon && <Icon name={icon} size={14} />}
      <span className="chip__label">{children}</span>
      {count !== undefined && <span className="chip__count">({count})</span>}
    </>
  )

  if (as === 'span') {
    return (
      <span className={classes} style={style}>
        {content}
      </span>
    )
  }

  return (
    <button type="button" className={classes} style={style} onClick={onClick} {...rest}>
      {content}
    </button>
  )
}
