import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PAYMENT_STATUS, PROJECT_STATUS, ROLE_LABEL, dateShort, fcfa, firstName, num } from '../lib/format'
import { Skeleton } from '../components/Shell'
import NewProject from '../components/NewProject'

// Anneau de progression animé (SVG). `value` va de 0 à 100.
function Ring({ value = 0, size = 84, stroke = 9, color = 'var(--acc)', children }) {
  const [on, setOn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setOn(true), 120); return () => clearTimeout(t) }, [])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-bg" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle className="ring-fg" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} stroke={color}
          strokeDasharray={c} strokeDashoffset={on ? c * (1 - pct / 100) : c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span>{children}</span>
    </div>
  )
}

const short = (n) => {
  n = Number(n) || 0
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.0', '').replace('.', ',')} M`
  if (n >= 1e3) return `${Math.round(n / 1e3)} k`
  return String(n)
}
const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
const ago = (iso) => {
  const s = (new Date(iso) - Date.now()) / 1000, a = Math.abs(s)
  if (a < 60) return "à l'instant"
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute')
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour')
  return rtf.format(Math.round(s / 86400), 'day')
}
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`
const SEG = [['todo', 'À faire', 'var(--mut)'], ['in_progress', 'En cours', 'var(--acc)'], ['in_review', 'En revue', 'var(--warn)'], ['done', 'Terminé', 'var(--ok)']]

function describe(a) {
  const d = a.new_data || a.old_data || {}
  if (a.table_name === 'payments') {
    const verb = a.action === 'INSERT' ? (d.status === 'validated' ? 'Paiement enregistré et validé' : 'Paiement enregistré')
      : a.action === 'UPDATE' ? (d.status === 'validated' ? 'Paiement validé' : 'Paiement modifié') : 'Paiement supprimé'
    return [verb, `${d.label || ''} · ${fcfa(d.amount)}`, d.status === 'validated' ? 'c-ok' : 'c-warn']
  }
  const verb = a.action === 'INSERT' ? 'Projet créé' : a.action === 'UPDATE' ? 'Projet modifié' : 'Projet supprimé'
  return [verb, d.title || '', 'c-acc']
}

const Icon = ({ children }) => (
  <span className="ad-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg></span>
)

export default function Dashboard() {
  const { profile } = useAuth()
  const { toast } = useOutletContext()
  const nav = useNavigate()
  const isAdmin = profile.role === 'admin'
  const isManager = isAdmin || profile.role === 'project_manager'
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [ready, setReady] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const head = (t) => (isManager
      ? supabase.from(t).select('id', { count: 'exact', head: true }).eq('status', 'pending')
      : Promise.resolve({ count: 0 }))
    const [k, p, l, m, t, u, pay, resa, payPend, act] = await Promise.all([
      supabase.from('v_dashboard_kpis').select('*').maybeSingle(),
      supabase.from('v_project_stats').select('*').order('title'),
      supabase.from('v_team_load').select('*').order('load_pct', { ascending: false }),
      supabase.from('milestones').select('id,title,due_date,project:projects(title)').is('reached_at', null).gte('due_date', today).order('due_date').limit(5),
      supabase.from('tasks').select('status,due_date'),
      supabase.from('profiles').select('id,full_name,email,role'),
      supabase.from('payments').select('id,label,amount,status,payment_date,created_at').order('created_at', { ascending: false }).limit(5),
      head('reservations'), head('payments'),
      isAdmin ? supabase.from('audit_log').select('id,table_name,action,actor,new_data,old_data,at').order('at', { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    ])
    const bad = [k, p, l, m, t, u].find((r) => r.error)
    if (bad) return setErr(bad.error.message)
    const names = Object.fromEntries((u.data || []).map((x) => [x.id, x.full_name || x.email]))
    setD({
      today, k: k.data, p: p.data, l: l.data, m: m.data, tasks: t.data, users: u.data, names,
      pay: pay.data || [], resa: resa.count || 0, payPend: payPend.count || 0, act: act.data || [],
    })
    setTimeout(() => setReady(true), 80)
  }, [isManager, isAdmin])

  useEffect(() => { load() }, [load])

  if (err) return <p className="err" role="alert">Impossible de charger le tableau de bord : {err}</p>
  if (!d) return <Skeleton />

  const { today, k, p, l, m, tasks, users, names, pay, resa, payPend, act } = d
  const spentPct = k?.total_budget > 0 ? Math.round((100 * k.total_spent) / k.total_budget) : 0
  const overloaded = l.filter((x) => x.load_pct > 100).length
  const done = tasks.filter((x) => x.status === 'done').length
  const late = tasks.filter((x) => x.status !== 'done' && x.due_date && x.due_date < today).length
  const active = p.filter((x) => ['active', 'in_review'].includes(x.status)).length
  const risk = k?.projects_at_risk ?? 0
  const byRole = (r) => users.filter((x) => x.role === r).length
  const maxBudget = Math.max(1, ...p.map((x) => Number(x.budget)))
  const dateTxt = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const daysLeft = (dt) => (dt ? Math.ceil((new Date(dt) - new Date(today)) / 864e5) : null)
  const delay = (i) => ({ animationDelay: `${i * 70}ms` })

  return (
    <>
      <section className="ad-hero">
        <div>
          <span className="ad-date">{dateTxt}</span>
          <h1>Bonjour {firstName(profile)}</h1>
          <p>{ROLE_LABEL[profile.role]} · {plural(active, 'projet en cours', 'projets en cours')}, {risk} à risque, {plural(late, 'tâche en retard', 'tâches en retard')}.</p>
          {isAdmin && (
            <div className="ad-cta">
              <button className="w" onClick={() => setCreating(true)}>Nouveau projet</button>
              <button className="o" onClick={() => nav('/app/utilisateurs')}>Gérer les utilisateurs</button>
            </div>
          )}
        </div>
        {isManager && (
          <div className="ad-pills">
            <button className="ad-pill" onClick={() => nav('/app/catalogue')}><b>{resa}</b><span>{resa > 1 ? 'candidatures' : 'candidature'} en attente</span></button>
            <button className="ad-pill" onClick={() => nav('/app/finances')}><b>{payPend}</b><span>{payPend > 1 ? 'paiements' : 'paiement'} à valider</span></button>
            <button className="ad-pill" onClick={() => nav('/app/taches')}><b>{late}</b><span>{late > 1 ? 'tâches' : 'tâche'} en retard</span></button>
          </div>
        )}
      </section>

      {creating && <NewProject toast={toast} onCancel={() => setCreating(false)} onDone={() => { setCreating(false); setReady(false); load() }} />}

      <div className="ad-cards">
        <div className="ad-card" style={delay(0)}>
          <div><small className="l">Avancement global</small><b className="v">{k?.avg_progress_pct ?? 0} %</b><span className="sb">{done} tâches terminées sur {tasks.length}</span></div>
          <Ring value={k?.avg_progress_pct}>{k?.avg_progress_pct ?? 0}%</Ring>
        </div>
        <div className="ad-card" style={delay(1)}>
          <div><small className="l">Budget consommé</small><b className="v">{spentPct} %</b><span className="sb">{short(k?.total_spent)} sur {short(k?.total_budget)} FCFA</span></div>
          <Ring value={spentPct} color={spentPct > 100 ? 'var(--risk)' : 'var(--ok)'}>{spentPct}%</Ring>
        </div>
        <div className="ad-card" style={delay(2)}>
          <div><small className="l">Occupation des équipes</small><b className="v">{k?.avg_load_pct ?? 0} %</b><span className="sb">{overloaded ? plural(overloaded, 'personne en surcharge', 'personnes en surcharge') : 'Aucune surcharge'}</span></div>
          <Ring value={k?.avg_load_pct} color={(k?.avg_load_pct ?? 0) > 100 ? 'var(--risk)' : 'var(--warn)'}>{k?.avg_load_pct ?? 0}%</Ring>
        </div>
        <div className={`ad-card${risk ? ' risk' : ''}`} style={delay(3)}>
          <div><small className="l">Projets à risque</small><b className="v">{risk}</b><span className="sb">sur {plural(active, 'projet actif', 'projets actifs')}</span></div>
          <Icon><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17.5v.01" /></Icon>
        </div>
        <div className={`ad-card${late ? ' risk' : ''}`} style={delay(4)}>
          <div><small className="l">Tâches en retard</small><b className="v">{late}</b><span className="sb">échéance dépassée</span></div>
          <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>
        </div>
        <div className="ad-card" style={delay(5)}>
          <div><small className="l">Utilisateurs</small><b className="v">{users.length}</b><span className="sb">{byRole('member') + byRole('project_manager') + byRole('admin')} internes, {byRole('external')} externes</span></div>
          <Icon><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-4 3-6 6.5-6s6.5 2 6.5 6M17 11a3 3 0 100-6M18 14c2.5.5 4 2.3 4 5" /></Icon>
        </div>
      </div>

      <div className="ad-grid">
        <section className="ad-panel s8">
          <div className="ad-ph"><h2>Projets</h2><span className="sub">{plural(p.length, 'projet', 'projets')}</span></div>
          {p.length === 0 && <p className="sub">Aucun projet pour l'instant.{isAdmin ? ' Créez le premier avec « Nouveau projet ».' : ''}</p>}
          {p.map((x) => {
            const [label, cls] = x.at_risk ? ['À risque', 'c-risk'] : PROJECT_STATUS[x.status]
            const dl = ['active', 'in_review'].includes(x.status) ? daysLeft(x.end_date) : null
            return (
              <div className="ad-proj" key={x.project_id}>
                <div>
                  <strong>{x.title}</strong>
                  <small>{names[x.owner_id] || 'Sans responsable'}{x.end_date ? ` · fin le ${dateShort(x.end_date)}` : ''}{dl !== null ? (dl >= 0 ? ` (J-${dl})` : ` (retard de ${-dl} j)`) : ''}</small>
                </div>
                <div className="bw"><div className="mini"><span>Avancement</span><b>{x.progress_pct} %</b></div><div className="bar t"><i style={{ width: ready ? `${x.progress_pct}%` : 0 }} /></div></div>
                <div className="bw"><div className="mini"><span>Budget</span><b>{x.spent_pct} %</b></div><div className="bar t"><i className={x.spent_pct > 100 ? 'over' : ''} style={{ width: ready ? `${Math.min(x.spent_pct, 100)}%` : 0, background: x.spent_pct > 100 ? undefined : 'var(--ok)' }} /></div></div>
                <span className={`chip ${cls}`}>{label}</span>
              </div>
            )
          })}
        </section>

        <div className="s4 ad-stack">
          <section className="ad-panel">
            <div className="ad-ph"><h2>Répartition des tâches</h2><span className="sub">{tasks.length} au total</span></div>
            <div className="stk" role="img" aria-label="Répartition des tâches par statut">
              {SEG.map(([key, , color]) => { const n = tasks.filter((x) => x.status === key).length; return n ? <i key={key} style={{ width: `${(100 * n) / tasks.length}%`, background: color }} /> : null })}
            </div>
            <div className="lgd">
              {SEG.map(([key, label, color]) => <span key={key}><i className="sw" style={{ background: color }} />{label} <b>{tasks.filter((x) => x.status === key).length}</b></span>)}
            </div>
          </section>
          {isAdmin && (
            <section className="ad-panel">
              <div className="ad-ph"><h2>Utilisateurs par rôle</h2></div>
              {Object.entries(ROLE_LABEL).map(([r, label]) => (
                <div className="load" key={r}>
                  <span>{label}</span>
                  <div className="bar"><i style={{ width: ready ? `${(100 * byRole(r)) / Math.max(1, users.length)}%` : 0 }} /></div>
                  <b>{byRole(r)}</b>
                </div>
              ))}
            </section>
          )}
        </div>

        <section className="ad-panel s4">
          <div className="ad-ph"><h2>Charge de l'équipe</h2></div>
          {l.length === 0 && <p className="sub">Aucune donnée de charge.</p>}
          {l.map((x) => (
            <div className="load" key={x.user_id}>
              <span>{x.full_name || '—'}</span>
              <div className="bar"><i className={x.load_pct > 100 ? 'over' : ''} style={{ width: ready ? `${Math.min(x.load_pct, 100)}%` : 0 }} /></div>
              <span className={x.load_pct > 100 ? 'c-risk' : ''}>{num(x.load_pct)} %</span>
            </div>
          ))}
          {overloaded > 0 && <p className="sub">Au-delà de 100 %, réaffectez une tâche.</p>}
        </section>

        <section className="ad-panel s4">
          <div className="ad-ph"><h2>Budget par projet</h2><span className="sub">dépensé / alloué</span></div>
          {p.map((x) => (
            <div className="bb" key={x.project_id}>
              <div className="mini"><span>{x.title}</span><b>{short(x.budget_spent)} / {short(x.budget)}</b></div>
              <div className="trk"><div className="bud" style={{ width: ready ? `${(100 * x.budget) / maxBudget}%` : 0 }}><i className={x.spent_pct > 100 ? 'over' : ''} style={{ width: `${Math.min(x.spent_pct, 100)}%` }} /></div></div>
            </div>
          ))}
        </section>

        <section className="ad-panel s4">
          <div className="ad-ph"><h2>Prochaines échéances</h2></div>
          {m.length === 0 && <p className="sub">Aucune échéance à venir.</p>}
          {m.map((x) => {
            const dt = new Date(x.due_date)
            return (
              <div className="ms" key={x.id}>
                <div className="ad-day"><b>{dt.getDate()}</b><span>{dt.toLocaleDateString('fr-FR', { month: 'short' })}</span></div>
                <div>{x.title}<br /><small className="sub">{x.project?.title} · {daysLeft(x.due_date) === 0 ? "aujourd'hui" : `dans ${daysLeft(x.due_date)} j`}</small></div>
              </div>
            )
          })}
        </section>

        {isAdmin && (
          <section className="ad-panel s7">
            <div className="ad-ph"><h2>Activité récente</h2><span className="sub">journal d'audit</span></div>
            {act.length === 0 && <p className="sub">Aucune activité enregistrée.</p>}
            {act.map((a) => {
              const [title, detail, cls] = describe(a)
              return (
                <div className="act" key={a.id}>
                  <span className={`adot ${cls}`} />
                  <div><strong>{title}</strong><br /><small className="sub">{detail}</small></div>
                  <small className="sub act-t">{a.actor ? names[a.actor] || 'Utilisateur' : 'Système'}<br />{ago(a.at)}</small>
                </div>
              )
            })}
          </section>
        )}

        {profile.role !== 'member' && (
          <section className={`ad-panel ${isAdmin ? 's5' : 's12'}`}>
            <div className="ad-ph"><h2>Derniers paiements</h2><button className="lk" onClick={() => nav('/app/finances')}>Voir tout</button></div>
            {pay.length === 0 && <p className="sub">Aucun paiement pour l'instant.</p>}
            {pay.map((x) => {
              const [label, cls] = PAYMENT_STATUS[x.status]
              return (
                <div className="pay" key={x.id}>
                  <div><strong>{x.label}</strong><br /><small className="sub">{fcfa(x.amount)}{x.payment_date ? ` · ${dateShort(x.payment_date)}` : ''}</small></div>
                  <span className={`chip ${cls}`}>{label}</span>
                </div>
              )
            })}
          </section>
        )}
      </div>
    </>
  )
}