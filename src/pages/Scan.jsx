import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

export default function Scan() {
  const [queue, setQueue] = useState([])
  const [selected, setSelected] = useState(null)
  const [patient, setPatient] = useState(null)
  const [orderedScan, setOrderedScan] = useState('')
  // REMOVED scan_type from formData since we use orderedScan
  const [formData, setFormData] = useState({ body_part: '', findings: '' })
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { fetchQueue() }, [])

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('consultations')
        .select('*')
        .eq('sent_to_radiology', true)
        .eq('radiology_completed', false)
        .order('created_at', { ascending: false })
      setQueue(data || [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const handleSelect = async (item) => {
    setSelected(item)
    setMessage('')
    setFormData({ body_part: '', findings: '' })
    setSelectedFile(null)
    setOrderedScan('')

    const { data } = await supabase.from('patients').select('first_name, last_name').eq('patient_id', item.patient_id).single()
    setPatient(data)

    const { data: services } = await supabase
      .from('consultation_services')
      .select('medical_services(name, category)')
      .eq('consultation_id', item.id)
    
    const scanService = services?.find(s => s.medical_services.category === 'Scan')
    if (scanService) {
      setOrderedScan(scanService.medical_services.name)
    } else {
      setOrderedScan('General Scan')
    }
  }

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })
  const handleFileChange = (e) => { if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]) }

  const handleSendToCashier = async () => {
    if (!selected) return
    setLoading(true)
    try {
      await supabase.from('consultations').update({
        sent_to_cashier: true,
        status: 'scan_awaiting_payment'
      }).eq('id', selected.id)

      setMessage('✅ Patient sent to Cashier for payment. Once paid, they can return for Scan.')
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
    setMessage('')

    let finalImageUrl = null
    if (selectedFile) {
      try {
        const fileExt = selectedFile.name.split('.').pop()
        const fileName = `${selected.id}-${Date.now()}.${fileExt}`
        const { error } = await supabase.storage.from('xray-images').upload(fileName, selectedFile)
        if (!error) {
          const { data } = supabase.storage.from('xray-images').getPublicUrl(fileName)
          finalImageUrl = data.publicUrl
        }
      } catch (err) { console.error("Image upload failed") }
    }

    try {
      await supabase.from('imaging_results').insert([{ 
        consultation_id: selected.id, 
        patient_id: selected.patient_id, 
        imaging_type: orderedScan, // USES THE DOCTOR'S ORDERED SCAN NAME
        body_part: formData.body_part,
        findings: formData.findings,
        image_link: finalImageUrl 
      }])
      
      await supabase.from('consultations').update({ 
        radiology_completed: true,
        status: 'scan_done_return_to_doctor'
      }).eq('id', selected.id)

      setMessage('✅ Scan completed! Results sent back to Doctor.')
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
          .scan-layout { flex-direction: column !important; }
          .scan-queue, .scan-action { width: '100%' !important; max-height: none !important; }
        }
      `}</style>

      <div className="scan-layout" style={{ display: 'flex', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <div className="scan-queue" style={{ flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px', maxHeight: '80vh', overflowY: 'auto' }}>
          <h2 style={{ color: '#333', marginTop: 0, borderBottom: '2px solid #8b5cf6', paddingBottom: '10px' }}>🔬 Scan Queue</h2>
          {queue.length === 0 ? <p style={{textAlign: 'center', color: '#666'}}>No patients waiting for Scan.</p> : 
            queue.map((item) => (
              <div key={item.id} onClick={() => handleSelect(item)} style={{ padding: '15px', marginBottom: '10px', backgroundColor: selected?.id === item.id ? '#f5f3ff' : '#f9fafb', border: `1px solid ${selected?.id === item.id ? '#8b5cf6' : '#e5e7eb'}`, borderRadius: '8px', cursor: 'pointer' }}>
                <div style={{ fontWeight: 'bold' }}>ID: {item.patient_id}</div>
                <div style={{ fontSize: '12px', marginTop: '5px', color: item.radiology_paid ? '#16a34a' : '#f59e0b', fontWeight: 'bold' }}>
                  {item.radiology_paid ? '✅ PAID - Ready for Scan' : '⏳ Awaiting Payment'}
                </div>
              </div>
            ))
          }
        </div>

        <div className="scan-action" style={{ flex: 1.5 }}>
          {selected ? (
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px' }}>
              <div style={{ backgroundColor: '#f5f3ff', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: '#7c3aed' }}>{patient ? `${patient.first_name} ${patient.last_name}` : 'Loading...'}</h3>
                <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>ID: {selected.patient_id}</p>
              </div>

              <div style={{ backgroundColor: '#fff7ed', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #fed7aa' }}>
                <h4 style={{ margin: '0 0 5px 0', color: '#c2410c' }}> Doctor Ordered:</h4>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#9a3412' }}>{orderedScan || 'Loading...'}</p>
              </div>

              {message && (
                <div style={{ backgroundColor: message.includes('✅') ? '#dcfce7' : '#fee2e2', color: message.includes('✅') ? '#166534' : '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
                  {message}
                </div>
              )}

              {!selected.radiology_paid ? (
                <button 
                  onClick={handleSendToCashier} 
                  disabled={loading} 
                  style={{ width: '100%', padding: '15px', backgroundColor: loading ? '#9ca3af' : '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}
                >
                  {loading ? 'Processing...' : '💰 Send Patient to Cashier for Payment'}
                </button>
              ) : (
                <>
                  <h3 style={{ color: '#333', marginTop: 0 }}>Scan Report</h3>
                  <form onSubmit={handleSave}>
                    {/* REMOVED Scan Type Dropdown - We use orderedScan instead */}
                    
                    <div><label style={labelStyle}>Body Part *</label><input name="body_part" value={formData.body_part} onChange={handleChange} style={inputStyle} required placeholder="e.g. Abdomen, Pelvis" /></div>
                    
                    <div><label style={labelStyle}>Findings / Report *</label><textarea name="findings" value={formData.findings} onChange={handleChange} style={{ ...inputStyle, minHeight: '100px' }} required></textarea></div>
                    
                    <div><label style={labelStyle}> Upload Scan Image (Optional)</label><input type="file" accept="image/*" onChange={handleFileChange} style={inputStyle} /></div>

                    <button type="submit" disabled={loading} style={{ width: '100%', padding: '15px', backgroundColor: loading ? '#9ca3af' : '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
                      {loading ? 'Saving...' : '💾 Save Scan & Send to Doctor'}
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