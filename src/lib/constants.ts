export const ROLE_ROUTES = {
  facility_worker: '/facility',
  district_admin: '/district',
  state_viewer: '/state',
  national_admin: '/national',
} as const

export type UserRole = keyof typeof ROLE_ROUTES

export const DEMO_ACCOUNTS = [
  { email: 'worker@phc.demo', role: 'facility_worker', label: 'PHC Worker (PHC Amer, Jaipur)' },
  { email: 'district@phc.demo', role: 'district_admin', label: 'District Admin (Jaipur)' },
  { email: 'state@phc.demo', role: 'state_viewer', label: 'State Viewer (Rajasthan)' },
  { email: 'national@phc.demo', role: 'national_admin', label: 'National Admin' },
] as const

export const RURAL_PHC_POPULATION_AVG = 35_600
