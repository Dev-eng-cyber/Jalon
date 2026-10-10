import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import html from './landing.html?raw'
import { useAuth } from '../context/AuthContext'

// Ouvre ou ferme le menu déroulant mobile (le HTML de la landing est statique).
function setMenu(open) {
  document.getElementById('mnav')?.classList.toggle('open', open)
  const b = document.getElementById('burger')
  b?.setAttribute('aria-expanded', String(open))
  b?.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu')
}

// Version de la landing pour une personne connectée :
// « Se connecter » devient « Se déconnecter », « Créer un compte » devient « Mon espace ».
function forLoggedIn(h) {
  return h
    .replaceAll('data-go="auth:in">Se connecter<', 'data-act="logout">Se déconnecter<')
    .replaceAll('data-go="auth:up">Créer un compte gratuit<', 'data-go="app">Accéder à mon espace<')
    .replaceAll('data-go="auth:up">Créer mon compte<', 'data-go="app">Accéder à mon espace<')
    .replaceAll('data-go="auth:up">Créer un compte<', 'data-go="app">Mon espace<')
}

export default function Landing() {
  const nav = useNavigate()
  const { session, signOut } = useAuth()
  const view = useMemo(() => (session ? forLoggedIn(html) : html), [session])

  useEffect(() => {
    const onScroll = () => document.getElementById('tn')?.classList.toggle('sc', window.scrollY > 10)
    const onKey = (e) => { if (e.key === 'Escape') setMenu(false) }
    const onOutside = (e) => { if (!e.target.closest('#tn')) setMenu(false) }
    const onResize = () => { if (window.innerWidth > 820) setMenu(false) }
    window.addEventListener('scroll', onScroll)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    document.addEventListener('click', onOutside)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('click', onOutside)
    }
  }, [])

  // Le contenu est recréé quand la connexion change : on réapplique l'état de la barre.
  useEffect(() => {
    document.getElementById('tn')?.classList.toggle('sc', window.scrollY > 10)
  }, [view])

  const onClick = (e) => {
    if (e.target.closest('#burger')) {
      setMenu(!document.getElementById('mnav').classList.contains('open'))
      return
    }
    if (e.target.closest('#mnav a, #mnav button')) setMenu(false)

    if (e.target.closest('[data-act="logout"]')) {
      e.preventDefault()
      signOut()
      return
    }

    const a = e.target.closest('[data-go]')
    if (a) {
      e.preventDefault()
      const [target, mode] = a.dataset.go.split(':')
      if (target === 'app') nav('/app')
      else if (target === 'auth') nav(session ? '/app' : `/auth?m=${mode || 'in'}`)
      else window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Le contenu de la landing est statique et écrit par nous (aucune donnée utilisateur).
  return <div onClick={onClick} dangerouslySetInnerHTML={{ __html: view }} />
}