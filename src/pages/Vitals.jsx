import { useState } from 'react'
import { supabase } from '../config/supabase'

export default function Vitals() {
  const [searchId, setSearchId] = useState('')
  const [patient, setPatient] = useState(null)
  const [pastVitals, setPastVitals] = useState([])
  const [editedMiddleName, setEditedMiddleName] = useState('')
  
  const [formData, setFormData] = useState({
    blood_pressure: '', heart_rate: '', temperature: '', weight: '', height: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleChange = (e) => { 
    setFormData({ ...formData, [e.target.name]: e.target.value }) 
  }

  // BMI CALCULATION LOGIC
  const calculateBMI = () => {
    const w = parseFloat(formData.weight)
    const h = parseFloat(formData.height)
    if (w > 0 && h > 0) {
      const heightInMeters = h / 100
      return (w / (heightInMeters * heightInMeters)).toFixed(1)
    }
    return null
  }

  const getBMIColor = (bmi) => {
    if (!bmi) return '#666'
    if (bmi < 18.5) return '#dc2626' 
    if (bmi < 25) return '#16a34a'   
    if (bmi < 30) return '#f59e0b'   
    return '#dc2626'                 
  }

  const getBMILabel = (bmi) => {
    if (!bmi) return ''
    if (bmi < 18.5) return '(Underweight)'
    if (bmi < 25) return '(Normal)'
    if (bmi < 30) return '(Overweight)'
    return '(Obese)'
  }

  // BULLETPROOF SEARCH FUNCTION
  const handleSearch = async (e) => {
    if (e) e.preventDefault()
    if (!searchId) return
    
    setLoading(true)
    setMessage('')
    setPatient(null)
    setPastVitals([])

    try {
      // FIX: Use limit(1) instead of single() to prevent "Cannot coerce" errors
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('patient_id', searchId.trim().toUpperCase())
        .limit(1)

      if (error) throw error

      if (!data || data.length === 0) {
        setMessage('❌ Patient not found. Please check the ID and try again.')
        setLoading(false)
        return
      }

      // Safely grab the first result
      const patientData = data[0]
      setPatient(patientData)
      setEditedMiddleName(patientData.middle_name || '')

      // Fetch Past Vitals
      const { data: vitalsData, error: vitalsError } = await supabase
        .from('vitals')
        .select('*')
        .eq('patient_id', patientData.patient_id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (vitalsError) console.error("Error fetching vitals:", vitalsError)
      setPastVitals(vitalsData || [])

    } catch (err) { 
      console.error('Search error:', err)
      setMessage('❌ Error searching patient: ' + err.message) 
    }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!patient) return
    setLoading(true)
    setMessage('')

    try {
      // Update Middle Name if changed
      if (editedMiddleName !== patient.middle_name) {
        const { error: updateError } = await supabase
          .from('patients')
          .update({ middle_name: editedMiddleName })
          .eq('id', patient.id)
        if (updateError) throw updateError
      }

      const bmiValue = calculateBMI()

      // Insert new vitals
      const { error } = await supabase.from('vitals').insert([{ 
        patient_id: patient.patient_id, 
        ...formData,
        bmi: bmiValue 
      }])
      if (error) throw error

      setMessage('✅ Vitals recorded successfully! Patient can now proceed to the Doctor.')
      
      // Reset form
      setFormData({ blood_pressure: '', heart_rate: '', temperature: '', weight: '', height: '' })
      
      // Refresh history
      const { data: vitalsData } = await supabase
        .from('vitals')
        .select('*')
        .eq('patient_id', patient.patient_id)
        .order('created_at', { ascending: false })
        .limit(5)
      setPastVitals(vitalsData || [])

    } catch (err) { 
      setMessage('❌ Error saving vitals: ' + err.message) 
    }
    setLoading(false)
  }

  const inputStyle = { width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '15px' }
  const labelStyle = { display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold', fontSize: '14px' }
  const thStyle = { padding: '10px', color: '#666', fontWeight: 'bold', borderBottom: '2px solid #e5e7eb', textAlign: 'left', fontSize: '12px' }
  const tdStyle = { padding: '10px', color: '#333', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }

  const currentBMI = calculateBMI()

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ color: '#333', marginBottom: '20px', borderBottom: '2px solid #16a34a', paddingBottom: '10px' }}>❤️ Patient Vitals</h2>

      {!patient && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0 }}>Search Patient by ID</h3>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
            <input value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="Enter Patient ID (e.g. AH-2026-001)" style={{ ...inputStyle, marginBottom: 0, flex: 1 }} required />
            <button type="submit" disabled={loading} style={{ padding: '12px 25px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{loading ? 'Searching...' : 'Search'}</button>
          </form>
          {message && <div style={{ marginTop: '15px', padding: '12px', backgroundColor: message.includes('✅') ? '#dcfce7' : '#fee2e2', color: message.includes('✅') ? '#166534' : '#991b1b', borderRadius: '8px' }}>{message}</div>}
        </div>
      )}

      {patient && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          
          {/* PATIENT HEADER */}
          <div style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                <h3 style={{ margin: 0, color: '#166534' }}>{patient.first_name}</h3>
                <input 
                  value={editedMiddleName} 
                  onChange={(e) => setEditedMiddleName(e.target.value)} 
                  placeholder="Middle Name" 
                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #86efac', fontSize: '16px', color: '#166534', fontWeight: 'bold', width: '120px', backgroundColor: 'white' }}
                />
                <h3 style={{ margin: 0, color: '#166534' }}>{patient.last_name}</h3>
              </div>
              <p style={{ margin: 0, color: '#15803d', fontSize: '14px' }}>ID: {patient.patient_id} • Gender: {patient.gender} • Age: {patient.date_of_birth ? Math.floor((new Date() - new Date(patient.date_of_birth)) / 31557600000) : 'N/A'}</p>
            </div>
            <button onClick={() => { setPatient(null); setSearchId(''); setPastVitals([]); }} style={{ padding: '8px 15px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Change Patient</button>
          </div>

          {/* PAST VITALS HISTORY SECTION */}
          <div style={{ marginBottom: '25px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#475569', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Past Vitals History
            </h4>
            
            {pastVitals.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>BP</th>
                      <th style={thStyle}>Heart Rate</th>
                      <th style={thStyle}>Temp</th>
                      <th style={thStyle}>Weight</th>
                      <th style={thStyle}>BMI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastVitals.map((v, index) => (
                      <tr key={v.id} style={{ backgroundColor: index === 0 ? '#eff6ff' : 'transparent' }}>
                        <td style={tdStyle}>{new Date(v.created_at).toLocaleDateString()}</td>
                        <td style={tdStyle}><strong>{v.blood_pressure || '-'}</strong></td>
                        <td style={tdStyle}>{v.heart_rate || '-'}</td>
                        <td style={tdStyle}>{v.temperature || '-'}</td>
                        <td style={tdStyle}>{v.weight || '-'}</td>
                        <td style={tdStyle}>{v.bmi ? <span style={{color: getBMIColor(v.bmi), fontWeight: 'bold'}}>{v.bmi}</span> : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, fontStyle: 'italic' }}>No past records found for this patient. This will be the first entry.</p>
            )}
          </div>

          {/* NEW VITALS FORM */}
          <form onSubmit={handleSubmit}>
            <h4 style={{ color: '#333', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Enter New Vitals</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Blood Pressure (mmHg) *</label>
                <input name="blood_pressure" value={formData.blood_pressure} onChange={handleChange} style={inputStyle} placeholder="e.g. 120/80" required />
              </div>
              <div>
                <label style={labelStyle}>Heart Rate (bpm) *</label>
                <input type="number" name="heart_rate" value={formData.heart_rate} onChange={handleChange} style={inputStyle} placeholder="e.g. 72" required />
              </div>
              <div>
                <label style={labelStyle}>Temperature (°C) *</label>
                <input type="number" step="0.1" name="temperature" value={formData.temperature} onChange={handleChange} style={inputStyle} placeholder="e.g. 37.0" required />
              </div>
              <div>
                <label style={labelStyle}>Weight (kg) *</label>
                <input type="number" step="0.1" name="weight" value={formData.weight} onChange={handleChange} style={inputStyle} placeholder="e.g. 70.5" required />
              </div>
              <div>
                <label style={labelStyle}>Height (cm)</label>
                <input type="number" name="height" value={formData.height} onChange={handleChange} style={inputStyle} placeholder="e.g. 170" />
              </div>
              
              {/* LIVE BMI DISPLAY */}
              {currentBMI && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  backgroundColor: '#f8fafc', 
                  borderRadius: '8px', 
                  border: `2px solid ${getBMIColor(currentBMI)}`,
                  padding: '10px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', fontWeight: 'bold' }}>CALCULATED BMI</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: getBMIColor(currentBMI) }}>{currentBMI}</div>
                    <div style={{ fontSize: '12px', color: getBMIColor(currentBMI), fontWeight: 'bold' }}>{getBMILabel(currentBMI)}</div>
                  </div>
                </div>
              )}
            </div>
            
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '15px', backgroundColor: loading ? '#9ca3af' : '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
              {loading ? 'Saving...' : '💾 Save New Vitals & Proceed'}
            </button>
          </form>

          {message && (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: message.includes('✅') ? '#dcfce7' : '#fee2e2', color: message.includes('✅') ? '#166534' : '#991b1b', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold' }}>
              {message}
            </div>
          )}
        </div>
      )}
    </div>
  )
}