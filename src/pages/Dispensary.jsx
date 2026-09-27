import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

export default function Dispensary() {
  const [queue, setQueue] = useState([])
  const [selected, setSelected] = useState(null)
  const [patient, setPatient] = useState(null)
  const [prescribedItems, setPrescribedItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { fetchQueue() }, [])

  const fetchQueue = async () => {
    setLoading(true)
    try {
      // Fetch all patients sent to dispensary who haven't been discharged yet
      const { data } = await supabase
        .from('consultations')
        .select('*')
        .eq('sent_to_dispensary', true)
        .eq('dispensary_completed', false)
        .order('created_at', { ascending: false })
      setQueue(data || [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const handleSelectPatient = async (consultation) => {
    setSelected(consultation)
    setMessage('')
    setPrescribedItems([])

    const { data: pData } = await supabase.from('patients').select('first_name, last_name').eq('patient_id', consultation.patient_id).single()
    setPatient(pData)

    const { data: items } = await supabase.from('prescription_items').select('*').eq('consultation_id', consultation.id)

    if (items && items.length > 0) {
      const medIds = items.map(item => item.medication_id)
      const { data: meds } = await supabase.from('medications').select('id, name, quantity_in_stock, unit, unit_price').in('id', medIds)

      const combined = items.map(item => {
        const medDetails = meds.find(m => m.id === item.medication_id)
        return { ...item, medications: medDetails }
      })
      setPrescribedItems(combined)
    }
  }

  // NEW: Send Unpaid Patient to Cashier
  const handleSendToCashier = async () => {
    if (!selected) return
    setLoading(true)
    try {
      await supabase.from('consultations').update({
        sent_to_cashier: true,
        status: 'awaiting_dispensary_payment'
      }).eq('id', selected.id)

      setMessage('✅ Patient sent to Cashier! They will return here once payment is confirmed.')
      setSelected(null)
      setPatient(null)
      fetchQueue()
    } catch (err) { setMessage('❌ Error: ' + err.message) }
    setLoading(false)
  }

  // Dispense and Discharge (Only works if paid)
  const handleDispenseAndDischarge = async () => {
    if (!selected) return
    setLoading(true)
    setMessage('')

    try {
      for (const item of prescribedItems) {
        if (item.medications) {
          const newStock = item.medications.quantity_in_stock - item.quantity
          
          await supabase.from('medications').update({ 
            quantity_in_stock: newStock,
            updated_at: new Date()
          }).eq('id', item.medication_id)

          await supabase.from('dispensing_log').insert([{
            consultation_id: selected.id,
            patient_id: selected.patient_id,
            medication_id: item.medication_id,
            medication_name: item.medications.name,
            quantity_dispensed: item.quantity,
            dispensed_by: 'Pharmacist'
          }])
        }
      }

      await supabase.from('consultations').update({ 
        dispensary_completed: true,
        status: 'discharged' 
      }).eq('id', selected.id)

      setMessage('✅ Herbs dispensed successfully! Patient has been officially DISCHARGED and can exit.')
      setSelected(null)
      setPatient(null)
      fetchQueue()
      
    } catch (err) { setMessage('❌ Error: ' + err.message) }
    setLoading(false)
  }

  return (
    <div>
      <style>{`
        @media (max-width: 768px) {
          .dispensary-layout { flex-direction: column !important; }
          .dispensary-queue, .dispensary-action { width: 100% !important; max-height: none !important; }
        }
      `}</style>

      <div className="dispensary-layout" style={{ display: 'flex', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* LEFT: Queue */}
        <div className="dispensary-queue" style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px', maxHeight: '80vh', overflowY: 'auto' }}>
          <h2 style={{ color: '#333', marginTop: 0, borderBottom: '2px solid #10b981', paddingBottom: '10px' }}> Dispensary Queue</h2>
          {queue.length === 0 ? <p style={{textAlign: 'center', color: '#666'}}>No patients waiting for herbs.</p> : 
            queue.map((item) => (
              <div key={item.id} onClick={() => handleSelectPatient(item)} style={{ padding: '15px', marginBottom: '10px', backgroundColor: selected?.id === item.id ? '#f0fdf4' : '#f9fafb', border: `1px solid ${selected?.id === item.id ? '#10b981' : '#e5e7eb'}`, borderRadius: '8px', cursor: 'pointer' }}>
                <div style={{ fontWeight: 'bold' }}>Patient ID: {item.patient_id}</div>
                <div style={{ fontSize: '12px', marginTop: '5px', color: item.dispensary_paid ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                  {item.dispensary_paid ? '✅ PAID AT CASHIER' : '⚠️ UNPAID'}
                </div>
              </div>
            ))
          }
        </div>

        {/* RIGHT: Action Area */}
        <div className="dispensary-action" style={{ flex: 1.5 }}>
          {selected ? (
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px' }}>
              <div style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #bbf7d0' }}>
                <h3 style={{ margin: 0, color: '#166534' }}>{patient ? `${patient.first_name} ${patient.last_name}` : 'Loading...'}</h3>
                <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#15803d' }}>ID: {selected.patient_id}</p>
              </div>

              {prescribedItems.length > 0 ? (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#333', marginTop: 0 }}>🌿 Prescribed Herbs to Dispense:</h4>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                    {prescribedItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', borderBottom: idx < prescribedItems.length - 1 ? '1px solid #e5e7eb' : 'none', backgroundColor: '#f9fafb' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{item.medications?.name || 'Unknown'}</div>
                          <div style={{ fontSize: '13px', color: '#666' }}>Current Stock: {item.medications?.quantity_in_stock} {item.medications?.unit}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>Give: {item.quantity} {item.medications?.unit}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ backgroundColor: '#fff7ed', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ffedd5', color: '#c2410c' }}>
                  No specific inventory medications selected. Check Doctor's custom notes below.
                </div>
              )}

              {selected.prescription && (
                <div style={{ backgroundColor: '#fff7ed', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ffedd5' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#c2410c' }}>📝 Doctor's Custom Instructions:</h4>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{selected.prescription}</p>
                </div>
              )}

              {message && <div style={{ backgroundColor: message.includes('✅') ? '#dcfce7' : '#fee2e2', color: message.includes('✅') ? '#166534' : '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>{message}</div>}

              {/* SMART BUTTONS BASED ON PAYMENT STATUS */}
              {!selected.dispensary_paid ? (
                <div style={{ border: '2px dashed #f59e0b', padding: '20px', borderRadius: '8px', backgroundColor: '#fffbeb', textAlign: 'center' }}>
                  <h3 style={{ color: '#b45309', marginTop: 0 }}>⚠️ Payment Required</h3>
                  <p style={{ marginBottom: '15px' }}>This patient has not paid for these herbs yet. You cannot discharge them until payment is confirmed.</p>
                  <button 
                    onClick={handleSendToCashier} 
                    disabled={loading} 
                    style={{ width: '100%', padding: '15px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {loading ? 'Sending...' : '💰 Send Patient to Cashier for Payment'}
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleDispenseAndDischarge} 
                  disabled={loading || prescribedItems.length === 0} 
                  style={{ 
                    width: '100%', 
                    padding: '15px', 
                    backgroundColor: (loading || prescribedItems.length === 0) ? '#9ca3af' : '#16a34a', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontSize: '16px', 
                    fontWeight: 'bold', 
                    cursor: 'pointer' 
                  }}
                >
                  {loading ? 'Processing...' : '✅ Dispense Herbs & DISCHARGE PATIENT'}
                </button>
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