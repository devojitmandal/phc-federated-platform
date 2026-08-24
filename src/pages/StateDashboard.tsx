import AppShell from '@/components/layout/AppShell'
import RoleGuard from '@/components/layout/RoleGuard'
import Card from '@/components/ui/Card'

export default function StateDashboard() {
  return (
    <RoleGuard allowed={['state_viewer']}>
      <AppShell title="State Dashboard">
        <Card title="State rollups (stretch goal)">
          <p className="text-sm text-slate-600">
            Week 3: state-level aggregates and alert feed.
          </p>
        </Card>
      </AppShell>
    </RoleGuard>
  )
}
