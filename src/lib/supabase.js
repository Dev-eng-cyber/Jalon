import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configured = Boolean(url && key)
// Valeurs de repli pour que l'application s'affiche même sans .env (écran d'aide).
export const supabase = createClient(url || 'http://localhost', key || 'missing')
