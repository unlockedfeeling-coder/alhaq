import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

export default function Lab() {
  const [queue, setQueue] = useState([])
  const [pendingWalkIns, setPendingWalkIns] = useState([]) 
  const [searchQueue, setSearchQueue] = useState('')
  const [selected, setSelected] = useState(null)
  const [patient, setPatient] = useState(null)
  const [orderedTests, setOrderedTests] = useState('')
  const [formData, setFormData] = useState({ test_name: '', result: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [showWalkInModal, setShowWalkInModal] = useState(false)
  const [labServices, setLabServices] = useState([])
  const [walkInForm, setWalkInForm] = useState({ first_name: '', last_name: '', phone: '', service_id: '', price: 0 })

  useEffect(() => { fetchQueue(); fetchPendingWalkIns(); fetchLabServices(); }, [])

  const fetchLabServices = async () => {
    const { data } = await supabase.from('medical_services').select('*').eq('category', 'Lab').eq('is_active', true).order('name')
    setLabServices(data || [])
  }

  // ✅ MAIN QUEUE: ONLY shows patients who have ALREADY PAID
  const fetchQueue = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('consultations')
        .select('*')
        .eq('sent_to_lab', true)
        .eq('lab_completed', false)
        .eq('lab_paid', true) // MUST BE PAID TO BE HERE
        .order('created_at', { ascending: false })
      
      const queueWithTests = await Promise.all((data || []).map(async (item) => {
        const { data: services } = await supabase.from('consultation_services').select('medical_services(name, category)').eq('consultation_id', item.id)
        const labServicesList = services?.filter(s => s.medical_services.category === 'Lab').map(s => s.medical_services.name)
        const testName = labServicesList && labServicesList.length > 0 ? labServicesList.join(', ') : 'General Lab Test'
        return { ...item, test_name: testName }
      }))
      setQueue(queueWithTests)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  // ✅ PENDING LIST: Shows walk-ins registered here but NOT YET PAID
  const fetchPendingWalkIns = async () => {
    const { data } = await supabase
      .from('consultations')
      .select('*')
      .eq('sent_to_lab', true)
      .eq('lab_completed', false)
      .eq('lab_paid', false) // NOT PAID YET
      .ilike('prescription', '%Walk-in%') // STRICTLY LAB WALK-INS
      .order('created_at', { ascending: false })
    setPendingWalkIns(data || [])
  }

  const handleSelect = async (item) => {
    setSelected(item); setMessage(''); setFormData({ test_name: '', result: '', notes: '' }); setOrderedTests(item.test_name || '')
    try {
      const { data, error } = await supabase.from('patients').select('first_name, last_name').eq('patient_id', item.patient_id.trim().toUpperCase()).limit(1)
      if (error) throw error
      if (!data || data.length === 0) { setMessage('❌ Patient details not found.'); setPatient(null); return }
      setPatient(data[0])
    } catch (err) { setPatient(null) }
  }

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })
  const handleWalkInChange = (e) => {
    const { name, value } = e.target
    setWalkInForm(prev => {
      const updated = { ...prev, [name]: value }
      if (name === 'service_id') { const service = labServices.find(s => s.id === value); updated.price = service ? service.price : 0 }
      return updated
    })
  }

  const handleSendToCashier = async () => {
    if (!selected) return; setLoading(true)
    try {
      await supabase.from('consultations').update({ sent_to_cashier: true, status: 'lab_awaiting_payment' }).eq('id', selected.id)
      setMessage('✅ Patient sent to Cashier.'); setSelected(null); setPatient(null); fetchQueue()
    } catch (err) { setMessage('❌ Error: ' + err.message) }
    setLoading(false)
  }

  const handleSave = async (e) => {
    e.preventDefault(); if (!selected) return; setLoading(true)
    try {
      await supabase.from('lab_results').insert([{ consultation_id: selected.id, patient_id: selected.patient_id, ...formData }])
      await supabase.from('consultations').update({ lab_completed: true, status: 'lab_done_return_to_doctor' }).eq('id', selected.id)
      setMessage('✅ Lab results saved!'); setSelected(null); setPatient(null); fetchQueue()
    } catch (err) { setMessage('❌ Error: ' + err.message) }
    setLoading(false)
  }

  const handleWalkInSubmit = async (e) => {
    e.preventDefault(); if (!walkInForm.service_id) return; setLoading(true); setMessage('')
    try {
      const uniqueId = Date.now().toString().slice(-5); const newPatientId = `WK-2026-${uniqueId}`
      await supabase.from('patients').insert([{ patient_id: newPatientId, first_name: walkInForm.first_name, last_name: walkInForm.last_name, phone: walkInForm.phone, registration_paid: true, registered_at: new Date().toISOString() }])
      
      // ✅ Register walk-in: sent to Lab AND Cashier, but lab_paid is FALSE (so it goes to Pending)
      const { data: consultData } = await supabase.from('consultations').insert([{ 
        patient_id: newPatientId, 
        prescription: `Walk-in / External Referral for Lab Services`, 
        lab_fee: walkInForm.price, 
        total_amount: walkInForm.price, 
        status: 'walk_in_pending_payment', 
        sent_to_lab: true, 
        sent_to_cashier: true,
        lab_paid: false
      }]).select().single()
      
      await supabase.from('consultation_services').insert([{ consultation_id: consultData.id, service_id: walkInForm.service_id, price_at_time: walkInForm.price }])
      
      setMessage(`✅ ${walkInForm.first_name} registered! Appearing in Pending list until Cashier payment.`)
      setShowWalkInModal(false); setWalkInForm({ first_name: '', last_name: '', phone: '', service_id: '', price: 0 })
      fetchPendingWalkIns() // Refresh pending list immediately
    } catch (err) { setMessage('❌ Error: ' + err.message) }
    setLoading(false)
  }

  const filteredQueue = queue.filter(item => item.patient_id.toLowerCase().includes(searchQueue.toLowerCase()) || item.test_name.toLowerCase().includes(searchQueue.toLowerCase()))
  const inputStyle = { width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '15px' }
  const labelStyle = { display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold', fontSize: '14px' }
  const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }
  const modalContent = { backgroundColor: 'white', padding: '30px', borderRadius: '12px', maxWidth: '500px', width: '90%' }

  return (
    <div>
      <style>{`@media (max-width: 768px) { .lab-layout { flex-direction: column !important; } .lab-queue, .lab-action { width: '100%' !important; } }`}</style>
      <div className="lab-layout" style={{ display: 'flex', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <div className="lab-queue" style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px', maxHeight: '80vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #3b82f6', paddingBottom: '10px', marginBottom: '15px' }}>
            <h2 style={{ color: '#333', margin: 0 }}>🧪 Lab Queue</h2>
            <button onClick={() => setShowWalkInModal(true)} style={{ padding: '8px 15px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>➕ Walk-in</button>
          </div>
          
          {/* PENDING WALK-INS SECTION */}
          {pendingWalkIns.length > 0 && (
            <div style={{ marginBottom: '20px', backgroundColor: '#fffbeb', padding: '15px', borderRadius: '8px', border: '1px solid #fde68a' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#92400e', fontSize: '14px' }}>⏳ Pending Walk-ins (Waiting for Cashier Payment)</h4>
              {pendingWalkIns.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #fcd34d' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.patient_id}</div>
                    <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 'bold' }}>Due: GH₵ {Number(item.total_amount || item.lab_fee || 0).toFixed(2)}</div>
                  </div>
                  <span style={{ padding: '6px 12px', backgroundColor: '#f59e0b', color: 'white', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>Awaiting Payment</span>
                </div>
              ))}
            </div>
          )}

          <input type="text" placeholder="🔍 Search Patient ID..." value={searchQueue} onChange={(e) => setSearchQueue(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '6px', marginBottom: '15px', boxSizing: 'border-box' }} />
          
          {filteredQueue.length === 0 ? <p style={{textAlign: 'center', color: '#666'}}>No patients ready for testing.</p> : filteredQueue.map((item) => (
            <div key={item.id} onClick={() => handleSelect(item)} style={{ padding: '15px', marginBottom: '10px', backgroundColor: selected?.id === item.id ? '#eff6ff' : '#f9fafb', border: `1px solid ${selected?.id === item.id ? '#3b82f6' : '#e5e7eb'}`, borderRadius: '8px', cursor: 'pointer' }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>ID: {item.patient_id}</div>
              <div style={{ fontSize: '13px', color: '#dc2626', fontWeight: '600', marginTop: '4px' }}>🧪 {item.test_name}</div>
              <div style={{ fontSize: '12px', marginTop: '8px', color: '#16a34a', fontWeight: 'bold' }}>✅ PAID - Ready for Test</div>
            </div>
          ))}
        </div>

        <div className="lab-action" style={{ flex: 1.5 }}>
          {selected ? (
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px' }}>
              <div style={{ backgroundColor: '#eff6ff', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: '#1e40af' }}>{patient ? `${patient.first_name} ${patient.last_name}` : 'Loading...'}</h3>
                <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>ID: {selected.patient_id}</p>
              </div>
              {message && <div style={{ backgroundColor: message.includes('✅') ? '#dcfce7' : '#fee2e2', color: message.includes('✅') ? '#166534' : '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>{message}</div>}
              <h3 style={{ color: '#333', marginTop: 0 }}>Enter Lab Results</h3>
              <form onSubmit={handleSave}>
                <div><label style={labelStyle}>Test Name *</label><input name="test_name" value={formData.test_name} onChange={handleChange} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Result / Findings *</label><textarea name="result" value={formData.result} onChange={handleChange} style={{ ...inputStyle, minHeight: '100px' }} required></textarea></div>
                <button type="submit" disabled={loading} style={{ width: '100%', padding: '15px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>💾 Save Results</button>
              </form>
            </div>
          ) : <div style={{ backgroundColor: 'white', padding: '50px', borderRadius: '12px', textAlign: 'center', color: '#666' }}><p>👈 Select a patient from the main queue.</p></div>}
        </div>
      </div>

      {showWalkInModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h2 style={{ color: '#8b5cf6', marginTop: 0, textAlign: 'center' }}>🚶 Register Walk-in</h2>
            <form onSubmit={handleWalkInSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div><label style={labelStyle}>First Name *</label><input name="first_name" value={walkInForm.first_name} onChange={handleWalkInChange} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Last Name *</label><input name="last_name" value={walkInForm.last_name} onChange={handleWalkInChange} style={inputStyle} required /></div>
              </div>
              <div><label style={labelStyle}>Phone Number</label><input name="phone" value={walkInForm.phone} onChange={handleWalkInChange} style={inputStyle} /></div>
              <div><label style={labelStyle}>Select Lab Test *</label>
                <select name="service_id" value={walkInForm.service_id} onChange={handleWalkInChange} style={inputStyle} required>
                  <option value="">-- Choose a test --</option>
                  {labServices.map(s => (<option key={s.id} value={s.id}>{s.name} (GH₵ {s.price})</option>))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '12px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>✅ Register & Send to Cashier</button>
                <button type="button" onClick={() => setShowWalkInModal(false)} style={{ padding: '12px 20px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}