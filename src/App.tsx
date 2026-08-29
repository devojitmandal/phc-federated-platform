import { Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import PatientFinder from './pages/PatientFinder'
import FacilityDashboard from './pages/FacilityDashboard'
import DistrictDashboard from './pages/DistrictDashboard'
import StateDashboard from './pages/StateDashboard'
import NationalDashboard from './pages/NationalDashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PatientFinder />} />
      <Route path="/staff-login" element={<Login />} />
      <Route path="/facility" element={<FacilityDashboard />} />
      <Route path="/district" element={<DistrictDashboard />} />
      <Route path="/state" element={<StateDashboard />} />
      <Route path="/national" element={<NationalDashboard />} />
    </Routes>
    
  )
  
}