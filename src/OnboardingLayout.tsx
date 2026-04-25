import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** ARIA-label op de hele regio */
  'aria-label'?: string
}

/**
 * Zelfde full-bleed banner + gradient als de login, met gecentreerde contentkaart.
 */
export function OnboardingLayout(props: Props) {
  const { children, 'aria-label': label = 'Registratie' } = props
  return (
    <div className="onboard-hero" role="region" aria-label={label}>
      <div className="onboard-bg" aria-hidden>
        <img
          className="onboard-bg__img"
          src="/banner.png"
          alt=""
          width={1600}
          height={600}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="onboard-scrim" aria-hidden />
      <div className="onboard-vignette" aria-hidden />
      <div className="onboard-body">
        <div className="onboard-card">{children}</div>
      </div>
    </div>
  )
}
