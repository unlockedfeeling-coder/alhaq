import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('add')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [staffList, setStaffList] = useState([])

  // NEW: Services Management States
  const [servicesList, setServicesList] = useState([])
  const [newServiceName, setNewServiceName] = useState('')
  const [newServiceCategory, setNewServiceCategory] = useState('Lab')
  const [newServicePrice, setNewServicePrice] = useState('')

  // Fetch data when tabs change
  useEffect(() => {
    if (activeTab === 'manage') {
      fetchStaff()
    }
    if (activeTab === 'services') {
      fetchServices()
    }
  }, [activeTab])

  const fetchStaff = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching staff:', error)
    } else {
      setStaffList(data || [])
    }
    setLoading(false)
  }

  // NEW: Fetch Services
  const fetchServices = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('medical_services')
      .select('*')
      .order('category')
      .order('name')
    
    if (error) {
      console.error('Error fetching services:', error)
    } else {
      setServicesList(data || [])
    }
    setLoading(false)
  }

  // Add User States
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('receptionist')

  // Reset Password State
  const [resetEmail, setResetEmail] = useState('')

  const handleAddUser = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: { data: { full_name: newName } }
      })

      if (error) throw error

      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ role: newRole, full_name: newName })
          .eq('id', data.user.id)

        if (profileError) throw profileError
        setMessage(`✅ Success! ${newName} has been added as a ${newRole}.`)
        setNewEmail('')
        setNewPassword('')
        setNewName('')
      }
    } catch (err) {
      setMessage('❌ Error: ' + err.message)
    }
    setLoading(false)
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + '/login',
      })

      if (error) throw error
      setMessage(`✅ Password reset link sent to ${resetEmail}.`)
      setResetEmail('')
    } catch (err) {
      setMessage('❌ Error: ' + err.message)
    }
    setLoading(false)
  }

  // Deactivate/Reactivate Staff
  const handleToggleActive = async (userId, email, currentlyActive) => {
    const action = currentlyActive ? 'deactivate' : 'reactivate'
    if (!window.confirm(`Are you sure you want to ${action} ${email}?`)) {
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentlyActive })
        .eq('id', userId)

      if (error) throw error
      
      setMessage(`✅ User ${action}d successfully!`)
      fetchStaff() // Refresh the list
    } catch (err) {
      setMessage('❌ Error: ' + err.message)
    }
    setLoading(false)
  }

  // NEW: Add Service
  const handleAddService = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('medical_services').insert([{
        name: newServiceName, 
        category: newServiceCategory, 
        price: parseFloat(newServicePrice)
      }])
      if (error) throw error
      setMessage('✅ Service added successfully!')
      setNewServiceName('')
      setNewServicePrice('')
      fetchServices()
    } catch (err) { 
      setMessage('❌ Error: ' + err.message) 
    }
    setLoading(false)
  }

  // NEW: Delete Service
  const handleDeleteService = async (id) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('medical_services').delete().eq('id', id)
      if (error) throw error
      setMessage('🗑️ Service deleted successfully.')
      fetchServices()
    } catch (err) { 
      setMessage('❌ Error: ' + err.message) 
    }
    setLoading(false)
  }

  const inputStyle = { 
    width: '100%', 
    padding: '12px', 
    border: '1px solid #ddd', 
    borderRadius: '6px', 
    fontSize: '14px', 
    boxSizing: 'border-box', 
    marginBottom: '15px' 
  }
  
  const labelStyle = { 
    display: 'block', 
    marginBottom: '5px', 
    color: '#333', 
    fontWeight: 'bold', 
    fontSize: '14px' 
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ color: '#333', marginBottom: '20px', borderBottom: '2px solid #16a34a', paddingBottom: '10px' }}>
        🛡️ Admin Panel
      </h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => { setActiveTab('add'); setMessage('') }} 
          style={{ flex: 1, padding: '15px', backgroundColor: activeTab === 'add' ? '#16a34a' : 'white', color: activeTab === 'add' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
        >
          ➕ Add Staff
        </button>
        <button 
          onClick={() => { setActiveTab('reset'); setMessage('') }} 
          style={{ flex: 1, padding: '15px', backgroundColor: activeTab === 'reset' ? '#f59e0b' : 'white', color: activeTab === 'reset' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
        >
          🔑 Reset Password
        </button>
        <button 
          onClick={() => { setActiveTab('manage'); setMessage('') }} 
          style={{ flex: 1, padding: '15px', backgroundColor: activeTab === 'manage' ? '#dc2626' : 'white', color: activeTab === 'manage' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
        >
          👥 Manage Staff
        </button>
        <button 
          onClick={() => { setActiveTab('services'); setMessage('') }} 
          style={{ flex: 1, padding: '15px', backgroundColor: activeTab === 'services' ? '#3b82f6' : 'white', color: activeTab === 'services' ? 'white' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
        >
          🧪 Manage Services
        </button>
      </div>

      {/* Message Display */}
      {message && (
        <div style={{ 
          backgroundColor: message.includes('✅') || message.includes('🗑️') ? '#dcfce7' : '#fee2e2', 
          color: message.includes('✅') || message.includes('🗑️') ? '#166534' : '#991b1b', 
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px', 
          fontWeight: 'bold' 
        }}>
          {message}
        </div>
      )}

      {/* ADD USER FORM */}
      {activeTab === 'add' && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0 }}>Create New Staff Account</h3>
          <form onSubmit={handleAddUser}>
            <div><label style={labelStyle}>Full Name *</label><input value={newName} onChange={(e) => setNewName(e.target.value)} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Email Address *</label><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Temporary Password *</label><input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle} required placeholder="e.g. password123" /></div>
            <div><label style={labelStyle}>Assign Role *</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={inputStyle}>
                <option value="receptionist">Receptionist</option><option value="nurse">Nurse</option><option value="doctor">Doctor</option>
                <option value="cashier">Cashier</option><option value="lab">Lab Technician</option><option value="radiology">Radiology Technician</option>
                <option value="pharmacist">Pharmacist</option><option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '15px', backgroundColor: loading ? '#9ca3af' : '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
              {loading ? 'Creating Account...' : '✅ Create Staff Account'}
            </button>
          </form>
        </div>
      )}

      {/* RESET PASSWORD FORM */}
      {activeTab === 'reset' && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0 }}>Reset Staff Password</h3>
          <p style={{ color: '#666', marginBottom: '20px' }}>Enter the staff member's email. A secure link will be sent to them to set a new password.</p>
          <form onSubmit={handleResetPassword}>
            <div><label style={labelStyle}>Staff Email Address *</label><input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} style={inputStyle} required /></div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '15px', backgroundColor: loading ? '#9ca3af' : '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
              {loading ? 'Sending Link...' : '📧 Send Reset Link'}
            </button>
          </form>
        </div>
      )}

      {/* MANAGE STAFF TAB */}
      {activeTab === 'manage' && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0 }}>👥 Active Staff Members</h3>
          <p style={{ color: '#666', marginBottom: '20px' }}>Deactivating a user will immediately log them out and prevent them from logging back in. Their past records will remain safe.</p>
          
          {loading && activeTab === 'manage' ? (
            <p>Loading staff list...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {staffList.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>No staff members found.</p>
              ) : (
                staffList.map((staff) => (
                  <div key={staff.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', backgroundColor: staff.is_active === false ? '#fee2e2' : '#f9fafb', border: `1px solid ${staff.is_active === false ? '#fca5a5' : '#e5e7eb'}`, borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{staff.full_name || 'Unknown Name'}</div>
                      <div style={{ fontSize: '13px', color: '#666' }}>
                        {staff.email} • <span style={{ textTransform: 'uppercase', fontWeight: 'bold', color: '#3b82f6', marginLeft: '5px' }}>{staff.role}</span>
                        {staff.is_active === false && <span style={{ color: '#dc2626', fontWeight: 'bold', marginLeft: '10px' }}>(DEACTIVATED)</span>}
                      </div>
                    </div>
                    <button onClick={() => handleToggleActive(staff.id, staff.email, staff.is_active !== false)} style={{ padding: '8px 15px', backgroundColor: staff.is_active === false ? '#16a34a' : '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                      {staff.is_active === false ? '✅ Reactivate' : '🚫 Deactivate'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* NEW: MANAGE SERVICES TAB */}
      {activeTab === 'services' && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0 }}>Add New Medical Service</h3>
          <form onSubmit={handleAddService} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '15px', alignItems: 'end', marginBottom: '30px' }}>
            <div>
              <label style={labelStyle}>Service Name</label>
              <input value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} style={{...inputStyle, marginBottom: 0}} placeholder="e.g. Malaria Test" required />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={newServiceCategory} onChange={(e) => setNewServiceCategory(e.target.value)} style={{...inputStyle, marginBottom: 0}}>
                <option value="Lab">Lab Test</option>
                <option value="X-Ray">X-Ray</option>
                <option value="Scan">Scan</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Price (GH₵)</label>
              <input type="number" step="0.01" value={newServicePrice} onChange={(e) => setNewServicePrice(e.target.value)} style={{...inputStyle, marginBottom: 0}} placeholder="0.00" required />
            </div>
            <button type="submit" disabled={loading} style={{ padding: '12px', backgroundColor: loading ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', height: '42px' }}>
              {loading ? 'Adding...' : '➕ Add'}
            </button>
          </form>

          <h3 style={{ marginTop: '0', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>Current Services List</h3>
          {loading && activeTab === 'services' ? (
            <p>Loading services...</p>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              {servicesList.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>No services found.</p>
              ) : (
                servicesList.map((service) => (
                  <div key={service.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#f9fafb' }}>
                    <div>
                      <strong style={{ fontSize: '15px' }}>{service.name}</strong> 
                      <span style={{ 
                        marginLeft: '10px', fontSize: '12px', 
                        backgroundColor: service.category === 'Lab' ? '#dbeafe' : service.category === 'X-Ray' ? '#fce7f3' : '#d1fae5',
                        color: service.category === 'Lab' ? '#1e40af' : service.category === 'X-Ray' ? '#9d174d' : '#065f46',
                        padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold'
                      }}>
                        {service.category}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <span style={{ fontWeight: 'bold', color: '#16a34a', fontSize: '16px' }}>GH₵ {Number(service.price).toFixed(2)}</span>
                      <button onClick={() => handleDeleteService(service.id)} style={{ color: '#dc2626', background: '#fee2e2', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}