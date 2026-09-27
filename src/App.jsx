import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './config/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function App() {
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deactivatedMsg, setDeactivatedMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, is_active')
          .eq('id', session.user.id)
          .single()
        
        // SECURITY CHECK: If user is deactivated, sign them out
        if (profile && profile.is_active === false) {
          await supabase.auth.signOut()
          setSession(null)
          setDeactivatedMsg('Your account has been deactivated by the Admin. Please contact the hospital manager.')
        } else {
          setSession(session)
          setUserRole(profile?.role || 'receptionist')
          setDeactivatedMsg('')
        }
      } else {
        setSession(null)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, is_active')
          .eq('id', session.user.id)
          .single()

        if (profile && profile.is_active === false) {
          await supabase.auth.signOut()
          setSession(null)
          setDeactivatedMsg('Your account has been deactivated by the Admin.')
        } else {
          setSession(session)
          setUserRole(profile?.role || 'receptionist')
          setDeactivatedMsg('')
        }
      } else {
        setSession(null)
        setUserRole(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🌿</div>
          <p style={{ color: '#666' }}>Loading Al-Haq Herbal Centre HMS...</p>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!session ? <Login deactivatedMsg={deactivatedMsg} /> : <Navigate to="/dashboard" />} />
        <Route path="/dashboard/*" element={session ? <Dashboard userRole={userRole} userEmail={session?.user?.email} /> : <Navigate to="/login" />} />
        <Route path="/" element={<Navigate to={session ? "/dashboard" : "/login"} />} />
        <Route path="*" element={<Navigate to={session ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  )
}

export default App