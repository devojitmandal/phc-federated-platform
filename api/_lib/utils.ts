// api/_lib/utils.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Profile, UserRole } from '../../src/types/database'

export function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin credentials')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function getGeminiApiKey() {
  const key = process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY
  if (!key) throw new Error('Missing GOOGLE_AI_API_KEY')
  return key
}

// NEW: Centralized Authentication & Role Guard Middleware
export async function verifyAuth(
  req: Request, 
  allowedRoles?: UserRole[]
): Promise<{ user: any; profile: Profile; supabase: SupabaseClient }> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid authorization header')
  }
  
  const token = authHeader.split(' ')[1]
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  
  if (!url || !anonKey) throw new Error('Server misconfiguration: Missing Supabase URL/Anon Key')

  // Use the Anon key to verify the user's JWT securely
  const supabase = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) throw new Error('Unauthorized: Invalid or expired token')

    const supabaseAdmin = getSupabaseAdmin()
  
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

  if (profileError || !profile) throw new Error('Unauthorized: Profile not found')

  // Role-based Access Control (RBAC) check
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(profile.role as UserRole)) {
    throw new Error(`Forbidden: Role '${profile.role}' is not authorized to perform this action`)
  }

  return { user, profile: profile as Profile, supabase }
}

export async function callGemini(prompt: string): Promise<string> {
  const apiKey = getGeminiApiKey()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        signal: controller.signal,
      },
    )
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API error: ${err}`)
    }
    const json = await res.json()
    return json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Gemini API request timed out after 20s')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export async function parseRequestBody<T>(req: Request): Promise<T> {
  return req.json() as Promise<T>
}

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export function errorResponse(message: string, status = 500) {
  return Response.json({ error: message }, { status })
}