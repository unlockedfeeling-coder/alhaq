import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

export default function Registration({ userRole, userEmail }) {
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', date_of_birth: '', gender: 'Male', 
    phone: '', address: '', blood_type: 'O+', allergies: '', payment_method: 'Cash'
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [pendingPatients, setPendingPatients] = useState([])
  
  // NEW: History State
  const [regHistory, setRegHistory] = useState([])

  const [returningId, setReturningId] = useState('')
  const [returningPatient, setReturningPatient] = useState(null)
  const [returningError, setReturningError] = useState('')

  useEffect(() => { 
    fetchPending()
    fetchRegHistory()
  }, [])

  // NEW: Fetch Registration Fee History
  const fetchRegHistory = async () => {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .ilike('description', '%Registration%')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (!error && data) {
      setRegHistory(data)
    }
  }

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

  const handleReturningSearch = async (e) => {
    e.preventDefault()
    setReturningError('')
    setReturningPatient(null)
    setLoading(true)

    try {
      const { data, error } = await supabase.from('patients').select('*').eq('patient_id', returningId.toUpperCase()).single()
      if (error) throw error
      if (data) {
        setReturningPatient(data)
        setMessage(`✅ Patient Verified: ${data.first_name} ${data.last_name} is already registered.`)
      }
    } catch (err) {
      setReturningError('❌ Patient ID not found.')
    }
    setLoading(false)
  }

  const handleRegisterAndPay = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // 1. Generate new Patient ID
      const { count } = await supabase.from('patients').select('*', { count: 'exact', head: true }).eq('registration_paid', true)
      const newId = `AH-2026-${String((count || 0) + 1).padStart(3, '0')}`

      // 2. Insert patient as PAID immediately
      const { data: patientData, error: patientError } = await supabase.from('patients').insert([{
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender,
        phone: formData.phone,
        address: formData.address || null,
        blood_type: formData.blood_type,
        allergies: formData.allergies || null,
        patient_id: newId,
        registration_paid: true,
        registered_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }]).select().single()

      if (patientError) throw patientError

      // 3. Create Receipt Record (Uses the logged-in staff's email/name for accountability)
      const receiptNum = `REG-${Date.now().toString().slice(-6)}`
      await supabase.from('receipts').insert([{
        receipt_number: receiptNum,
        patient_id: newId,
        patient_name: `${formData.first_name} ${formData.last_name}`,
        total_amount: 20,
        payment_method: formData.payment_method,
        cashier_name: userEmail || 'Reception Desk', // Tracks exactly who did it
        description: 'Patient Registration / Folder Fee',
        created_at: new Date().toISOString()
      }])

      setMessage(`🎉 Registration Complete & Paid! New Patient ID: ${newId}`)
      setFormData({ first_name: '', last_name: '', date_of_birth: '', gender: 'Male', phone: '', address: '', blood_type: 'O+', allergies: '', payment_method: 'Cash' })
      
      // Refresh history and pending lists
      fetchRegHistory()
      fetchPending()
      
    } catch (err) { 
      setMessage('❌ Error: ' + err.message) 
    }
    setLoading(false)
  }

  const fetchPending = async () => {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('registration_paid', false)
      .order('created_at', { ascending: false })
    
    if (!error) setPendingPatients(data || [])
  }

  const handleGenerateID = async (patientId) => {
    setLoading(true)
    try {
      const { count } = await supabase.from('patients').select('*', { count: 'exact', head: true }).eq('registration_paid', true)
      const newId = `AH-2026-${String((count || 0) + 1).padStart(3, '0')}`

      const { error } = await supabase.from('patients').update({ 
        patient_id: newId, 
        registration_paid: true,
        registered_at: new Date().toISOString() 
      }).eq('id', patientId)
      
      if (error) throw error
      
      setMessage(`🎉 Manual Registration Complete! New Patient ID: ${newId}`)
      fetchPending()
      fetchRegHistory()
    } catch (err) { 
      setMessage('❌ Error generating ID: ' + err.message) 
    }
    setLoading(false)
  }

  const inputStyle = { width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '15px' }
  const labelStyle = { display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold', fontSize: '14px' }
  const thStyle = { padding: '12px', color: '#666', fontWeight: 'bold', borderBottom: '2px solid #e5e7eb', textAlign: 'left' }
  const tdStyle = { padding: '12px', color: '#333', borderBottom: '1px solid #f3f4f6' }

  // Filter history: Admin sees ALL, Receptionist sees ONLY their own transactions
  const visibleHistory = userRole === 'admin' 
    ? regHistory 
    : regHistory.filter(r => r.cashier_name === userEmail)

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ color: '#333', marginBottom: '20px', borderBottom: '2px solid #16a34a', paddingBottom: '10px' }}>📝 Patient Registration</h2>

      {message && (
        <div style={{ 
          backgroundColor: message.includes('✅') || message.includes('🎉') ? '#dcfce7' : '#fee2e2', 
          color: message.includes('✅') || message.includes('🎉') ? '#166534' : '#991b1b', 
          padding: '15px', borderRadius: '8px', marginBottom: '20px', fontWeight: 'bold' 
        }}>
          {message}
        </div>
      )}

      {/* RETURNING PATIENT SEARCH */}
      <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '30px', border: '1px solid #e5e7eb' }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#3b82f6' }}>🔄 Returning Patient?</h3>
        <form onSubmit={handleReturningSearch} style={{ display: 'flex', gap: '10px' }}>
          <input 
            value={returningId} 
            onChange={(e) => setReturningId(e.target.value)} 
            placeholder="Enter Patient ID (e.g. AH-2026-001)" 
            style={{ ...inputStyle, marginBottom: 0, flex: 1 }} 
          />
          <button type="submit" disabled={loading} style={{ padding: '12px 25px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            {loading ? 'Searching...' : '🔍 Verify ID'}
          </button>
        </form>
        {returningError && <div style={{ marginTop: '15px', color: '#dc2626', fontWeight: 'bold' }}>{returningError}</div>}
        {returningPatient && (
          <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
            <strong>Verified:</strong> {returningPatient.first_name} {returningPatient.last_name} is already in the system.
          </div>
        )}
      </div>

      {/* NEW PATIENT REGISTRATION FORM */}
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>New Patient Details</h3>
          <div style={{ backgroundColor: '#dcfce7', padding: '8px 15px', borderRadius: '20px', fontSize: '14px', color: '#166534', fontWeight: 'bold', border: '1px solid #86efac' }}>
            💰 Collect Folder Fee: GH₵ 20.00
          </div>
        </div>

        <form onSubmit={handleRegisterAndPay}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div><label style={labelStyle}>First Name *</label><input name="first_name" value={formData.first_name} onChange={handleChange} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Last Name *</label><input name="last_name" value={formData.last_name} onChange={handleChange} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Date of Birth</label><input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} style={inputStyle} /></div>
            <div><label style={labelStyle}>Gender</label>
              <select name="gender" value={formData.gender} onChange={handleChange} style={inputStyle}>
                <option value="Male">Male</option><option value="Female">Female</option>
              </select>
            </div>
            <div><label style={labelStyle}>Phone Number *</label><input name="phone" value={formData.phone} onChange={handleChange} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Blood Type</label>
              <select name="blood_type" value={formData.blood_type} onChange={handleChange} style={inputStyle}>
                <option value="O+">O+</option><option value="O-">O-</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="AB+">AB+</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Address</label><input name="address" value={formData.address} onChange={handleChange} style={inputStyle} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Allergies (Optional)</label><input name="allergies" value={formData.allergies} onChange={handleChange} style={inputStyle} placeholder="e.g. Penicillin, Peanuts" /></div>
            
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Payment Method for Folder Fee *</label>
              <select name="payment_method" value={formData.payment_method} onChange={handleChange} style={inputStyle}>
                <option value="Cash">💵 Cash</option>
                <option value="Mobile Money">📱 Mobile Money</option>
                <option value="Card">💳 Card</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '15px', backgroundColor: loading ? '#9ca3af' : '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
            {loading ? 'Processing...' : '✅ Register Patient & Collect GH₵ 20'}
          </button>
        </form>
      </div>

      {/* NEW: REGISTRATION FEE HISTORY TABLE */}
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #16a34a', paddingBottom: '10px' }}>
          <h3 style={{ margin: 0, color: '#333' }}>
            📜 Registration Fee History 
            {userRole === 'admin' ? ' (Admin View: All Staff)' : ' (Your Transactions)'}
          </h3>
          <button onClick={fetchRegHistory} style={{ padding: '8px 15px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
            🔄 Refresh
          </button>
        </div>
        
        {visibleHistory.length === 0 ? (
          <p style={{color: '#666', textAlign: 'center', padding: '20px'}}>No registration fee records found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={thStyle}>Date & Time</th>
                  <th style={thStyle}>Receipt #</th>
                  <th style={thStyle}>Patient Name</th>
                  <th style={thStyle}>Patient ID</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Payment</th>
                  <th style={thStyle}>Processed By</th>
                </tr>
              </thead>
              <tbody>
                {visibleHistory.map((rec) => (
                  <tr key={rec.id}>
                    <td style={tdStyle}>{new Date(rec.created_at).toLocaleString()}</td>
                    <td style={tdStyle}><strong style={{color: '#3b82f6'}}>{rec.receipt_number}</strong></td>
                    <td style={tdStyle}>{rec.patient_name}</td>
                    <td style={tdStyle}>{rec.patient_id || 'Pending'}</td>
                    <td style={tdStyle}><strong style={{color: '#16a34a'}}>GH₵{Number(rec.total_amount).toFixed(2)}</strong></td>
                    <td style={tdStyle}>
                      <span style={{ 
                        backgroundColor: rec.payment_method === 'Cash' ? '#dcfce7' : rec.payment_method === 'Mobile Money' ? '#fef3c7' : '#dbeafe',
                        color: rec.payment_method === 'Cash' ? '#166534' : rec.payment_method === 'Mobile Money' ? '#92400e' : '#1e40af',
                        padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold'
                      }}>
                        {rec.payment_method}
                      </span>
                    </td>
                    <td style={tdStyle}><span style={{ fontSize: '12px', color: '#666' }}>👤 {rec.cashier_name}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}