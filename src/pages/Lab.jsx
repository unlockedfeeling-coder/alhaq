import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

export default function Lab() {
  const [queue, setQueue] = useState([])
  const [selected, setSelected] = useState(null)
  const [patient, setPatient] = useState(null)
  const [orderedTests, setOrderedTests] = useState('')
  const [formData, setFormData] = useState({ test_name: '', result: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { fetchQueue() }, [])

  const fetchQueue = async () => {
    setLoading(true)
    try {
      // Show ALL patients sent to lab (whether paid or not)
      const { data } = await supabase
        .from('consultations')
        .select('*')
        .eq('sent_to_lab', true)
        .eq('lab_completed', false)
        .order('created_at', { ascending: false })
      setQueue(data || [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const handleSelect = async (item) => {
    setSelected(item)
    setMessage('')
    setFormData({ test_name: '', result: '', notes: '' })
    setOrderedTests('')

    const { data } = await supabase.from('patients').select('first_name, last_name').eq('patient_id', item.patient_id).single()
    setPatient(data)

    // Fetch the specific Lab tests ordered
    const { data: services } = await supabase
      .from('consultation_services')
      .select('medical_services(name, category)')
      .eq('consultation_id', item.id)
    
    const labServices = services?.filter(s => s.medical_services.category === 'Lab').map(s => s.medical_services.name)
    if (labServices && labServices.length > 0) {
      setOrderedTests(labServices.join(', '))
    } else {
      setOrderedTests('General Lab Test')
    }
  }

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

  // NEW: Send patient to cashier for payment
  const handleSendToCashier = async () => {
    if (!selected) return
    setLoading(true)
    try {
      await supabase.from('consultations').update({
        sent_to_cashier: true,
        status: 'lab_awaiting_payment'
      }).eq('id', selected.id)

      setMessage('✅ Patient sent to Cashier for payment. Once paid, they can return for testing.')
      setSelected(null)
      setPatient(null)
      fetchQueue()
    } catch (err) { setMessage('❌ Error: ' + err.message) }
    setLoading(false)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!selected) return
    setLoading(true)
    try {
      await supabase.from('lab_results').insert([{ 
        consultation_id: selected.id, 
        patient_id: selected.patient_id, 
        ...formData 
      }])
      
      // Mark lab as complete and send back to doctor
      await supabase.from('consultations').update({ 
        lab_completed: true,
        status: 'lab_done_return_to_doctor'
      }).eq('id', selected.id)

      setMessage('✅ Lab results saved! Results sent back to Doctor.')
      setSelected(null)
      setPatient(null)
      fetchQueue()
    } catch (err) { setMessage('❌ Error: ' + err.message) }
    setLoading(false)
  }

  const inputStyle = { width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '15px' }
  const labelStyle = { display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold', fontSize: '14px' }

  return (
    <div>
      <style>{`
        @media (max-width: 768px) {
          .lab-layout { flex-direction: column !important; }
          .lab-queue, .lab-action { width: '100%' !important; max-height: none !important; }
        }
      `}</style>

      <div className="lab-layout" style={{ display: 'flex', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <div className="lab-queue" style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px', maxHeight: '80vh', overflowY: 'auto' }}>
          <h2 style={{ color: '#333', marginTop: 0, borderBottom: '2px solid #3b82f6', paddingBottom: '10px' }}>🧪 Lab Queue</h2>
          {queue.length === 0 ? <p style={{textAlign: 'center', color: '#666'}}>No patients waiting for lab tests.</p> : 
            queue.map((item) => (
              <div key={item.id} onClick={() => handleSelect(item)} style={{ padding: '15px', marginBottom: '10px', backgroundColor: selected?.id === item.id ? '#eff6ff' : '#f9fafb', border: `1px solid ${selected?.id === item.id ? '#3b82f6' : '#e5e7eb'}`, borderRadius: '8px', cursor: 'pointer' }}>
                <div style={{ fontWeight: 'bold' }}>ID: {item.patient_id}</div>
                <div style={{ fontSize: '12px', marginTop: '5px', color: item.lab_paid ? '#16a34a' : '#f59e0b', fontWeight: 'bold' }}>
                  {item.lab_paid ? '✅ PAID - Ready for Test' : '⏳ Awaiting Payment'}
                </div>
              </div>
            ))
          }
        </div>

        <div className="lab-action" style={{ flex: 1.5 }}>
          {selected ? (
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px' }}>
              <div style={{ backgroundColor: '#eff6ff', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: '#1e40af' }}>{patient ? `${patient.first_name} ${patient.last_name}` : 'Loading...'}</h3>
                <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>ID: {selected.patient_id}</p>
              </div>

              <div style={{ backgroundColor: '#fff7ed', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #fed7aa' }}>
                <h4 style={{ margin: '0 0 5px 0', color: '#c2410c' }}>🩺 Doctor Ordered:</h4>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#9a3412' }}>{orderedTests || 'Loading...'}</p>
              </div>

              {message && (
                <div style={{ backgroundColor: message.includes('✅') ? '#dcfce7' : '#fee2e2', color: message.includes('✅') ? '#166534' : '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
                  {message}
                </div>
              )}

              {/* If NOT paid, show button to send to cashier */}
              {!selected.lab_paid ? (
                <button 
                  onClick={handleSendToCashier} 
                  disabled={loading} 
                  style={{ width: '100%', padding: '15px', backgroundColor: loading ? '#9ca3af' : '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}
                >
                  {loading ? 'Processing...' : '💰 Send Patient to Cashier for Payment'}
                </button>
              ) : (
                /* If PAID, show the test entry form */
                <>
                  <h3 style={{ color: '#333', marginTop: 0 }}>Enter Lab Results</h3>
                  <form onSubmit={handleSave}>
                    <div><label style={labelStyle}>Test Name *</label><input name="test_name" value={formData.test_name} onChange={handleChange} style={inputStyle} required placeholder="e.g. Malaria Test" /></div>
                    <div><label style={labelStyle}>Result / Findings *</label><textarea name="result" value={formData.result} onChange={handleChange} style={{ ...inputStyle, minHeight: '100px' }} required placeholder="e.g. Negative / Positive"></textarea></div>
                    <div><label style={labelStyle}>Notes (Optional)</label><textarea name="notes" value={formData.notes} onChange={handleChange} style={{ ...inputStyle, minHeight: '60px' }}></textarea></div>

                    <button type="submit" disabled={loading} style={{ width: '100%', padding: '15px', backgroundColor: loading ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
                      {loading ? 'Saving...' : '💾 Save Results & Send to Doctor'}
                    </button>
                  </form>
                </>
              )}
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', padding: '50px', borderRadius: '12px', textAlign: 'center', color: '#666' }}>
              <p style={{ fontSize: '18px' }}>👈 Select a patient from the queue.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}