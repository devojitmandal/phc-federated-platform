// src/lib/regionLanguage.ts
import i18n from '@/language_toggle/i18n'

export interface LanguageOption {
  code: string
  label: string
}

export const ALL_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी (Hindi)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
]

const STORAGE_KEY = 'phc_detected_language'

export function getDetectedLanguage(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

function setDetectedLanguage(code: string) {
  localStorage.setItem(STORAGE_KEY, code)
}

// Puts the detected language first in the list, keeps the rest in order — used to build the dropdown
export function getOrderedLanguages(): LanguageOption[] {
  const detected = getDetectedLanguage()
  if (!detected || detected === 'en') return ALL_LANGUAGES
  const match = ALL_LANGUAGES.find((l) => l.code === detected)
  if (!match) return ALL_LANGUAGES
  return [match, ...ALL_LANGUAGES.filter((l) => l.code !== detected)]
}

// Reverse-geocodes coordinates to a state, maps state to language, saves it, and (by default) switches the app to it immediately
export async function detectAndApplyLanguage(
  lat: number,
  lng: number,
  opts?: { autoApply?: boolean },
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
    )
    const data = await res.json()
    const state = (data.address?.state || '').toLowerCase()
    const country = data.address?.country || ''

    let code: string | null = null
    if (state.includes('west bengal')) code = 'bn'
    else if (state.includes('maharashtra')) code = 'mr'
    else if (state.includes('tamil nadu')) code = 'ta'
    else if (state.includes('telangana') || state.includes('andhra pradesh')) code = 'te'
    else if (country === 'India') code = 'hi'

    if (code) {
      setDetectedLanguage(code)
      if (opts?.autoApply !== false) {
        i18n.changeLanguage(code)
      }
    }
    return code
  } catch {
    return null
  }
}