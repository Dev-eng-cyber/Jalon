import { useEffect, useRef, useState } from 'react'

// Passe à true dès que l'intro a été montrée : elle ne se rejoue plus jusqu'au rechargement de la page,
// même si ce composant est monté plusieurs fois (navigation, retour à l'accueil).
let played = false

export default function Splash({ onDone }) {
  const [visible, setVisible] = useState(() => !played)
  const [hide, setHide] = useState(false)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    if (!visible) { done.current?.(); return }
    played = true
    // 2,6 s d'animation, puis un fondu de 0,6 s, puis l'intro est retirée
    const t = setTimeout(() => (hide ? setVisible(false) : setHide(true)), hide ? 600 : 2600)
    return () => clearTimeout(t)
  }, [hide, visible])

  if (!visible) return null
  return (
    <div id="splash" className={hide ? 'hide' : ''} onClick={() => setHide(true)} role="status" aria-label="Chargement de Jalon">
      <div className="sp-in">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <rect className="sq" x="14" y="14" width="92" height="92" rx="40" />
          <path className="jj" d="M72 38V70C72 84 62 92 50 92C42 92 36 88 32 82" />
          <circle className="dot" cx="72" cy="24" r="7" />
        </svg>
        <div className="wm">JALON</div>
      </div>
      <span className="skip">Toucher pour passer</span>
    </div>
  )
}