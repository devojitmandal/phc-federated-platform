// src/lib/api-client.ts
import type { ForecastResponse, VoiceTranscribeResponse } from '@/types/api'
import { supabase } from './supabase'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // 1. Get the current session securely
  const { data: { session }, error } = await supabase.auth.getSession()
  
  // 2. Client-side guard: Throw immediately if no token is found (Ghost Session)
  if (error || !session?.access_token) {
    console.error("Authentication Error: No active Supabase token found.")
    throw new Error('Authentication required. Please log in again.')
  }

  // 3. Bulletproof header merging
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  
  // Auto-inject JSON content type if a stringified JSON body is present
  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  // 4. Execute request
  const res = await fetch(path, { ...init, headers })
  
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function runForecast(scope: 'district' | 'state' | 'national', scopeId?: string) {
  return apiFetch<ForecastResponse>('/api/forecast', {
    method: 'POST',
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
    // Note: Do NOT set Content-Type here; let the browser set it automatically for FormData (with the boundary)
  })
}

export async function applyVoiceStock(sessionId: string) {
  return apiFetch<{ success: boolean }>('/api/voice/apply', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  })
}

export async function refreshRollups(districtId?: string) {
  const { data, error } = await supabase.rpc('refresh_rollups', {
    p_district_id: districtId ?? null,
  })
  if (error) throw error
  return data
}

export async function requestTransferPlan(payload: {
  medicineId: string
  medicineName: string
}) {
  return apiFetch<{ plan: string; level: string }>('/api/transfer', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function requestBricsInsight(bricsData: unknown) {
  return apiFetch<{ insight: unknown; based_on_medicine: string }>('/api/brics-insight', {
    method: 'POST',
    body: JSON.stringify({ bricsData }),
  })
}

export async function requestRedistribute(payload: {
  overloadedFacilityId: string;
  overloadedFacilityName: string;
  issueType: string;
}) {
  return apiFetch<{ plan: string }>('/api/redistribute', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}