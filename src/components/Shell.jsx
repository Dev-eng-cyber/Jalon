import { useCallback, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABEL, firstName } from '../lib/format'
import Logo from './Logo'

const I = {
  dash: <><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></>,
  tasks: <path d="M5 4v16M12 4v10M19 4v6" />,
  cat: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-5-5" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-4 3-6 6.5-6s6.5 2 6.5 6M17 11a3 3 0 100-6M18 14c2.5.5 4 2.3 4 5" /></>,
  fin: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /></>,
}
const MANAGERS = ['admin', 'project_manager']
export const ITEMS = [
  { to: '/app', label: 'Tableau de bord', icon: 'dash', roles: [...MANAGERS, 'member'] },
  { to: '/app/taches', label: 'Tâches', icon: 'tasks', roles: [...MANAGERS, 'member'] },
  { to: '/app/catalogue', label: 'Catalogue', icon: 'cat', roles: [...MANAGERS, 'external'] },
  { to: '/app/utilisateurs', label: 'Utilisateurs', icon: 'users', roles: ['admin'] },
  { to: '/app/finances', label: 'Finances', icon: 'fin', roles: [...MANAGERS, 'external'] },
]
export const homeFor = (role) => (role === 'external' ? '/app/catalogue' : '/app')

export default function Shell() {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const nav = useNavigate()
  const [msg, setMsg] = useState('')
  const timer = useRef()
  const toast = useCallback((t) => { setMsg(t); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(''), 3000) }, [])

  const toggleTheme = () => {
    const r = document.documentElement
    const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches
    r.dataset.theme = dark ? 'light' : 'dark'
  }
  const logout = async () => { await signOut(); nav('/') }

  return (
    <div className="app">
      <nav aria-label="Navigation principale">
        <div className="brand"><Logo />Jalon</div>
        {profile && ITEMS.filter((i) => i.roles.includes(profile.role)).map((i) => (
          <button key={i.to} className="n" aria-current={pathname === i.to ? 'page' : undefined} onClick={() => nav(i.to)}>
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{I[i.icon]}</svg>{i.label}
          </button>
        ))}
        <div className="nf">
          {profile && <p className="sub" style={{ margin: '0 4px' }}>{firstName(profile)}<br />{ROLE_LABEL[profile.role]}</p>}
          <button className="ghost" onClick={toggleTheme}>Thème clair / sombre</button>
          <button className="ghost" onClick={logout}>Se déconnecter</button>
        </div>
      </nav>
      <main tabIndex={-1}>
        {profile ? <Outlet context={{ toast }} /> : <Skeleton />}
      </main>
      <div className={`toast${msg ? ' on' : ''}`} role="status">{msg}</div>
    </div>
  )
}

export function Skeleton() {
  return <><div className="sk" style={{ width: '40%', height: 34 }} /><div className="sk" /><div className="sk" style={{ width: '80%' }} /><div className="sk" style={{ width: '60%' }} /></>
}