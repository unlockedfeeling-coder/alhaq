import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

export default function Cashier() {
  const [queue, setQueue] = useState([])
  const [selected, setSelected] = useState(null)
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  
  const [history, setHistory] = useState([])
  const [cashierName, setCashierName] = useState('Loading...')
  
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState(null)

  useEffect(() => { 
    fetchQueue()
    fetchHistory()
    fetchCashierName()
  }, [])

  const fetchCashierName = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single()
      setCashierName(profile?.full_name || user.email)
    }
  }

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('consultations').select('*').eq('sent_to_cashier', true).eq('cashier_completed', false).order('created_at', { ascending: false })
      setQueue(data || [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const fetchHistory = async () => {
    const { data } = await supabase.from('receipts').select('*').order('created_at', { ascending: false }).limit(100)
    setHistory(data || [])
  }

  const handleSelectPatient = async (consultation) => {
    setSelected(consultation)
    setMessage('')
    const { data } = await supabase.from('patients').select('first_name, last_name').eq('patient_id', consultation.patient_id).single()
    setPatient(data)
  }

  const handleConfirmPayment = async (method) => {
    if (!selected) return
    setLoading(true)
    setMessage('')

    try {
      const receiptNum = `REC-${Date.now().toString().slice(-6)}`
      const total = Number(selected.total_amount) || 0;

      const { data: receiptRow, error: receiptError } = await supabase.from('receipts').insert([{
        receipt_number: receiptNum, 
        consultation_id: selected.id, 
        patient_id: selected.patient_id,
        patient_name: patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown',
        lab_fee: selected.lab_fee || 0, 
        radiology_fee: selected.radiology_fee || 0, 
        dispensary_fee: selected.dispensary_fee || 0,
        total_amount: total, 
        payment_method: method, 
        cashier_name: cashierName
      }]).select().single()

      if (receiptError) throw receiptError

      let updates = { cashier_completed: true, payment_method: method, total_amount: total, status: 'paid' }
      if (selected.lab_fee > 0) updates.lab_paid = true
      if (selected.radiology_fee > 0) updates.radiology_paid = true
      if (selected.dispensary_fee > 0) updates.dispensary_paid = true

      await supabase.from('consultations').update(updates).eq('id', selected.id)

      setReceiptData({ ...receiptRow, patient_id: selected.patient_id })
      setShowReceipt(true)
      
      setSelected(null); setPatient(null); fetchQueue(); fetchHistory() 
    } catch (err) { setMessage('❌ Error: ' + err.message) }
    setLoading(false)
  }

  const handlePrint = () => { window.print() }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-receipt, #printable-receipt * { visibility: visible; }
          #printable-receipt { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
        @media (max-width: 768px) {
          .cashier-layout { flex-direction: column !important; }
          .cashier-queue, .cashier-action { width: 100% !important; max-height: none !important; }
          .history-table { display: block; overflow-x: auto; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#333', margin: 0 }}>💰 Cashier Desk</h2>
        <div style={{ backgroundColor: '#eff6ff', padding: '8px 15px', borderRadius: '20px', fontSize: '14px', color: '#1e40af', fontWeight: 'bold' }}>👤 {cashierName}</div>
      </div>

      {/* REGISTRATION FEES SECTION */}
      <div className="no-print" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: '2px solid #f59e0b' }}>
        <h3 style={{ color: '#b45309', marginTop: 0, borderBottom: '2px solid #f59e0b', paddingBottom: '10px' }}>📁 Pending Registration Fees (GH₵ 20)</h3>
        <RegistrationFees onPaymentComplete={fetchQueue} onShowReceipt={(data) => { setReceiptData(data); setShowReceipt(true); }} />
      </div>

      <div className="no-print cashier-layout" style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        <div className="cashier-queue" style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#333', marginTop: 0, borderBottom: '2px solid #f59e0b', paddingBottom: '10px' }}>Pending Service Payments</h3>
          {queue.length === 0 ? <p style={{textAlign: 'center', color: '#666'}}>No patients waiting.</p> : 
            queue.map((item) => (
              <div key={item.id} onClick={() => handleSelectPatient(item)} style={{ padding: '15px', marginBottom: '10px', backgroundColor: selected?.id === item.id ? '#fffbeb' : '#f9fafb', border: `1px solid ${selected?.id === item.id ? '#f59e0b' : '#e5e7eb'}`, borderRadius: '8px', cursor: 'pointer' }}>
                <div style={{ fontWeight: 'bold' }}>ID: {item.patient_id}</div>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>
                  Due: <span style={{color: '#dc2626', fontWeight: 'bold'}}>GH₵{Number(item.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>
            ))
          }
        </div>

        <div className="cashier-action" style={{ flex: 1.5 }}>
          {selected ? (
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ backgroundColor: '#fffbeb', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: '#92400e' }}>{patient ? `${patient.first_name} ${patient.last_name}` : 'Loading...'}</h3>
                <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#a16207' }}>ID: {selected.patient_id}</p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#333', marginBottom: '15px' }}>🧾 Bill Summary (Auto-Calculated):</h4>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee' }}>
                  <span style={{ fontWeight: 'bold' }}> Lab Fees:</span>
                  <span style={{ fontSize: '16px' }}>GH₵{Number(selected.lab_fee || 0).toFixed(2)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee' }}>
                  <span style={{ fontWeight: 'bold' }}> X-Ray / Scan Fees:</span>
                  <span style={{ fontSize: '16px' }}>GH₵{Number(selected.radiology_fee || 0).toFixed(2)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee' }}>
                  <span style={{ fontWeight: 'bold' }}>🌿 Dispensary / Herbs:</span>
                  <span style={{ fontSize: '16px' }}>GH₵{Number(selected.dispensary_fee || 0).toFixed(2)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 0', fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>
                  <span>TOTAL TO COLLECT:</span>
                  <span>GH₵{Number(selected.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>

              {message && <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>{message}</div>}

              <h4 style={{ color: '#333', marginBottom: '10px' }}>Select Payment Method:</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <button onClick={() => handleConfirmPayment('Cash')} disabled={loading} style={{ padding: '15px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>💵 Cash</button>
                <button onClick={() => handleConfirmPayment('Mobile Money')} disabled={loading} style={{ padding: '15px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>📱 Mobile Money</button>
                <button onClick={() => handleConfirmPayment('Card')} disabled={loading} style={{ padding: '15px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>💳 Card</button>
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', padding: '50px', borderRadius: '12px', textAlign: 'center', color: '#666', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <p style={{ fontSize: '18px' }}>👈 Select a patient from the queue.</p>
            </div>
          )}
        </div>
      </div>

      {/* NEW: TRANSACTION HISTORY SECTION */}
      <div className="no-print" style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }}>
          <h3 style={{ color: '#333', margin: 0 }}>📜 Transaction History</h3>
          <button onClick={fetchHistory} style={{ padding: '8px 15px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
            🔄 Refresh
          </button>
        </div>
        
        {history.length === 0 ? (
          <p style={{textAlign: 'center', color: '#666', padding: '20px'}}>No transactions yet.</p>
        ) : (
          <div className="history-table" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', textAlign: 'left' }}>
                  <th style={thStyle}>Receipt #</th>
                  <th style={thStyle}>Date & Time</th>
                  <th style={thStyle}>Patient ID</th>
                  <th style={thStyle}>Patient Name</th>
                  <th style={thStyle}>Services</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Payment</th>
                  <th style={thStyle}>Cashier</th>
                </tr>
              </thead>
              <tbody>
                {history.map((rec) => (
                  <tr key={rec.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={tdStyle}><strong style={{color: '#3b82f6'}}>{rec.receipt_number}</strong></td>
                    <td style={tdStyle}>{new Date(rec.created_at).toLocaleString()}</td>
                    <td style={tdStyle}>{rec.patient_id || 'N/A'}</td>
                    <td style={tdStyle}>{rec.patient_name}</td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: '12px' }}>
                        {rec.lab_fee > 0 && <div>🧪 Lab: GH₵{Number(rec.lab_fee).toFixed(2)}</div>}
                        {rec.radiology_fee > 0 && <div>🩻 X-Ray/Scan: GH₵{Number(rec.radiology_fee).toFixed(2)}</div>}
                        {rec.dispensary_fee > 0 && <div>🌿 Herbs: GH₵{Number(rec.dispensary_fee).toFixed(2)}</div>}
                        {rec.description && <div>📁 {rec.description}</div>}
                      </div>
                    </td>
                    <td style={tdStyle}><strong style={{color: '#16a34a', fontSize: '15px'}}>GH{Number(rec.total_amount).toFixed(2)}</strong></td>
                    <td style={tdStyle}>
                      <span style={{ 
                        backgroundColor: rec.payment_method === 'Cash' ? '#dcfce7' : rec.payment_method === 'Mobile Money' ? '#fef3c7' : '#dbeafe',
                        color: rec.payment_method === 'Cash' ? '#166534' : rec.payment_method === 'Mobile Money' ? '#92400e' : '#1e40af',
                        padding: '4px 10px', 
                        borderRadius: '12px', 
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {rec.payment_method}
                      </span>
                    </td>
                    <td style={tdStyle}><span style={{ fontSize: '12px', color: '#666' }}>👤 {rec.cashier_name || 'Unknown'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECEIPT MODAL */}
      {showReceipt && receiptData && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div id="printable-receipt" style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', maxWidth: '400px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px dashed #ccc', paddingBottom: '15px', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, color: '#16a34a' }}>🌿 Al-Haq Herbal Centre</h2>
              <p style={{ margin: '5px 0', fontSize: '12px', color: '#666' }}>Official Payment Receipt</p>
            </div>
            <div style={{ fontSize: '14px', marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><strong>Receipt #:</strong> <span>{receiptData.receipt_number}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><strong>Date:</strong> <span>{new Date(receiptData.created_at).toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><strong>Patient ID:</strong> <span>{receiptData.patient_id || 'Registration'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><strong>Patient Name:</strong> <span>{receiptData.patient_name}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Cashier:</strong> <span>{receiptData.cashier_name}</span></div>
            </div>
            <div style={{ borderTop: '1px solid #eee', paddingTop: '10px', marginBottom: '15px' }}>
              {receiptData.description ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px' }}><span>{receiptData.description}</span><span>GH₵{Number(receiptData.total_amount).toFixed(2)}</span></div>
              ) : (
                <>
                  {receiptData.lab_fee > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px' }}><span>Lab Fees</span><span>GH{Number(receiptData.lab_fee).toFixed(2)}</span></div>}
                  {receiptData.radiology_fee > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px' }}><span>X-Ray / Scan</span><span>GH₵{Number(receiptData.radiology_fee).toFixed(2)}</span></div>}
                  {receiptData.dispensary_fee > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px' }}><span>Dispensary</span><span>GH₵{Number(receiptData.dispensary_fee).toFixed(2)}</span></div>}
                </>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', borderTop: '2px solid #333', paddingTop: '10px', marginBottom: '15px' }}>
              <span>TOTAL PAID</span><span style={{ color: '#16a34a' }}>GH₵{Number(receiptData.total_amount).toFixed(2)}</span>
            </div>
            <div style={{ textAlign: 'center', fontSize: '12px', color: '#666', borderTop: '2px dashed #ccc', paddingTop: '10px' }}>
              <p style={{ margin: 0 }}>Payment Method: <strong>{receiptData.payment_method}</strong></p>
              <p style={{ margin: '10px 0 0 0' }}>Thank you for choosing Al-Haq! 🌿</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }} className="no-print">
              <button onClick={handlePrint} style={{ flex: 1, padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ Print Receipt</button>
              <button onClick={() => setShowReceipt(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#e5e7eb', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle = { padding: '12px', color: '#666', fontWeight: 'bold', borderBottom: '2px solid #e5e7eb' }
const tdStyle = { padding: '12px', color: '#333' }

// Registration Fees Component
function RegistrationFees({ onPaymentComplete, onShowReceipt }) {
  const [pending, setPending] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchPending = async () => {
      const { data } = await supabase.from('patients').select('*').eq('registration_paid', false).order('created_at', { ascending: false })
      setPending(data || [])
    }
    fetchPending()
  }, [])

  const handleCollectFee = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const receiptNum = `REG-${Date.now().toString().slice(-6)}`
      await supabase.from('receipts').insert([{
        receipt_number: receiptNum, patient_id: selected.temp_reference || 'Registration',
        patient_name: `${selected.first_name} ${selected.last_name}`, total_amount: 20,
        payment_method: 'Cash', cashier_name: 'Cashier', description: 'Patient Registration / Folder Fee'
      }])
      await supabase.from('patients').update({ registration_paid: true }).eq('id', selected.id)

      if (onShowReceipt) {
        onShowReceipt({ receipt_number: receiptNum, patient_name: `${selected.first_name} ${selected.last_name}`, total_amount: 20, payment_method: 'Cash', cashier_name: 'Cashier', description: 'Patient Registration / Folder Fee', created_at: new Date().toISOString() })
      }
      setSelected(null)
      const { data } = await supabase.from('patients').select('*').eq('registration_paid', false)
      setPending(data || [])
      if (onPaymentComplete) onPaymentComplete()
    } catch (err) { alert('❌ Error: ' + err.message) }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      <div style={{ flex: 1, maxHeight: '300px', overflowY: 'auto' }}>
        {pending.length === 0 ? <p style={{color: '#666'}}>No pending registration fees.</p> : 
          pending.map((p) => (
            <div key={p.id} onClick={() => setSelected(p)} style={{ padding: '12px', marginBottom: '8px', backgroundColor: selected?.id === p.id ? '#fffbeb' : '#f9fafb', border: `1px solid ${selected?.id === p.id ? '#f59e0b' : '#e5e7eb'}`, borderRadius: '6px', cursor: 'pointer' }}>
              <div style={{ fontWeight: 'bold' }}>{p.first_name} {p.last_name}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Ref: {p.temp_reference}</div>
            </div>
          ))
        }
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: '8px', padding: '20px' }}>
        {selected ? (
          <>
            <h4 style={{ margin: '0 0 10px 0' }}>{selected.first_name} {selected.last_name}</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#b45309', margin: '0 0 20px 0' }}>GH₵ 20.00</p>
            <button onClick={handleCollectFee} disabled={loading} style={{ padding: '12px 25px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              {loading ? 'Processing...' : '✅ Collect GH 20 & Print Receipt'}
            </button>
          </>
        ) : (
          <p style={{ color: '#666', textAlign: 'center' }}>Select a patient to collect the folder fee.</p>
        )}
      </div>
    </div>
  )
}