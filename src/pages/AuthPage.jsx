import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { frError } from '../lib/format'
import Logo from '../components/Logo'

const TITLES = { in: 'Content de vous revoir', up: 'Créer votre compte', reset: 'Réinitialiser le mot de passe', sent: 'Vérifiez votre boîte mail', newpw: 'Choisissez un nouveau mot de passe' }
const CTA = { in: 'Se connecter', up: 'Créer mon compte', reset: 'Envoyer le lien', newpw: 'Enregistrer le mot de passe' }

export default function AuthPage({ forceMode }) {
  const [q] = useSearchParams()
  const nav = useNavigate()
  const { session, signIn, signUp, reset, updatePassword } = useAuth()
  const [m, setM] = useState(forceMode || q.get('m') || 'in')
  const [f, setF] = useState({ name: '', email: '', pw: '', role: 'member' })
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  useEffect(() => { if (session && m !== 'newpw' && m !== 'sent') nav('/app', { replace: true }) }, [session, m, nav])

  const go = (mode) => (e) => { e?.preventDefault(); setErr(''); setNotice(''); setM(mode) }

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      if (m === 'in') { await signIn(f.email, f.pw); nav('/app') }
      else if (m === 'up') {
        if (f.pw.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.')
        const data = await signUp(f)
        if (data.session) nav('/app'); else setM('sent')
      } else if (m === 'reset') { await reset(f.email); setNotice('Si cet email existe, un lien de réinitialisation vient d’être envoyé.'); setM('in') }
      else if (m === 'newpw') {
        if (f.pw.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.')
        await updatePassword(f.pw); nav('/app')
      }
    } catch (ex) { setErr(frError(ex.message)) } finally { setBusy(false) }
  }

  const field = (id, label, type, extra = {}) => (
    <label>{label}<input id={id} type={type} value={f[id === 'em' ? 'email' : id === 'pw' ? 'pw' : 'name']} onChange={set(id === 'em' ? 'email' : id === 'pw' ? 'pw' : 'name')} required {...extra} /></label>
  )

  return (
    <div id="auth">
      <div className="ap">
        <Link className="lg" to="/"><Logo />Jalon</Link>
        <div><h2>Gardez le cap sur chaque jalon.</h2><p>Connectez-vous pour retrouver vos projets, vos tâches et vos reçus.</p></div>
        <svg viewBox="0 0 300 150" style={{ width: 'min(300px,100%)' }} aria-hidden="true">
          <rect x="10" y="108" width="280" height="6" rx="3" fill="#fff" opacity=".35" /><rect x="40" y="30" width="6" height="80" rx="3" fill="#fff" />
          <path d="M46 32h54l-14 18 14 18H46z" fill="#fff" /><rect x="130" y="76" width="70" height="28" rx="8" fill="#fff" opacity=".9" />
          <rect x="130" y="44" width="110" height="26" rx="8" fill="#fff" opacity=".5" /><rect x="210" y="76" width="64" height="28" rx="8" fill="#fff" opacity=".3" />
        </svg>
      </div>
      <div className="af">
        <div id="at" hidden={!['in', 'up'].includes(m)}>
          <button type="button" aria-selected={m === 'in'} onClick={go('in')}>Connexion</button>
          <button type="button" aria-selected={m === 'up'} onClick={go('up')}>Inscription</button>
        </div>
        <form id="af" onSubmit={submit}>
          <h2>{TITLES[m]}</h2>
          {notice && <p className="sub" role="status">{notice}</p>}
          {m === 'sent' && <p>Un lien de confirmation a été envoyé à <strong>{f.email}</strong>. Cliquez dessus pour activer votre compte, puis connectez-vous.</p>}
          {m === 'up' && field('nm', 'Nom complet', 'text', { autoComplete: 'name' })}
          {['in', 'up', 'reset'].includes(m) && field('em', 'Adresse email', 'email', { autoComplete: 'email' })}
          {['in', 'up', 'newpw'].includes(m) && field('pw', m === 'up' ? 'Mot de passe (8 caractères minimum)' : m === 'newpw' ? 'Nouveau mot de passe' : 'Mot de passe', 'password', { autoComplete: m === 'in' ? 'current-password' : 'new-password' })}
          {m === 'in' && <a href="#" className="fl" onClick={go('reset')}>Mot de passe oublié ?</a>}
          {m === 'up' && (<>
            <label>Vous êtes<select value={f.role} onChange={set('role')}><option value="member">Membre d'équipe</option><option value="external">Intervenant externe</option></select></label>
            <p className="sub">Les rôles Chef de projet et Administrateur sont attribués par un administrateur.</p>
          </>)}
          <p className="err" role="alert">{err}</p>
          {m !== 'sent' && <button className="btn w" disabled={busy}>{busy ? 'Un instant…' : CTA[m]}</button>}
          {['reset', 'sent'].includes(m) && <a href="#" className="bk" onClick={go('in')}>Retour à la connexion</a>}
        </form>
        <Link className="bk" to="/">Retour à l'accueil</Link>
      </div>
    </div>
  )
}
