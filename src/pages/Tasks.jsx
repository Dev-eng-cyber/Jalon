import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PRIORITY, TASK_COLUMNS, dateShort, frError } from '../lib/format'
import { Skeleton } from '../components/Shell'

const ORDER = TASK_COLUMNS.map(([k]) => k)
const COLOR = { todo: 'var(--mut)', in_progress: 'var(--acc)', in_review: 'var(--warn)', done: 'var(--ok)' }
const PRIO_CLS = { high: 'p-high', medium: 'p-med', low: 'p-low' }
const PALETTE = ['#3B35E8', '#1F8A5B', '#B7791F', '#D6402B', '#0E7C86', '#8B3FBF']
const initials = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
const tint = (n = '') => PALETTE[[...n].reduce((s, c) => s + c.charCodeAt(0), 0) % PALETTE.length]

function dueInfo(due, status, today) {
  if (!due) return null
  if (status === 'done') return { text: dateShort(due), cls: '' }
  const diff = Math.ceil((new Date(due) - new Date(today)) / 864e5)
  if (diff < 0) return { text: `Retard de ${-diff} j`, cls: 'late' }
  if (diff === 0) return { text: "Aujourd'hui", cls: 'soon' }
  if (diff <= 3) return { text: `Dans ${diff} j`, cls: 'soon' }
  return { text: dateShort(due), cls: '' }
}

export default function Tasks() {
  const { profile } = useAuth()
  const { toast } = useOutletContext()
  const [tasks, setTasks] = useState(null)
  const [q, setQ] = useState('')
  const [proj, setProj] = useState('all')
  const [mine, setMine] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [over, setOver] = useState(null)
  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('tasks')
      .select('id,title,status,priority,due_date,assigned_to,project_id,project:projects(title),assignee:profiles!assigned_to(full_name)')
      .order('position').order('created_at')
    if (error) toast(frError(error.message)); else setTasks(data)
  }, [toast])

  useEffect(() => {
    load()
    const ch = supabase.channel('tasks-live').on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const canEdit = (t) => ['admin', 'project_manager'].includes(profile.role) || t.assigned_to === profile.id

  async function setStatus(t, next) {
    if (!next || next === t.status) return
    const before = tasks
    setTasks(tasks.map((x) => (x.id === t.id ? { ...x, status: next } : x)))
    const { error } = await supabase.from('tasks').update({ status: next }).eq('id', t.id)
    if (error) { setTasks(before); toast(frError(error.message)) }
    else toast(`Tâche passée à « ${TASK_COLUMNS.find(([k]) => k === next)[1]} »`)
  }

  const projects = useMemo(() => {
    const m = new Map()
    ;(tasks || []).forEach((t) => t.project && m.set(t.project_id, t.project.title))
    return [...m]
  }, [tasks])

  const list = useMemo(() => (tasks || []).filter((t) => {
    if (proj !== 'all' && t.project_id !== proj) return false
    if (mine && t.assigned_to !== profile.id) return false
    if (q && !`${t.title} ${t.project?.title || ''} ${t.assignee?.full_name || ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [tasks, q, proj, mine, profile.id])

  if (!tasks) return <Skeleton />

  const done = tasks.filter((t) => t.status === 'done').length
  const doing = tasks.filter((t) => t.status === 'in_progress').length
  const late = tasks.filter((t) => t.status !== 'done' && t.due_date && t.due_date < today).length
  const pct = tasks.length ? Math.round((100 * done) / tasks.length) : 0
  const filtered = q || proj !== 'all' || mine

  function onDrop(e, key) {
    e.preventDefault()
    const t = tasks.find((x) => x.id === (e.dataTransfer.getData('text/plain') || dragId))
    setOver(null); setDragId(null)
    if (t && canEdit(t)) setStatus(t, key)
  }

  return (
    <>
      <div className="top"><div><h1>Tâches</h1><p>Glissez une carte d'une colonne à l'autre. Les changements apparaissent en direct chez toute l'équipe.</p></div></div>

      <section className="tk-head">
        <div className="tk-stats">
          <div className="tk-stat"><b>{tasks.length}</b><span>tâches au total</span></div>
          <div className="tk-stat"><b>{doing}</b><span>en cours</span></div>
          <div className={`tk-stat${late ? ' late' : ''}`}><b>{late}</b><span>en retard</span></div>
          <div className="tk-stat"><b>{done}</b><span>terminées</span></div>
        </div>
        <div className="tk-prog"><span>Avancement</span><div className="bar"><i style={{ width: `${pct}%` }} /></div><b>{pct} %</b></div>
      </section>

      <div className="tk-tools">
        <label className="tk-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-5-5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une tâche, un projet, une personne" aria-label="Rechercher une tâche" />
        </label>
        <select value={proj} onChange={(e) => setProj(e.target.value)} aria-label="Filtrer par projet">
          <option value="all">Tous les projets</option>
          {projects.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
        <button className={`tk-chip${mine ? ' on' : ''}`} onClick={() => setMine(!mine)} aria-pressed={mine}>Mes tâches</button>
        {filtered && <button className="lk" onClick={() => { setQ(''); setProj('all'); setMine(false) }}>Réinitialiser</button>}
      </div>

      {tasks.length === 0 && <p className="sub">Aucune tâche pour l'instant.</p>}

      <div className="tk-board">
        {TASK_COLUMNS.map(([key, label], i) => {
          const col = list.filter((t) => t.status === key)
          return (
            <section key={key} className={`tk-col${over === key ? ' over' : ''}`} style={{ '--c': COLOR[key] }}
              onDragOver={(e) => { e.preventDefault(); setOver(key) }} onDragLeave={() => setOver((o) => (o === key ? null : o))} onDrop={(e) => onDrop(e, key)}>
              <header><span className="tk-dot" /><h3>{label}</h3><span className="tk-n">{col.length}</span></header>
              {col.length === 0 && <div className="tk-empty">{filtered ? 'Aucun résultat' : 'Déposez une tâche ici'}</div>}
              {col.map((t) => {
                const due = dueInfo(t.due_date, t.status, today)
                const who = t.assignee?.full_name
                return (
                  <article key={t.id} className={`tk-card${dragId === t.id ? ' drag' : ''}`} draggable={canEdit(t)}
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setDragId(t.id) }}
                    onDragEnd={() => { setDragId(null); setOver(null) }}>
                    <div className="tk-top">
                      <span className={`tk-prio ${PRIO_CLS[t.priority]}`}>{PRIORITY[t.priority]}</span>
                      {due && <span className={`tk-due ${due.cls}`}>{due.text}</span>}
                    </div>
                    <h4>{t.title}</h4>
                    <p className="tk-proj">{t.project?.title}</p>
                    <footer>
                      <span className="tk-who"><i style={{ background: who ? tint(who) : 'var(--mut)' }}>{initials(who)}</i><span>{who || 'Non assignée'}</span></span>
                      {canEdit(t) && (
                        <span className="tk-mv">
                          {i > 0 && <button onClick={() => setStatus(t, ORDER[i - 1])} aria-label="Reculer la tâche">←</button>}
                          {i < 3 && <button onClick={() => setStatus(t, ORDER[i + 1])} aria-label="Avancer la tâche">→</button>}
                        </span>
                      )}
                    </footer>
                  </article>
                )
              })}
            </section>
          )
        })}
      </div>
    </>
  )
}