import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABEL, dateLong, frError } from '../lib/format'
import { Skeleton } from '../components/Shell'

const GRADIENTS = [
  ['#3B35E8', '#7C5CFF'], ['#0E7C86', '#2BB8A5'], ['#B7791F', '#E3A63B'],
  ['#8B3FBF', '#C46BE0'], ['#1F8A5B', '#4CC38A'], ['#D6402B', '#FF8A5C'],
]
const hash = (s = '') => [...s].reduce((n, c) => n + c.charCodeAt(0), 0)
const initials = (n = '') => n.split(/[\s@.-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
const ROLE_ORDER = { admin: 0, project_manager: 1, member: 2, external: 3 }
const SORTS = { recent: 'Plus récents', name: 'Nom (A à Z)', role: 'Par rôle' }
const isNew = (iso) => Date.now() - new Date(iso) < 7 * 864e5

export default function Users() {
  const { profile } = useAuth()
  const { toast } = useOutletContext()
  const [rows, setRows] = useState(null)
  const [loads, setLoads] = useState({})
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [sort, setSort] = useState('recent')
  const [view, setView] = useState('cards')

  const load = useCallback(async () => {
    const [u, l] = await Promise.all([
      supabase.from('profiles').select('id,full_name,email,role,created_at,skills,weekly_capacity').order('created_at', { ascending: false }),
      supabase.from('v_team_load').select('user_id,open_tasks,load_pct'),
    ])
    if (u.error) return toast(frError(u.error.message))
    setRows(u.data)
    if (!l.error) setLoads(Object.fromEntries(l.data.map((x) => [x.user_id, x])))
  }, [toast])
  useEffect(() => { load() }, [load])

  async function changeRole(u, next) {
    const name = u.full_name || u.email
    if ((next === 'admin' || u.role === 'admin') && !window.confirm(
      next === 'admin' ? `Donner les droits d'administrateur à ${name} ?` : `Retirer les droits d'administrateur à ${name} ?`)) return
    const { error } = await supabase.from('profiles').update({ role: next }).eq('id', u.id)
    if (error) return toast(frError(error.message))
    toast(`${name} : ${ROLE_LABEL[next]}`); load()
  }

  const counts = useMemo(() => {
    const c = { all: (rows || []).length }
    Object.keys(ROLE_LABEL).forEach((r) => { c[r] = (rows || []).filter((x) => x.role === r).length })
    return c
  }, [rows])

  const list = useMemo(() => {
    const s = q.toLowerCase()
    return (rows || [])
      .filter((u) => (role === 'all' || u.role === role)
        && (!s || `${u.full_name} ${u.email} ${(u.skills || []).join(' ')}`.toLowerCase().includes(s)))
      .sort((a, b) => sort === 'name' ? (a.full_name || a.email).localeCompare(b.full_name || b.email, 'fr')
        : sort === 'role' ? ROLE_ORDER[a.role] - ROLE_ORDER[b.role] : new Date(b.created_at) - new Date(a.created_at))
  }, [rows, q, role, sort])

  if (!rows) return <Skeleton />
  const filtered = q || role !== 'all'

  const Avatar = ({ u }) => {
    const [c1, c2] = GRADIENTS[hash(u.full_name || u.email) % GRADIENTS.length]
    return <i className="us-av" style={{ background: `linear-gradient(135deg,${c1},${c2})` }}>{initials(u.full_name || u.email)}</i>
  }
  const RoleSelect = ({ u }) => (
    <select className={`us-role r-${u.role}`} value={u.role} disabled={u.id === profile.id}
      onChange={(e) => changeRole(u, e.target.value)} aria-label={`Rôle de ${u.email}`}>
      {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  )
  const Load = ({ u }) => {
    const l = loads[u.id]
    if (!l) return <span className="sub">Pas de charge</span>
    return (
      <div className="us-load" title={`${l.open_tasks} tâche(s) ouverte(s) sur ${u.weekly_capacity}`}>
        <div className="mini"><span>Charge</span><b className={l.load_pct > 100 ? 'c-risk' : ''}>{l.load_pct} %</b></div>
        <div className="bar t"><i className={l.load_pct > 100 ? 'over' : ''} style={{ width: `${Math.min(l.load_pct, 100)}%` }} /></div>
      </div>
    )
  }

  return (
    <>
      <section className="us-hero">
        <div>
          <span className="us-kick">Administration</span>
          <h1>Utilisateurs</h1>
          <p>Gérez les accès de votre équipe. Les nouveaux inscrits arrivent comme membre ou intervenant externe, c'est vous qui leur donnez le bon rôle.</p>
        </div>
        <div className="us-total"><b>{counts.all}</b><span>comptes</span></div>
      </section>

      <div className="us-tiles">
        {[['all', 'Tous'], ...Object.entries(ROLE_LABEL)].map(([k, label]) => (
          <button key={k} className={`us-tile r-${k}${role === k ? ' on' : ''}`} onClick={() => setRole(k)} aria-pressed={role === k}>
            <b>{counts[k]}</b><span>{label}</span>
          </button>
        ))}
      </div>

      <div className="us-tools">
        <label className="us-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-5-5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un nom, un email, une compétence" aria-label="Rechercher un utilisateur" />
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Trier">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="us-view" role="group" aria-label="Affichage">
          <button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')} aria-label="Vue cartes">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
          </button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label="Vue liste">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
        {filtered && <button className="lk" onClick={() => { setQ(''); setRole('all') }}>Réinitialiser</button>}
      </div>

      {list.length === 0 && <div className="us-none">Aucun utilisateur ne correspond à votre recherche.</div>}

      {view === 'cards' ? (
        <div className="us-grid">
          {list.map((u) => (
            <article className="us-card" key={u.id}>
              <div className={`us-top r-${u.role}`} />
              <Avatar u={u} />
              <div className="us-id">
                <h3>{u.full_name || 'Sans nom'}{u.id === profile.id && <span className="us-you">vous</span>}{isNew(u.created_at) && <span className="us-new">nouveau</span>}</h3>
                <p>{u.email}</p>
              </div>
              {u.skills?.length > 0 && <div className="us-skills">{u.skills.slice(0, 4).map((s) => <span key={s}>{s}</span>)}</div>}
              <Load u={u} />
              <div className="us-foot">
                <small className="sub">Inscrit le {dateLong(u.created_at)}</small>
                <RoleSelect u={u} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="us-list">
          {list.map((u) => (
            <div className="us-row" key={u.id}>
              <Avatar u={u} />
              <div className="us-id">
                <h3>{u.full_name || 'Sans nom'}{u.id === profile.id && <span className="us-you">vous</span>}{isNew(u.created_at) && <span className="us-new">nouveau</span>}</h3>
                <p>{u.email}</p>
              </div>
              <Load u={u} />
              <small className="sub us-date">{dateLong(u.created_at)}</small>
              <RoleSelect u={u} />
            </div>
          ))}
        </div>
      )}
    </>
  )
}