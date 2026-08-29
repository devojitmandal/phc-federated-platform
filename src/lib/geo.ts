import type { PublicBedAvailability } from '@/types/database'

const TIER_SCORE: Record<PublicBedAvailability['availability_tier'], number> = {
  high: 3,
  moderate: 2,
  low: 1,
  full: 0,
  unknown: 0.5,
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

export interface RankedFacility {
  facility: PublicBedAvailability
  distanceKm: number
}

export function rankFacilities(
  patientLat: number,
  patientLng: number,
  facilities: PublicBedAvailability[],
): RankedFacility[] {
  return facilities
    .filter((f) => f.availability_tier !== 'full')
    .map((f) => ({ facility: f, distanceKm: haversineKm(patientLat, patientLng, f.lat, f.lng) }))
    .sort((a, b) => {
      // Prioritize availability tier first, then distance within similar tiers
      const tierDiff = TIER_SCORE[b.facility.availability_tier] - TIER_SCORE[a.facility.availability_tier]
      if (Math.abs(tierDiff) >= 1) return tierDiff
      return a.distanceKm - b.distanceKm
    })
}

export function formatSuggestion(ranked: RankedFacility[]): string {
  if (ranked.length === 0) return 'No nearby facilities with available beds right now.'
  const top = ranked[0]
  const tierLabel = { high: 'good', moderate: 'moderate', low: 'limited', unknown: 'uncertain' }[
    top.facility.availability_tier as 'high' | 'moderate' | 'low' | 'unknown'
  ]
  return `${top.facility.name_en} is ${top.distanceKm.toFixed(1)}km away with ${tierLabel} bed availability.`
}