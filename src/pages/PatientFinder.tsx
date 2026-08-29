import { formatSuggestion } from '@/lib/geo'
import { usePatientFinder } from '@/hooks/usePatientFinder'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function PatientFinder() {
  const { ranked, loading, error, findNearby } = usePatientFinder()

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Find a nearby health centre</h1>
      <p className="mb-6 text-sm text-slate-600">
        We'll suggest the closest PHC with beds available, based on your current location.
      </p>

      <Button onClick={findNearby} disabled={loading}>
        {loading ? 'Finding facilities…' : 'Find nearby facility'}
      </Button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {ranked.length > 0 && (
        <div className="mt-6 space-y-4">
          <Card title="Recommended">
            <p className="text-sm">{formatSuggestion(ranked)}</p>
          </Card>

          <div className="space-y-2">
            {ranked.slice(0, 5).map((r) => (
              <Card key={r.facility.facility_id}>
                <div className="flex justify-between text-sm">
                  <div>
                    <div className="font-medium">{r.facility.name_en}</div>
                    <div className="text-xs text-slate-500">{r.facility.name_hi}</div>
                  </div>
                  <div className="text-right">
                    <div>{r.distanceKm.toFixed(1)} km</div>
                    <div className="text-xs capitalize text-slate-500">{r.facility.availability_tier}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      <div className="mt-10 text-center">
  <a href="/staff-login" className="text-xs text-slate-400 hover:text-slate-600">
    PHC staff login
  </a>
</div>
    </div>
  )
}