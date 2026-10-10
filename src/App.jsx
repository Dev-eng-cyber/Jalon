import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { configured } from './lib/supabase'
import { AuthProvider, useAuth } from './context/AuthContext'
import Splash from './components/Splash'
import Shell, { ITEMS, Skeleton, homeFor } from './components/Shell'
import Landing from './pages/Landing'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Catalogue from './pages/Catalogue'
import Finances from './pages/Finances'
import Users from './pages/Users'

function Protected({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <main><Skeleton /></main>
  return session ? children : <Navigate to="/auth" replace />
}

function RoleRoute({ path, children }) {
  const { profile } = useAuth()
  if (!profile) return <Skeleton />
  const allowed = ITEMS.find((i) => i.to === path).roles.includes(profile.role)
  return allowed ? children : <Navigate to={homeFor(profile.role)} replace />
}

function Setup() {
  return (
    <main style={{ maxWidth: 640, margin: '60px auto' }}>
      <h1>Connexion à Supabase manquante</h1>
      <p>Créez un fichier <code>.env</code> à la racine du projet (copiez <code>.env.example</code>) avec l'URL et la clé publique de votre projet Supabase, puis relancez <code>npm run dev</code>.</p>
    </main>
  )
}

export default function App() {
  const [intro, setIntro] = useState(true)
  if (!configured) return <Setup />
  return (
    <AuthProvider>
      {intro && <Splash onDone={() => setIntro(false)} />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/reset" element={<AuthPage forceMode="newpw" />} />
        <Route path="/app" element={<Protected><Shell /></Protected>}>
          <Route index element={<RoleRoute path="/app"><Dashboard /></RoleRoute>} />
          <Route path="taches" element={<RoleRoute path="/app/taches"><Tasks /></RoleRoute>} />
          <Route path="catalogue" element={<RoleRoute path="/app/catalogue"><Catalogue /></RoleRoute>} />
          <Route path="utilisateurs" element={<RoleRoute path="/app/utilisateurs"><Users /></RoleRoute>} />
          <Route path="finances" element={<RoleRoute path="/app/finances"><Finances /></RoleRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}