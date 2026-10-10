import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PAYMENT_STATUS, dateShort, fcfa, frError } from '../lib/format'
import { downloadReceipt } from '../lib/receipt'
import { Skeleton } from '../components/Shell'

const GRADIENTS = [
  ['#3B35E8', '#7C5CFF'], ['#0E7C86', '#2BB8A5'], ['#B7791F', '#E3A63B'],
  ['#8B3FBF', '#C46BE0'], ['#1F8A5B', '#4CC38A'], ['#D6402B', '#FF8A5C'],
]
const hash = (s = '') => [...s].reduce((n, c) => n + c.charCodeAt(0), 0)
const initials = (n = '') => n.split(/[\s@.-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
const short = (n) => {
  n = Number(n) || 0
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.0', '').replace('.', ',')} M`
  if (n >= 1e3) return `${Math.round(n / 1e3)} k`
  return String(n)
}
const TABS = [['all', 'Tous'], ['validated', 'Validés'], ['pending', 'En attente'], ['cancelled', 'Annulés']]

export default function Finances() {
  const { profile } = useAuth()
  const { toast } = useOutletContext()
  const isManager = ['admin', 'project_manager'].includes(profile.role)
  const [rows, setRows] = useState(null)
  const [stats, setStats] = useState([])
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [proj, setProj] = useState('all')
  const [busy, setBusy] = useState(null)
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([
      supabase.from('payments')
        .select('id,label,amount,status,receipt_number,payment_date,created_at,project_id,project:projects(title),payee:profiles!payee_id(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('v_project_stats').select('project_id,title,budget,budget_spent,spent_pct'),
    ])
    if (p.error) return toast(frError(p.error.message))
    setRows(p.data)
    if (!s.error) setStats(s.data)
    setTimeout(() => setReady(true), 80)
  }, [toast])

  useEffect(() => {
    load()
    const ch = supabase.channel('pay-live').on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, load).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  async function validate(id) {
    setBusy(id)
    const { error } = await supabase.from('payments').update({ status: 'validated' }).eq('id', id)
    setBusy(null)
    if (error) return toast(frError(error.message))
    toast('Paiement validé, reçu généré'); load()
  }
  async function receipt(p) {
    try { await downloadReceipt(p) } catch { toast('Impossible de générer le PDF') }
  }

  const projects = useMemo(() => [...new Map((rows || []).filter((r) => r.project).map((r) => [r.project_id, r.project.title]))], [rows])
  const counts = useMemo(() => {
    const c = { all: (rows || []).length }
    ;['validated', 'pending', 'cancelled'].forEach((k) => { c[k] = (rows || []).filter((r) => r.status === k).length })
    return c
  }, [rows])
  const list = useMemo(() => (rows || []).filter((r) => {
    if (tab !== 'all' && r.status !== tab) return false
    if (proj !== 'all' && r.project_id !== proj) return false
    if (q && !`${r.label} ${r.receipt_number || ''} ${r.payee?.full_name || ''} ${r.project?.title || ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [rows, tab, proj, q])

  const months = useMemo(() => {
    const now = new Date()
    const out = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('fr-FR', { month: 'short' }), total: 0 }
    })
    ;(rows || []).filter((r) => r.status === 'validated').forEach((r) => {
      const m = out.find((x) => x.key === (r.payment_date || r.created_at).slice(0, 7))
      if (m) m.total += Number(r.amount)
    })
    return out
  }, [rows])

  if (!rows) return <Skeleton />

  const sum = (arr) => arr.reduce((s, r) => s + Number(r.amount), 0)
  const validated = rows.filter((r) => r.status === 'validated')
  const pending = rows.filter((r) => r.status === 'pending')
  const maxM = Math.max(1, ...months.map((m) => m.total))
  const filtered = tab !== 'all' || q || proj !== 'all'
  const maxBudget = Math.max(1, ...stats.map((x) => Number(x.budget)))

  function exportCsv() {
    const head = ['Reçu', 'Objet', 'Bénéficiaire', 'Projet', 'Montant (FCFA)', 'Statut', 'Date']
    const body = list.map((r) => [r.receipt_number || '', r.label, r.payee?.full_name || '', r.project?.title || '', r.amount, PAYMENT_STATUS[r.status][0], r.payment_date || ''])
    const csv = [head, ...body].map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = 'paiements-jalon.csv'; a.click(); URL.revokeObjectURL(a.href)
    toast(`${list.length} ligne${list.length > 1 ? 's' : ''} exportée${list.length > 1 ? 's' : ''}`)
  }

  return (
    <>
      <section className="fn-hero">
        <div>
          <span className="fn-kick">Finances</span>
          <h1>{isManager ? 'Paiements et budgets' : 'Mes paiements'}</h1>
          <p>{isManager ? 'Validez les paiements, générez les reçus et gardez un œil sur la consommation des budgets.' : 'Retrouvez vos paiements et téléchargez vos reçus en PDF.'}</p>
        </div>
        <div className="fn-stats">
          <div><b>{short(sum(validated))}</b><span>FCFA validés</span></div>
          <div><b>{pending.length}</b><span>{pending.length > 1 ? 'paiements en attente' : 'paiement en attente'}</span></div>
          <div><b>{validated.length}</b><span>{validated.length > 1 ? 'reçus disponibles' : 'reçu disponible'}</span></div>
        </div>
      </section>

      <div className={`fn-grid${isManager && stats.length ? '' : ' one'}`}>
        <section className="fn-panel">
          <div className="fn-ph"><h2>Paiements validés par mois</h2><span className="sub">6 derniers mois</span></div>
          <div className="fn-chart">
            {months.map((m) => (
              <div className="fn-col" key={m.key}>
                <span className="fn-val">{m.total ? short(m.total) : ''}</span>
                <div className="fn-bar"><i style={{ height: ready ? `${(100 * m.total) / maxM}%` : 0 }} /></div>
                <small>{m.label}</small>
              </div>
            ))}
          </div>
        </section>
        {isManager && stats.length > 0 && (
          <section className="fn-panel">
            <div className="fn-ph"><h2>Budget consommé</h2><span className="sub">par projet</span></div>
            {stats.map((x) => (
              <div className="bb" key={x.project_id}>
                <div className="mini"><span>{x.title}</span><b className={x.spent_pct > 100 ? 'c-risk' : ''}>{x.spent_pct} %</b></div>
                <div className="trk"><div className="bud" style={{ width: ready ? `${(100 * x.budget) / maxBudget}%` : 0 }}><i className={x.spent_pct > 100 ? 'over' : ''} style={{ width: `${Math.min(x.spent_pct, 100)}%` }} /></div></div>
                <small className="sub">{short(x.budget_spent)} dépensés sur {short(x.budget)} FCFA</small>
              </div>
            ))}
          </section>
        )}
      </div>

      <div className="fn-tools">
        <div className="fn-tabs" role="tablist">
          {TABS.filter(([k]) => k === 'all' || counts[k] > 0).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}<b>{counts[k]}</b></button>
          ))}
        </div>
        <label className="fn-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-5-5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un paiement, un reçu, une personne" aria-label="Rechercher un paiement" />
        </label>
        {projects.length > 1 && (
          <select value={proj} onChange={(e) => setProj(e.target.value)} aria-label="Filtrer par projet">
            <option value="all">Tous les projets</option>
            {projects.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        )}
        {filtered && <button className="lk" onClick={() => { setTab('all'); setQ(''); setProj('all') }}>Réinitialiser</button>}
        {isManager && <button className="fn-csv" onClick={exportCsv} disabled={!list.length}>Exporter en CSV</button>}
      </div>

      {list.length === 0 && <div className="fn-none">{rows.length === 0 ? "Aucun paiement pour l'instant." : 'Aucun paiement ne correspond à vos critères.'}</div>}

      <div className="fn-list">
        {list.map((p) => {
          const [label, cls] = PAYMENT_STATUS[p.status]
          const who = p.payee?.full_name
          const [c1, c2] = GRADIENTS[hash(who || p.label) % GRADIENTS.length]
          return (
            <article className={`fn-row s-${p.status}`} key={p.id}>
              <i className="fn-av" style={{ background: `linear-gradient(135deg,${c1},${c2})` }}>{initials(who || p.label)}</i>
              <div className="fn-main">
                <strong>{p.label}</strong>
                <span>{[who, p.project?.title].filter(Boolean).join(' · ') || 'Dépense du projet'}</span>
                <small>{p.receipt_number ? `${p.receipt_number} · ` : ''}{p.payment_date ? dateShort(p.payment_date) : `Créé le ${dateShort(p.created_at)}`}</small>
              </div>
              <div className="fn-amt"><b>{fcfa(p.amount)}</b><span className={`chip ${cls}`}>{label}</span></div>
              <div className="fn-act">
                {p.status === 'validated' && <button className="fn-btn" onClick={() => receipt(p)}>Reçu PDF</button>}
                {p.status === 'pending' && isManager && <button className="btn" disabled={busy === p.id} onClick={() => validate(p.id)}>{busy === p.id ? 'Validation…' : 'Valider'}</button>}
              </div>
            </article>
          )
        })}
      </div>

      {list.length > 0 && (
        <div className="fn-total"><span>{list.length} paiement{list.length > 1 ? 's' : ''}{filtered ? ' affiché' + (list.length > 1 ? 's' : '') : ''}</span><b>Total : {fcfa(sum(list))}</b></div>
      )}
    </>
  )
}