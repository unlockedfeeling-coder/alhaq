import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

export default function Dispensary() {
  const [queue, setQueue] = useState([])
  const [searchQueue, setSearchQueue] = useState('') // Search state
  const [selected, setSelected] = useState(null)
  const [patient, setPatient] = useState(null)
  const [prescriptionItems, setPrescriptionItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { fetchQueue() }, [])

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('consultations')
        .select('*')
        .eq('sent_to_dispensary', true)
        .eq('dispensary_completed', false)
        .order('created_at', { ascending: false })
      
      setQueue(data || [])
    } catch (err) { console.error("Error fetching dispensary queue:", err) }
    setLoading(false)
  }

  const handleSelect = async (item) => {
    setSelected(item)
    setMessage('')
    setPrescriptionItems([])
    setPatient(null)

    try {
      // 1. Fetch Patient Details (Bulletproof)
      const { data: patientData, error: pError } = await supabase
        .from('patients')
        .select('first_name, last_name')
        .eq('patient_id', item.patient_id.trim().toUpperCase())
        .limit(1)

      if (pError) throw pError
      if (patientData && patientData.length > 0) setPatient(patientData[0])

      // 2. Fetch Prescription Items with Medication Details
      const { data: items, error: iError } = await supabase
        .from('prescription_items')
        .select('*, medications(name, quantity_in_stock, unit, drug_type)')
        .eq('consultation_id', item.id)

      if (iError) throw iError
      setPrescriptionItems(items || [])

    } catch (err) { 
      console.error('Error loading prescription:', err)
      setMessage('❌ Error loading prescription details.') 
    }
  }

  const handleDispense = async () => {
    if (!selected || prescriptionItems.length === 0) return
    setLoading(true)
    setMessage('')

    try {
      let stockWarnings = []

      // 1. Deduct Stock for Each Medication
      for (const item of prescriptionItems) {
        const med = item.medications
        const requiredQty = item.quantity
        const currentStock = med ? med.quantity_in_stock : 0

        if (currentStock < requiredQty) {
          stockWarnings.push(`${med.name} (Need ${requiredQty}, have ${currentStock})`)
        }

        // Update the inventory (even if low, we dispense what we can and warn)
        if (med) {
          const newStock = Math.max(0, currentStock - requiredQty)
          const { error: updateError } = await supabase
            .from('medications')
            .update({ quantity_in_stock: newStock, updated_at: new Date() })
            .eq('id', med.id)
          
          if (updateError) throw updateError
        }
      }

      // 2. Mark Dispensary as Complete & Send to Cashier
      const { error: consultError } = await supabase
        .from('consultations')
        .update({ 
          dispensary_completed: true, 
          sent_to_cashier: true, // Route to cashier to pay for the meds
          status: 'dispensary_done_awaiting_payment'
        })
        .eq('id', selected.id)

      if (consultError) throw consultError

      if (stockWarnings.length > 0) {
        setMessage(`⚠️ Dispensed, but LOW STOCK WARNING:\n${stockWarnings.join('\n')}`)
      } else {
        setMessage('✅ Medications dispensed successfully! Inventory updated. Patient sent to Cashier.')
      }

      // Reset and refresh
      setSelected(null)
      setPatient(null)
      setPrescriptionItems([])
      fetchQueue()

    } catch (err) { 
      setMessage('❌ Error dispensing: ' + err.message) 
    }
    setLoading(false)
  }

  // Filter logic for search
  const filteredQueue = queue.filter(item => 
    item.patient_id.toLowerCase().includes(searchQueue.toLowerCase())
  )

  const inputStyle = { width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '15px' }
  const labelStyle = { display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold', fontSize: '14px' }

  return (
    <div>
      <style>{`
        @media (max-width: 768px) {
          .dispensary-layout { flex-direction: column !important; }
          .dispensary-queue, .dispensary-action { width: '100%' !important; max-height: none !important; }
        }
      `}</style>

      <div className="dispensary-layout" style={{ display: 'flex', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* LEFT: QUEUE */}
        <div className="dispensary-queue" style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px', maxHeight: '80vh', overflowY: 'auto' }}>
          <h2 style={{ color: '#333', marginTop: 0, borderBottom: '2px solid #10b981', paddingBottom: '10px' }}>🌿/💊 Dispensary Queue</h2>
          
          {/* Search Bar */}
          <input 
            type="text" 
            placeholder="🔍 Search Patient ID..." 
            value={searchQueue}
            onChange={(e) => setSearchQueue(e.target.value)}
            style={{ width: '100%', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '6px', marginBottom: '15px', fontSize: '14px', boxSizing: 'border-box' }}
          />

          {filteredQueue.length === 0 ? (
            searchQueue ? 
              <p style={{textAlign: 'center', color: '#666'}}>No patients found matching "{searchQueue}"</p> : 
              <p style={{textAlign: 'center', color: '#666'}}>No patients waiting for medications.</p>
          ) : (
            filteredQueue.map((item) => (
              <div key={item.id} onClick={() => handleSelect(item)} style={{ padding: '15px', marginBottom: '10px', backgroundColor: selected?.id === item.id ? '#ecfdf5' : '#f9fafb', border: `1px solid ${selected?.id === item.id ? '#10b981' : '#e5e7eb'}`, borderRadius: '8px', cursor: 'pointer' }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>ID: {item.patient_id}</div>
                <div style={{ fontSize: '12px', marginTop: '8px', color: item.dispensary_paid ? '#16a34a' : '#f59e0b', fontWeight: 'bold' }}>
                  {item.dispensary_paid ? '✅ PAID - Ready to Dispense' : '⏳ Awaiting Payment'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* RIGHT: ACTION AREA */}
        <div className="dispensary-action" style={{ flex: 1.5 }}>
          {selected ? (
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ backgroundColor: '#ecfdf5', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #a7f3d0' }}>
                <h3 style={{ margin: 0, color: '#065f46' }}>{patient ? `${patient.first_name} ${patient.last_name}` : 'Loading...'}</h3>
                <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#047857' }}>ID: {selected.patient_id}</p>
              </div>

              <h4 style={{ color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>📋 Doctor's Prescription:</h4>
              
              {prescriptionItems.length === 0 ? (
                <p style={{ color: '#666', fontStyle: 'italic' }}>No specific medications listed in this consultation.</p>
              ) : (
                <div style={{ marginBottom: '20px' }}>
                  {prescriptionItems.map((item, idx) => {
                    const med = item.medications
                    const isLowStock = med && med.quantity_in_stock < item.quantity
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', marginBottom: '8px', backgroundColor: isLowStock ? '#fee2e2' : '#f0fdf4', border: `1px solid ${isLowStock ? '#fca5a5' : '#86efac'}`, borderRadius: '6px' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#333' }}>
                            {med?.drug_type === 'Chemical' ? '💊' : '🌿'} {med?.name || 'Unknown Med'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            Current Stock: {med?.quantity_in_stock || 0} {med?.unit || 'units'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 'bold', color: '#16a34a', fontSize: '16px' }}>Qty: {item.quantity}</div>
                          {isLowStock && <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 'bold' }}>⚠️ LOW STOCK</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {message && (
                <div style={{ 
                  backgroundColor: message.includes('✅') ? '#dcfce7' : message.includes('⚠️') ? '#fef3c7' : '#fee2e2', 
                  color: message.includes('✅') ? '#166534' : message.includes('⚠️') ? '#92400e' : '#991b1b', 
                  padding: '12px', borderRadius: '8px', marginBottom: '20px', whiteSpace: 'pre-line', fontWeight: 'bold' 
                }}>
                  {message}
                </div>
              )}

              {!selected.dispensary_paid ? (
                <div style={{ backgroundColor: '#fffbeb', padding: '15px', borderRadius: '8px', textAlign: 'center', border: '1px solid #fde68a' }}>
                  <p style={{ margin: '0 0 10px 0', color: '#92400e', fontWeight: 'bold' }}>⚠️ Patient must pay at Cashier first.</p>
                  <button disabled style={{ width: '100%', padding: '15px', backgroundColor: '#9ca3af', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'not-allowed' }}>
                    Awaiting Payment
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleDispense} 
                  disabled={loading || prescriptionItems.length === 0} 
                  style={{ width: '100%', padding: '15px', backgroundColor: loading ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {loading ? 'Updating Inventory...' : '✅ Dispense Medications & Update Stock'}
                </button>
              )}
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', padding: '50px', borderRadius: '12px', textAlign: 'center', color: '#666', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <p style={{ fontSize: '18px' }}>👈 Select a patient from the queue to view prescription.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}