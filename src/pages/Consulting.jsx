import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

export default function Consulting() {
  const [searchId, setSearchId] = useState('')
  const [patient, setPatient] = useState(null)
  const [recentVitals, setRecentVitals] = useState(null)
  
  // NEW: States to hold test results
  const [labResults, setLabResults] = useState([])
  const [imagingResults, setImagingResults] = useState([])
  
  const [availableMeds, setAvailableMeds] = useState([])
  const [selectedMeds, setSelectedMeds] = useState([]) 
  const [currentMedId, setCurrentMedId] = useState('')
  const [currentMedQty, setCurrentMedQty] = useState(1)
  
  const [availableServices, setAvailableServices] = useState([])
  const [selectedServices, setSelectedServices] = useState([])
  const [currentServiceId, setCurrentServiceId] = useState('')
  
  const [customNotes, setCustomNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showRedirectModal, setShowRedirectModal] = useState(false)
  const [consultationId, setConsultationId] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      const { data: meds } = await supabase.from('medications').select('id, name, quantity_in_stock, unit, unit_price').order('name')
      setAvailableMeds(meds || [])
      
      const { data: services } = await supabase.from('medical_services').select('*').eq('is_active', true).order('name')
      setAvailableServices(services || [])
    }
    fetchData()
  }, [])

  const handleAddMed = () => {
    if (!currentMedId || currentMedQty <= 0) return
    const med = availableMeds.find(m => m.id === currentMedId)
    if (!med) return
    if (selectedMeds.find(m => m.id === currentMedId)) { alert('Already added.'); return; }
    
    setSelectedMeds([...selectedMeds, { 
      id: med.id, 
      name: med.name, 
      qty: currentMedQty, 
      unit: med.unit, 
      unit_price: med.unit_price || 0,
      dosage: '' 
    }])
    setCurrentMedId(''); setCurrentMedQty(1)
  }

  const handleUpdateDosage = (index, value) => {
    const updatedMeds = [...selectedMeds]
    updatedMeds[index].dosage = value
    setSelectedMeds(updatedMeds)
  }

  const handleAddService = () => {
    if (!currentServiceId) return
    const service = availableServices.find(s => s.id === currentServiceId)
    if (!service) return
    if (selectedServices.find(s => s.id === currentServiceId)) { alert('Already added.'); return; }
    setSelectedServices([...selectedServices, { id: service.id, name: service.name, category: service.category, price: service.price }])
    setCurrentServiceId('')
  }

  const handleRemoveMed = (id) => setSelectedMeds(selectedMeds.filter(m => m.id !== id))
  const handleRemoveService = (id) => setSelectedServices(selectedServices.filter(s => s.id !== id))

  const handleClear = () => {
    setPatient(null)
    setRecentVitals(null)
    setLabResults([])
    setImagingResults([])
    setSearchId('')
    setMessage('')
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setLabResults([])
    setImagingResults([])
    
    try {
      const { data: patientData, error } = await supabase.from('patients').select('*').eq('patient_id', searchId.toUpperCase()).single()
      if (error) throw error
      setPatient(patientData)
      
      // Fetch Vitals
      const { data: vitalsData } = await supabase.from('vitals').select('*').eq('patient_id', patientData.patient_id).order('recorded_at', { ascending: false }).limit(1).single()
      if (vitalsData) setRecentVitals(vitalsData)

      // NEW: Fetch Lab Results
      const { data: labData } = await supabase.from('lab_results').select('*').eq('patient_id', patientData.patient_id).order('created_at', { ascending: false })
      setLabResults(labData || [])

      // NEW: Fetch Imaging Results
      const { data: imagingData } = await supabase.from('imaging_results').select('*').eq('patient_id', patientData.patient_id).order('created_at', { ascending: false })
      setImagingResults(imagingData || [])

    } catch (err) { setMessage('❌ Patient not found.') }
    setLoading(false)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const totalDispensaryFee = selectedMeds.reduce((sum, med) => sum + (med.qty * med.unit_price), 0);
      const totalServicesFee = selectedServices.reduce((sum, s) => sum + s.price, 0);
      const grandTotal = totalDispensaryFee + totalServicesFee;

      const labFee = selectedServices.filter(s => s.category === 'Lab').reduce((sum, s) => sum + s.price, 0);
      const radiologyFee = selectedServices.filter(s => s.category === 'X-Ray' || s.category === 'Scan').reduce((sum, s) => sum + s.price, 0);

      const dosageInstructions = selectedMeds.map(m => 
        `${m.name} (${m.qty} ${m.unit}): ${m.dosage || 'Follow standard dosage'}`
      ).join('\n');

      const finalPrescription = `${customNotes}\n\n--- PRESCRIBED MEDICATIONS & DOSAGE ---\n${dosageInstructions}`;

      const { data, error } = await supabase.from('consultations').insert([{ 
        patient_id: patient.patient_id, 
        prescription: finalPrescription,
        lab_fee: labFee,
        radiology_fee: radiologyFee,
        dispensary_fee: totalDispensaryFee,
        total_amount: grandTotal, 
        status: 'pending' 
      }]).select()
      
      if (error) throw error
      const newId = data[0].id
      setConsultationId(newId)

      if (selectedMeds.length > 0) {
        await supabase.from('prescription_items').insert(selectedMeds.map(m => ({ consultation_id: newId, medication_id: m.id, quantity: m.qty })))
      }
      
      if (selectedServices.length > 0) {
        await supabase.from('consultation_services').insert(selectedServices.map(s => ({ consultation_id: newId, service_id: s.id, price_at_time: s.price })))
      }

      setShowRedirectModal(true)
    } catch (err) { setMessage('❌ Error: ' + err.message) }
    setLoading(false)
  }

  const handleRedirect = async (department) => {
    setLoading(true)
    try {
      let updates = { status: `sent_to_${department}` }
      
      if (department === 'lab') {
        updates.sent_to_lab = true
        updates.sent_to_cashier = true
      } else if (department === 'cashier') {
        updates.sent_to_cashier = true
      } else if (department === 'dispensary') {
        updates.sent_to_dispensary = true
        updates.sent_to_cashier = true
      } else if (department === 'xray') {
        updates.sent_to_radiology = true
        updates.sent_to_cashier = true
      } else if (department === 'scan') {
        updates.sent_to_radiology = true
        updates.sent_to_cashier = true
      }

      await supabase.from('consultations').update(updates).eq('id', consultationId)
      
      const deptName = department === 'xray' ? 'X-Ray' : department === 'scan' ? 'Scan' : department.charAt(0).toUpperCase() + department.slice(1)
      setMessage(`✅ Patient will go to Cashier first, then to ${deptName}!`)
      
      setShowRedirectModal(false)
      handleClear() // Reset everything after redirect
    } catch (err) { 
      setMessage('❌ Error: ' + err.message) 
    }
    setLoading(false)
  }

  const inputStyle = { width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '15px' }
  const labelStyle = { display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold', fontSize: '14px' }

  const estimatedTotal = selectedMeds.reduce((sum, med) => sum + (med.qty * med.unit_price), 0) + selectedServices.reduce((sum, s) => sum + s.price, 0);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ color: '#333', marginBottom: '20px', borderBottom: '2px solid #16a34a', paddingBottom: '10px' }}>🩺 Doctor Consulting</h2>
      {message && <div style={{ backgroundColor: message.includes('✅') ? '#dcfce7' : '#fee2e2', color: message.includes('✅') ? '#166534' : '#991b1b', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>{message}</div>}

      {!patient && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px' }}>
          <h3>Search Patient</h3>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
            <input value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="Enter Patient ID" style={{ ...inputStyle, marginBottom: 0, flex: 1 }} required />
            <button type="submit" disabled={loading} style={{ padding: '12px 25px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Search</button>
          </form>
        </div>
      )}

      {patient && (
        <div>
          <div style={{ backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, color: '#166534' }}>{patient.first_name} {patient.last_name}</h3>
              <p style={{ margin: '5px 0 0 0', color: '#15803d' }}>ID: {patient.patient_id}</p>
            </div>
            <button onClick={handleClear} style={{ padding: '8px 15px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Change Patient</button>
          </div>

          {/* VITALS DISPLAY */}
          {recentVitals && (
            <div style={{ backgroundColor: '#eff6ff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #bfdbfe' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#1e40af' }}>📊 Recent Vitals</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', fontSize: '14px' }}>
                <div><strong>BP:</strong> {recentVitals.blood_pressure}</div>
                <div><strong>Heart:</strong> {recentVitals.heart_rate} bpm</div>
                <div><strong>Temp:</strong> {recentVitals.temperature}°C</div>
                <div><strong>Weight:</strong> {recentVitals.weight} kg</div>
              </div>
            </div>
          )}

          {/* NEW: LAB RESULTS DISPLAY */}
          {labResults.length > 0 && (
            <div style={{ backgroundColor: '#fff7ed', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #fed7aa' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#c2410c' }}>🧪 Lab Results</h4>
              {labResults.map((lab, idx) => (
                <div key={lab.id} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: idx < labResults.length - 1 ? '1px solid #fdba74' : 'none' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{new Date(lab.created_at).toLocaleString()}</div>
                  <div style={{ marginBottom: '4px' }}><strong>Test:</strong> {lab.test_name}</div>
                  <div><strong>Result:</strong> <span style={{ fontWeight: 'bold', color: lab.result.toLowerCase().includes('positive') || lab.result.toLowerCase().includes('abnormal') ? '#dc2626' : '#16a34a' }}>{lab.result}</span></div>
                  {lab.notes && <div style={{ fontSize: '13px', color: '#666', marginTop: '4px', fontStyle: 'italic' }}>Note: {lab.notes}</div>}
                </div>
              ))}
            </div>
          )}

          {/* NEW: IMAGING RESULTS DISPLAY */}
          {imagingResults.length > 0 && (
            <div style={{ backgroundColor: '#fdf2f8', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #fbcfe8' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#be185d' }}>🩻 X-Ray / Scan Results</h4>
              {imagingResults.map((img, idx) => (
                <div key={img.id} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: idx < imagingResults.length - 1 ? '1px solid #f9a8d4' : 'none' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{new Date(img.created_at).toLocaleString()}</div>
                  <div style={{ marginBottom: '4px' }}><strong>Type:</strong> {img.imaging_type} - {img.body_part}</div>
                  <div><strong>Findings:</strong> {img.findings}</div>
                  {img.image_link && (
                    <a href={img.image_link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '8px', fontSize: '13px', color: '#3b82f6', textDecoration: 'underline', fontWeight: 'bold' }}>
                      📸 View Image
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSave} style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px' }}>
            
            <div style={{ marginBottom: '25px', border: '1px solid #e5e7eb', padding: '20px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>💊 Prescribe Herbs</h3>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <select value={currentMedId} onChange={(e) => setCurrentMedId(e.target.value)} style={{ flex: 2, padding: '12px', border: '1px solid #ddd', borderRadius: '6px' }}>
                  <option value="">-- Select Medication --</option>
                  {availableMeds.map(med => (<option key={med.id} value={med.id}>{med.name} (Stock: {med.quantity_in_stock}) - GH₵{med.unit_price}</option>))}
                </select>
                <input type="number" min="1" value={currentMedQty} onChange={(e) => setCurrentMedQty(e.target.value)} placeholder="Qty" style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '6px' }} />
                <button type="button" onClick={handleAddMed} style={{ padding: '12px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Add</button>
              </div>
              
              {selectedMeds.map((med, index) => (
                <div key={med.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 2, minWidth: '200px' }}>
                    <strong>{med.name}</strong> <span style={{color: '#666'}}>(x{med.qty} {med.unit})</span>
                  </div>
                  <input 
                    type="text" 
                    value={med.dosage} 
                    onChange={(e) => handleUpdateDosage(index, e.target.value)} 
                    placeholder="e.g. 2 spoons after meals" 
                    style={{ flex: 3, padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', minWidth: '200px' }} 
                  />
                  <button type="button" onClick={() => handleRemoveMed(med.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Remove</button>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '25px', border: '1px solid #e5e7eb', padding: '20px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>🧪 Order Tests & Scans</h3>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <select value={currentServiceId} onChange={(e) => setCurrentServiceId(e.target.value)} style={{ flex: 3, padding: '12px', border: '1px solid #ddd', borderRadius: '6px' }}>
                  <option value="">-- Select Test/Scan --</option>
                  {availableServices.map(s => (<option key={s.id} value={s.id}>[{s.category}] {s.name} - GH₵{s.price}</option>))}
                </select>
                <button type="button" onClick={handleAddService} style={{ padding: '12px 20px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Add</button>
              </div>
              {selectedServices.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span><strong>{s.name}</strong> ({s.category}) = GH₵{s.price}</span>
                  <button type="button" onClick={() => handleRemoveService(s.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>📝 Doctor's Notes</label>
              <textarea value={customNotes} onChange={(e) => setCustomNotes(e.target.value)} style={{ ...inputStyle, minHeight: '80px' }}></textarea>
            </div>

            <div style={{ backgroundColor: '#1e293b', color: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>TOTAL BILL</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#4ade80' }}>GH₵ {estimatedTotal.toFixed(2)}</div>
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%', padding: '15px', backgroundColor: loading ? '#9ca3af' : '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
              {loading ? 'Saving...' : '💾 Save & Choose Next Step'}
            </button>
          </form>
        </div>
      )}

      {showRedirectModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', maxWidth: '600px', width: '90%', textAlign: 'center' }}>
            <h2 style={{ color: '#16a34a' }}>✅ Saved!</h2>
            <p style={{ color: '#666', marginBottom: '25px' }}>Where to send <strong>{patient?.first_name}</strong>?</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <button onClick={() => handleRedirect('cashier')} disabled={loading} style={{ padding: '20px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>💰 Cashier</button>
              <button onClick={() => handleRedirect('lab')} disabled={loading} style={{ padding: '20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>🧪 Lab</button>
              <button onClick={() => handleRedirect('xray')} disabled={loading} style={{ padding: '20px', backgroundColor: '#ec4899', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>🩻 X-Ray</button>
              <button onClick={() => handleRedirect('scan')} disabled={loading} style={{ padding: '20px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>🔬 Scan</button>
              <button onClick={() => handleRedirect('dispensary')} disabled={loading} style={{ padding: '20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', gridColumn: 'span 2' }}>🌿 Dispensary</button>
            </div>
            
            <button onClick={() => setShowRedirectModal(false)} style={{ padding: '10px 20px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}