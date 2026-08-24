import AppShell from '@/components/layout/AppShell'
import RoleGuard from '@/components/layout/RoleGuard'
import Card from '@/components/ui/Card'

export default function NationalDashboard() {
  return (
    <RoleGuard allowed={['national_admin']}>
      <AppShell title="National Dashboard">
        <Card title="National rollups & Gemini forecasts">
          <p className="text-sm text-slate-600">
            Week 3: national view, forecast triggers, and redistribution recommendations.
          </p>
        </Card>
      </AppShell>
    </RoleGuard>
  )
}
