import type { ForecastResponse, VoiceTranscribeResponse } from '@/types/api'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function runForecast(scope: 'district' | 'state' | 'national', scopeId?: string) {
  return apiFetch<ForecastResponse>('/api/forecast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, scopeId }),
  })
}

export async function runRedistribution() {
  return apiFetch<{ recommendations: number }>('/api/redistribute', { method: 'POST' })
}

export async function transcribeVoice(audio: Blob) {
  const form = new FormData()
  form.append('audio', audio, 'recording.webm')
  return apiFetch<VoiceTranscribeResponse>('/api/voice/transcribe', {
    method: 'POST',
    body: form,
  })
}

export async function applyVoiceStock(sessionId: string) {
  return apiFetch<{ success: boolean }>('/api/voice/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  })
}

export async function refreshRollups(districtId?: string) {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.rpc('refresh_rollups', {
    p_district_id: districtId ?? null,
  })
  if (error) throw error
  return data
}
