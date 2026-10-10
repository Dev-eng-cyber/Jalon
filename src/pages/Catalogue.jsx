import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RESERVATION_STATUS, dateShort, frError } from '../lib/format'
import { Skeleton } from '../components/Shell'

const GRADIENTS = [
  ['#3B35E8', '#7C5CFF'], ['#0E7C86', '#2BB8A5'], ['#B7791F', '#E3A63B'],
  ['#8B3FBF', '#C46BE0'], ['#1F8A5B', '#4CC38A'], ['#D6402B', '#FF8A5C'],
]
const hash = (s = '') => [...s].reduce((n, c) => n + c.charCodeAt(0), 0)
const initials = (n = '') => n.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`

export default function Catalogue() {
  const { profile } = useAuth()
  const { toast } = useOutletContext()
  const isManager = ['admin', 'project_manager'].includes(profile.role)
  const isExternal = profile.role === 'external'
  const [offers, setOffers] = useState(null)
  const [resa, setResa] = useState([])
  const [q, setQ] = useState('')
  const [proj, setProj] = useState('all')
  const [onlyFree, setOnlyFree] = useState(false)
  const [onlyAuto, setOnlyAuto] = useState(false)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    const [o, r] = await Promise.all([
      supabase.rpc('catalog_openings'),
      supabase.from('reservations')
        .select('id,opening_id,status,message,created_at,opening:project_openings(title),candidate:profiles!user_id(full_name,email)')
        .order('created_at', { ascending: false }),
    ])
    if (o.error) return toast(frError(o.error.message))
    setOffers(o.data)
    if (!r.error) setResa(r.data)
  }, [toast])

  useEffect(() => {
    load()
    const ch = supabase.channel('resa-live').on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, load).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  async function apply(id) {
    setBusy(id)
    const { error } = await supabase.from('reservations').insert({ opening_id: id })
    setBusy(null)
    if (error) return toast(error.code === '23505' ? 'Vous avez déjà postulé à cette offre.' : frError(error.message))
    toast('Candidature envoyée'); load()
  }
  async function decide(id, status) {
    const { error } = await supabase.from('reservations').update({ status }).eq('id', id)
    if (error) return toast(frError(error.message))
    toast(status === 'approved' ? 'Candidature approuvée' : 'Candidature refusée'); load()
  }

  const mine = useMemo(() => (isExternal ? Object.fromEntries(resa.map((x) => [x.opening_id, x.status])) : {}), [resa, isExternal])
  const pending = useMemo(() => (isManager ? resa.filter((x) => x.status === 'pending') : []), [resa, isManager])
  const projects = useMemo(() => [...new Map((offers || []).map((o) => [o.project_id, o.project_title]))], [offers])
  const list = useMemo(() => (offers || []).filter((o) => {
    if (proj !== 'all' && o.project_id !== proj) return false
    if (onlyFree && o.places_left <= 0) return false
    if (onlyAuto && !o.auto_approve) return false
    if (q && !`${o.title} ${o.project_title} ${o.description || ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [offers, q, proj, onlyFree, onlyAuto])

  if (!offers) return <Skeleton />
  const totalLeft = offers.reduce((s, o) => s + Math.max(0, o.places_left), 0)
  const filtered = q || proj !== 'all' || onlyFree || onlyAuto

  return (
    <>
      <section className="ct-hero">
        <div>
          <span className="ct-kick">Opportunités</span>
          <h1>Catalogue</h1>
          <p>{isExternal ? 'Trouvez une mission, postulez en un clic et suivez le statut de vos candidatures.' : 'Les offres ouvertes aux intervenants externes et les candidatures à traiter.'}</p>
        </div>
        <div className="ct-stats">
          <div><b>{offers.length}</b><span>{offers.length > 1 ? 'offres ouvertes' : 'offre ouverte'}</span></div>
          <div><b>{totalLeft}</b><span>{totalLeft > 1 ? 'places disponibles' : 'place disponible'}</span></div>
          <div><b>{isManager ? pending.length : resa.length}</b><span>{isManager ? 'à traiter' : (resa.length > 1 ? 'candidatures' : 'candidature')}</span></div>
        </div>
      </section>

      {isManager && (
        <section className="ct-sec">
          <div className="ct-sh"><h2>Candidatures à traiter</h2><span className="sub">{pending.length} en attente</span></div>
          {pending.length === 0 && <div className="ct-none">Aucune candidature en attente. Tout est à jour.</div>}
          <div className="ct-reqs">
            {pending.map((r) => {
              const name = r.candidate?.full_name || r.candidate?.email || 'Candidat'
              const [c1, c2] = GRADIENTS[hash(name) % GRADIENTS.length]
              return (
                <article className="ct-req" key={r.id}>
                  <i className="ct-av" style={{ background: `linear-gradient(135deg,${c1},${c2})` }}>{initials(name)}</i>
                  <div className="ct-reqt">
                    <strong>{name}</strong>
                    <span>{r.opening?.title}</span>
                    {r.message && <em>« {r.message} »</em>}
                  </div>
                  <div className="ct-act">
                    <button className="btn" onClick={() => decide(r.id, 'approved')}>Approuver</button>
                    <button className="ghost" onClick={() => decide(r.id, 'rejected')}>Refuser</button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {isExternal && resa.length > 0 && (
        <section className="ct-sec">
          <div className="ct-sh"><h2>Mes candidatures</h2></div>
          <div className="ct-mine">
            {resa.map((r) => {
              const [label, cls] = RESERVATION_STATUS[r.status]
              return <div className="ct-m" key={r.id}><strong>{r.opening?.title}</strong><span className={`chip ${cls}`}>{label}</span></div>
            })}
          </div>
        </section>
      )}

      <div className="ct-tools">
        <label className="ct-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-5-5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une mission ou un projet" aria-label="Rechercher une offre" />
        </label>
        <select value={proj} onChange={(e) => setProj(e.target.value)} aria-label="Filtrer par projet">
          <option value="all">Tous les projets</option>
          {projects.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
        <button className={`ct-chip${onlyFree ? ' on' : ''}`} onClick={() => setOnlyFree(!onlyFree)} aria-pressed={onlyFree}>Places disponibles</button>
        <button className={`ct-chip${onlyAuto ? ' on' : ''}`} onClick={() => setOnlyAuto(!onlyAuto)} aria-pressed={onlyAuto}>Validation automatique</button>
        {filtered && <button className="lk" onClick={() => { setQ(''); setProj('all'); setOnlyFree(false); setOnlyAuto(false) }}>Réinitialiser</button>}
      </div>

      {list.length === 0 && <div className="ct-none">{filtered ? 'Aucune offre ne correspond à vos critères.' : 'Aucune offre ouverte pour le moment.'}</div>}

      <div className="ct-grid">
        {list.map((o) => {
          const [c1, c2] = GRADIENTS[hash(o.project_title) % GRADIENTS.length]
          const st = mine[o.opening_id]
          const full = o.places_left <= 0
          const taken = o.places - Math.max(0, o.places_left)
          const level = full ? 'risk' : o.places_left < 3 ? 'warn' : 'ok'
          return (
            <article className="ct-card" key={o.opening_id}>
              <div className="ct-banner" style={{ background: `linear-gradient(135deg,${c1},${c2})` }}>
                <span className="ct-init">{initials(o.project_title)}</span>
                <span className="ct-tag">{o.auto_approve ? 'Validation automatique' : 'Sur validation'}</span>
              </div>
              <div className="ct-body">
                <h3>{o.title}</h3>
                <p className="ct-proj">{o.project_title}</p>
                {o.description && <p className="ct-desc">{o.description}</p>}
                <div className="ct-meta">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
                  {o.end_date ? `${o.start_date ? `${dateShort(o.start_date)} → ` : "Jusqu'au "}${dateShort(o.end_date)}` : 'Dates à définir'}
                </div>
                <div className="ct-meter">
                  <div className="ct-mt"><span className={`c-${level}`}>{full ? 'Complet' : o.places_left === 1 ? 'Dernière place' : `${o.places_left} places restantes`}</span><span>{taken}/{o.places}</span></div>
                  <div className="bar"><i className={level === 'risk' ? 'over' : ''} style={{ width: `${(100 * taken) / o.places}%`, background: level === 'warn' ? 'var(--warn)' : level === 'ok' ? 'var(--ok)' : undefined }} /></div>
                </div>
                {isExternal && (st
                  ? <div className={`ct-state chip ${RESERVATION_STATUS[st][1]}`}>Candidature : {RESERVATION_STATUS[st][0].toLowerCase()}</div>
                  : <button className="btn ct-btn" disabled={full || busy === o.opening_id} onClick={() => apply(o.opening_id)}>{busy === o.opening_id ? 'Envoi…' : full ? 'Complet' : 'Postuler'}</button>)}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}