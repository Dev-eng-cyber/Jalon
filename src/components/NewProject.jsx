import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ROLE_LABEL, frError } from '../lib/format'

// Formulaire de création de projet (réservé à l'administrateur : voir la policy projects_insert).
export default function NewProject({ onDone, onCancel, toast }) {
  const [owners, setOwners] = useState([])
  const [f, setF] = useState({ title: '', budget: '', start_date: '', end_date: '', owner_id: '', description: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  useEffect(() => {
    supabase.from('profiles').select('id,full_name,email,role').in('role', ['admin', 'project_manager']).order('full_name')
      .then(({ data }) => { setOwners(data || []); if (data?.[0]) setF((x) => ({ ...x, owner_id: data[0].id })) })
  }, [])

  async function submit(e) {
    e.preventDefault(); setBusy(true)
    const { error } = await supabase.from('projects').insert({
      title: f.title.trim(), description: f.description || null, budget: Number(f.budget) || 0,
      start_date: f.start_date || null, end_date: f.end_date || null, owner_id: f.owner_id || null, status: 'planned',
    })
    setBusy(false)
    if (error) return toast(frError(error.message))
    toast('Projet créé'); onDone()
  }

  return (
    <form className="np" onSubmit={submit}>
      <h2>Nouveau projet</h2>
      <div className="npg">
        <label>Nom du projet<input value={f.title} onChange={set('title')} required /></label>
        <label>Budget (FCFA)<input type="number" min="0" step="1000" value={f.budget} onChange={set('budget')} required /></label>
        <label>Début<input type="date" value={f.start_date} onChange={set('start_date')} /></label>
        <label>Fin prévue<input type="date" value={f.end_date} min={f.start_date} onChange={set('end_date')} /></label>
        <label>Responsable
          <select value={f.owner_id} onChange={set('owner_id')} required>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name || o.email} ({ROLE_LABEL[o.role]})</option>)}
          </select>
        </label>
        <label>Description<input value={f.description} onChange={set('description')} /></label>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" disabled={busy}>{busy ? 'Création…' : 'Créer le projet'}</button>
        <button type="button" className="ghost" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  )
}