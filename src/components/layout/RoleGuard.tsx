import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useProfile } from '@/hooks/useProfile'
import { ROLE_ROUTES, type UserRole } from '@/lib/constants'

interface RoleGuardProps {
  allowed: UserRole[]
  children: ReactNode
}

export default function RoleGuard({ allowed, children }: RoleGuardProps) {
  const { profile, loading } = useProfile()

  if (loading) {
    return <div className="p-8 text-slate-500">Loading...</div>
  }

  if (!profile) {
    return <Navigate to="/login" replace />
  }

  if (!allowed.includes(profile.role)) {
    return <Navigate to={ROLE_ROUTES[profile.role]} replace />
  }

  return <>{children}</>
}
