import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { rankFacilities, type RankedFacility } from '@/lib/geo'

export function usePatientFinder() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [ranked, setRanked] = useState<RankedFacility[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const findNearby = useCallback(() => {
    setLoading(true)
    setError(null)

    if (!navigator.geolocation) {
      setError('Location is not supported on this device.')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setLocation({ lat, lng })

        const { data, error: fetchError } = await supabase
          .from('public_bed_availability')
          .select('*')

        if (fetchError) {
          setError(fetchError.message)
        } else if (data) {
          setRanked(rankFacilities(lat, lng, data))
        }
        setLoading(false)
      },
      () => {
        setError('Could not get your location. Please allow location access.')
        setLoading(false)
      },
    )
  }, [])

  return { location, ranked, loading, error, findNearby }
}