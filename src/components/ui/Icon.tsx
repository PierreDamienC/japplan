import { escapeHtml } from '../../utils/escapeHtml'
import { ICON_INNER, type IconName } from './iconData'

export type { IconName }

interface IconProps {
  name: IconName
  size?: number
  className?: string
  title?: string
}

export default function Icon({ name, size = 20, className, title }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${escapeHtml(title)}</title>` : '') + ICON_INNER[name] }}
    />
  )
}
