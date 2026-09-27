import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'
import { useNavigate, useLocation } from 'react-router-dom'
import Registration from './Registration'
import Vitals from './Vitals'
import Consulting from './Consulting'
import Lab from './Lab'
import Xray from './Xray'
import Scan from './Scan'
import Dispensary from './Dispensary'
import Cashier from './Cashier'
import RecoverID from './RecoverID'
import Inventory from './Inventory'
import PatientHistory from './PatientHistory'
import AdminPanel from './AdminPanel'

export default function Dashboard({ userRole, userEmail }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [activePage, setActivePage] = useState('dashboard')
  const [stats, setStats] = useState({ patients: 0, revenue: 0, queue: 0, pending: 0 })
  const [loadingStats, setLoadingStats] = useState(true)
  
  const handleLogout = async () => { 
    await supabase.auth.signOut()
    navigate('/login')
  }

  // --- ROLE PERMISSIONS ---
  const rolePermissions = {
    admin: ['dashboard', 'registration', 'vitals', 'consulting', 'cashier', 'lab', 'xray', 'scan', 'dispensary', 'inventory', 'history', 'recover-id', 'admin-panel'],
    receptionist: ['dashboard', 'registration', 'recover-id'],
    nurse: ['dashboard', 'vitals'],
    doctor: ['dashboard', 'consulting', 'history'],
    cashier: ['dashboard', 'cashier'],
    lab: ['dashboard', 'lab'],
    xray: ['dashboard', 'xray'],
    scan: ['dashboard', 'scan'],
    pharmacist: ['dashboard', 'dispensary', 'inventory']
  }

  const allowedPages = rolePermissions[userRole] || rolePermissions.receptionist;

  // Sync URL with active page & block unauthorized access
  useEffect(() => {
    const path = location.pathname.split('/').pop()
    if (path && path !== 'dashboard') {
      if (allowedPages.includes(path)) setActivePage(path)
      else { setActivePage('dashboard'); navigate('/dashboard') }
    } else { setActivePage('dashboard') }
  }, [location, allowedPages, navigate])

  // Fetch Real Data on Load
  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true)
      try {
        const today = new Date().toISOString().split('T')[0]
        const startOfDay = `${today}T00:00:00`
        const endOfDay = `${today}T23:59:59`

        const { count: patientsToday } = await supabase.from('patients').select('id', { count: 'exact', head: true }).gte('registered_at', startOfDay).lte('registered_at', endOfDay)
        
        let revenue = 0;
        if (userRole === 'admin') {
          const { data: todayReceipts } = await supabase.from('receipts').select('total_amount').gte('created_at', startOfDay).lte('created_at', endOfDay)
          revenue = todayReceipts ? todayReceipts.reduce((sum, r) => sum + Number(r.total_amount), 0) : 0
        }

        const { count: activeConsultations } = await supabase.from('consultations').select('id', { count: 'exact', head: true }).gte('created_at', startOfDay).lte('created_at', endOfDay).neq('status', 'discharged').neq('status', 'completed')
        const { count: pendingTasks } = await supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('cashier_completed', false).neq('status', 'discharged').neq('status', 'completed')

        setStats({ patients: patientsToday || 0, revenue: revenue, queue: activeConsultations || 0, pending: pendingTasks || 0 })
      } catch (err) { console.error("Error fetching dashboard stats:", err) }
      setLoadingStats(false)
    }

    if (activePage === 'dashboard') fetchStats()
  }, [activePage, userRole])

  const handleNavigation = (page) => {
    setActivePage(page)
    navigate(`/dashboard/${page === 'dashboard' ? '' : page}`)
  }

  const renderPageContent = () => {
    if (activePage === 'dashboard') {
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
            <h2 style={{ color: '#333', margin: 0 }}>📊 Quick Stats</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              {userRole === 'admin' && (
                <button onClick={() => window.print()} className="no-print" style={{ padding: '8px 15px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  🖨️ Print Daily Report
                </button>
              )}
              <button onClick={() => handleNavigation('dashboard')} className="no-print" style={{ padding: '8px 15px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: '#374151' }}>
                🔄 Refresh Data
              </button>
            </div>
          </div>
          
          <div id="admin-daily-report" className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', borderLeft: '5px solid #16a34a' }}>
              <h3 style={{ color: '#666', fontSize: '14px', margin: '0 0 10px 0' }}>👥 Patients Today</h3>
              <div style={{ fontSize: '42px', fontWeight: 'bold', color: '#16a34a' }}>{loadingStats ? '...' : stats.patients}</div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', borderLeft: '5px solid #3b82f6' }}>
              <h3 style={{ color: '#666', fontSize: '14px', margin: '0 0 10px 0' }}>⏳ Active Today</h3>
              <div style={{ fontSize: '42px', fontWeight: 'bold', color: '#3b82f6' }}>{loadingStats ? '...' : stats.queue}</div>
            </div>
            
            {userRole === 'admin' && (
              <div style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', borderLeft: '5px solid #f59e0b' }}>
                <h3 style={{ color: '#666', fontSize: '14px', margin: '0 0 10px 0' }}>💰 Today's Revenue (Admin Only)</h3>
                <div style={{ fontSize: '42px', fontWeight: 'bold', color: '#f59e0b' }}>{loadingStats ? '...' : `GH₵${stats.revenue.toFixed(2)}`}</div>
              </div>
            )}

            <div style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', borderLeft: '5px solid #ec4899' }}>
              <h3 style={{ color: '#666', fontSize: '14px', margin: '0 0 10px 0' }}>⚠️ Pending Tasks</h3>
              <div style={{ fontSize: '42px', fontWeight: 'bold', color: '#ec4899' }}>{loadingStats ? '...' : stats.pending}</div>
            </div>
          </div>
        </div>
      )
    } 
    // UPDATED: Passing userRole and userEmail to Registration
    else if (activePage === 'registration') return <Registration userRole={userRole} userEmail={userEmail} />
    else if (activePage === 'vitals') return <Vitals />
    else if (activePage === 'consulting') return <Consulting />
    else if (activePage === 'cashier') return <Cashier />
    else if (activePage === 'lab') return <Lab />
    else if (activePage === 'xray') return <Xray />
    else if (activePage === 'scan') return <Scan />
    else if (activePage === 'dispensary') return <Dispensary />
    else if (activePage === 'inventory') return <Inventory />
    else if (activePage === 'history') return <PatientHistory />
    else if (activePage === 'recover-id') return <RecoverID />
    else if (activePage === 'admin-panel') return <AdminPanel />
  }

  const isAllowed = (page) => allowedPages.includes(page)

  return (
    <div>
      {/* STEP 3: Background Overlay for better readability across all pages */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.92)', /* 92% white overlay */
        zIndex: -1
      }} />

      {/* MOBILE RESPONSIVE CSS PATCH + PRINT STYLES */}
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideInDown { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }
        
        nav button { transition: all 0.3s ease; position: relative; overflow: hidden; }
        nav button::before { content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); transition: left 0.5s ease; }
        nav button:hover::before { left: 100%; }

        /* --- MOBILE RESPONSIVE PATCH --- */
        @media (max-width: 768px) {
          .main-layout { flex-direction: column !important; }
          .sidebar { width: 100% !important; max-height: none !important; box-shadow: 0 4px 10px rgba(0,0,0,0.1) !important; }
          .sidebar nav { display: flex !important; flex-wrap: wrap !important; gap: 8px !important; padding: 15px !important; }
          .sidebar nav button { width: calc(50% - 4px) !important; margin-bottom: 0 !important; font-size: 13px !important; padding: 10px 5px !important; text-align: center !important; }
          .main-content { padding: 15px !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          table { display: block; overflow-x: auto; white-space: nowrap; }
        }

        /* --- ADMIN PRINT REPORT STYLES --- */
        @media print {
          body * { visibility: hidden; }
          #admin-daily-report, #admin-daily-report * { visibility: visible; }
          #admin-daily-report { position: absolute; left: 0; top: 0; width: 100%; padding: 40px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="main-layout" style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Arial, sans-serif', backgroundColor: 'transparent' }}>
        
        {/* STEP 4: Adjust Sidebar Transparency & Blur Effect */}
        <div className="sidebar" style={{ 
          width: '260px', 
          backgroundColor: 'rgba(30, 41, 59, 0.95)', /* 95% opacity for background blend */
          backdropFilter: 'blur(10px)', /* Glassmorphism blur effect */
          color: 'white', 
          display: 'flex', 
          flexDirection: 'column', 
          boxShadow: '4px 0 15px rgba(0,0,0,0.1)', 
          zIndex: 10 
        }}>
          <div style={{ padding: '25px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <h1 style={{ margin: 0, color: '#4ade80', fontSize: '28px' }}>🌿 Al-Haq</h1>
            <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Herbal Centre HMS</p>
            <div style={{ marginTop: '10px', padding: '4px 10px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', display: 'inline-block', fontSize: '11px', color: '#fbbf24', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {userRole || 'Staff'}
            </div>
          </div>
          
          <nav style={{ flex: 1, padding: '20px 10px', overflowY: 'auto' }}>
            {isAllowed('dashboard') && <button onClick={() => handleNavigation('dashboard')} style={sidebarButtonStyle(activePage === 'dashboard')}>📊 Dashboard</button>}
            {isAllowed('registration') && <button onClick={() => handleNavigation('registration')} style={sidebarButtonStyle(activePage === 'registration')}>📝 Registration</button>}
            {isAllowed('vitals') && <button onClick={() => handleNavigation('vitals')} style={sidebarButtonStyle(activePage === 'vitals')}>❤️ Vitals</button>}
            {isAllowed('consulting') && <button onClick={() => handleNavigation('consulting')} style={sidebarButtonStyle(activePage === 'consulting')}>🩺 Consulting</button>}
            {isAllowed('cashier') && <button onClick={() => handleNavigation('cashier')} style={sidebarButtonStyle(activePage === 'cashier')}>💰 Cashier</button>}
            {isAllowed('lab') && <button onClick={() => handleNavigation('lab')} style={sidebarButtonStyle(activePage === 'lab')}>🧪 Lab</button>}
            {isAllowed('xray') && <button onClick={() => handleNavigation('xray')} style={sidebarButtonStyle(activePage === 'xray')}>🩻 X-Ray</button>}
            {isAllowed('scan') && <button onClick={() => handleNavigation('scan')} style={sidebarButtonStyle(activePage === 'scan')}>🔬 Scan</button>}
            {isAllowed('dispensary') && <button onClick={() => handleNavigation('dispensary')} style={sidebarButtonStyle(activePage === 'dispensary')}>🌿 Dispensary</button>}
            {isAllowed('inventory') && <button onClick={() => handleNavigation('inventory')} style={sidebarButtonStyle(activePage === 'inventory')}>💊 Inventory</button>}
            {isAllowed('history') && <button onClick={() => handleNavigation('history')} style={sidebarButtonStyle(activePage === 'history')}>📁 Patient Records</button>}
            {isAllowed('recover-id') && <button onClick={() => handleNavigation('recover-id')} style={sidebarButtonStyle(activePage === 'recover-id')}>🔍 Recover ID</button>}
            {isAllowed('admin-panel') && <button onClick={() => handleNavigation('admin-panel')} style={sidebarButtonStyle(activePage === 'admin-panel')}>🛡️ Admin Panel</button>}
          </nav>

          <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '10px' }}>Logged in as:<br/><strong style={{color: 'white', wordBreak: 'break-all'}}>{userEmail}</strong></p>
            <button onClick={handleLogout} style={{ width: '100%', padding: '10px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Logout</button>
          </div>
        </div>

        <div className="main-content" style={{ flex: 1, padding: '30px', overflowY: 'auto', backgroundColor: 'transparent', minHeight: '100vh' }}>
          {renderPageContent()}
        </div>
      </div>
    </div>
  )
}

function sidebarButtonStyle(isActive) {
  return {
    display: 'block', width: '100%', padding: '15px', marginBottom: '10px',
    backgroundColor: isActive ? '#16a34a' : 'rgba(255, 255, 255, 0.05)',
    color: 'white',
    border: 'none', borderRadius: '10px', textAlign: 'left', fontSize: '15px',
    cursor: 'pointer', fontWeight: isActive ? 'bold' : 'normal',
    transition: 'all 0.3s ease',
    boxShadow: isActive ? '0 4px 12px rgba(22, 163, 74, 0.3)' : 'none',
    transform: isActive ? 'translateX(5px)' : 'translateX(0)'
  }
}