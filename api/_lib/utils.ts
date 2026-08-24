import { createClient } from '@supabase/supabase-js'

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

export async function callGemini(prompt: string): Promise<string> {
  const apiKey = getGeminiApiKey()
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    },
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error: ${err}`)
  }
  const json = await res.json()
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
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
