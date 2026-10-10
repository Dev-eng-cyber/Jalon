export const num = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
export const fcfa = (n) => `${num(n)} FCFA`
export const dateShort = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '')
export const dateLong = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
export const firstName = (p) => (p?.full_name?.trim().split(' ')[0] || p?.email?.split('@')[0] || '')

export const ROLE_LABEL = { admin: 'Administrateur', project_manager: 'Chef de projet', member: "Membre d'équipe", external: 'Intervenant externe' }
export const PROJECT_STATUS = {
  planned: ['Planifié', ''], active: ['En cours', 'c-acc'], in_review: ['En revue', 'c-warn'],
  completed: ['Terminé', 'c-ok'], on_hold: ['En pause', ''], cancelled: ['Annulé', 'c-risk'],
}
export const TASK_COLUMNS = [['todo', 'À faire'], ['in_progress', 'En cours'], ['in_review', 'En revue'], ['done', 'Terminé']]
export const PRIORITY = { low: 'Basse', medium: 'Moyenne', high: 'Haute' }
export const PAYMENT_STATUS = { pending: ['En attente', 'c-warn'], validated: ['Validé', 'c-ok'], cancelled: ['Annulé', 'c-risk'] }
export const RESERVATION_STATUS = {
  pending: ['En attente', 'c-warn'], approved: ['Approuvée', 'c-ok'],
  rejected: ['Refusée', 'c-risk'], cancelled: ['Annulée', ''],
}

const ERRORS = [
  ['Invalid login credentials', 'Email ou mot de passe incorrect.'],
  ['Email not confirmed', "Confirmez d'abord votre adresse email grâce au lien reçu."],
  ['User already registered', 'Un compte existe déjà avec cet email.'],
  ['Password should be at least', 'Le mot de passe est trop court.'],
  ['rate limit', 'Trop de tentatives. Patientez quelques minutes.'],
  ['duplicate key', 'Cette action a déjà été effectuée.'],
  ['row-level security', "Vous n'avez pas le droit d'effectuer cette action."],
]
export const frError = (msg = '') => ERRORS.find(([k]) => msg.toLowerCase().includes(k.toLowerCase()))?.[1] || msg
