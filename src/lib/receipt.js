import { fcfa, dateLong } from './format'

// Génère le reçu PDF dans le navigateur (aucun serveur nécessaire).
export async function downloadReceipt(p) {
  const { jsPDF } = await import('jspdf')
  const d = new jsPDF()
  d.setFont('helvetica', 'bold'); d.setFontSize(22); d.text('Jalon', 20, 26)
  d.setFontSize(14); d.text('Reçu de paiement', 20, 40)
  d.setDrawColor(200); d.line(20, 46, 190, 46)
  d.setFont('helvetica', 'normal'); d.setFontSize(11)
  const rows = [
    ['Numéro de reçu', p.receipt_number],
    ['Date de paiement', dateLong(p.payment_date)],
    ['Bénéficiaire', p.payee?.full_name || '—'],
    ['Objet', p.label],
    ['Projet', p.project?.title || '—'],
  ]
  rows.forEach(([k, v], i) => { d.setTextColor(110); d.text(k, 20, 60 + i * 10); d.setTextColor(20); d.text(String(v), 75, 60 + i * 10) })
  d.setFont('helvetica', 'bold'); d.setFontSize(15); d.text(`Montant : ${fcfa(p.amount)}`, 20, 125)
  d.setFont('helvetica', 'normal'); d.setFontSize(9); d.setTextColor(120)
  d.text('Document généré par Jalon. Paiement validé et enregistré.', 20, 280)
  d.save(`${p.receipt_number}.pdf`)
}
