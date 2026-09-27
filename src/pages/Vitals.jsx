import { useState } from 'react'
import { supabase } from '../config/supabase'

export default function Vitals() {
  const [searchId, setSearchId] = useState('')
  const [patient, setPatient] = useState(null)
  const [formData, setFormData] = useState({
    blood_pressure: '', heart_rate: '', temperature: '', weight: '', height: '', notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleChange = (e) => { setFormData({ ...formData, [e.target.name]: e.target.value }) }

  const handleSearch = async (e) => {
    if (e) e.preventDefault()
    if (!searchId) return
    
    setLoading(true)
    setMessage('')
    setPatient(null)

    try {
      const { data, error } = await supabase.from('patients').select('*').eq('patient_id', searchId.toUpperCase()).single()
      if (error) throw error
      setPatient(data)
    } catch (err) { setMessage(' Patient not found: ' + err.message) }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!patient) return
    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.from('vitals').insert([{ 
        patient_id: patient.patient_id, 
        ...formData 
      }])
      if (error) throw error

      setMessage('✅ Vitals recorded successfully! Patient can now proceed to the Doctor.')
      setFormData({ blood_pressure: '', heart_rate: '', temperature: '', weight: '', height: '', notes: '' })
    } catch (err) { setMessage('❌ Error saving vitals: ' + err.message) }
    setLoading(false)
  }

  const inputStyle = { width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '15px' }
  const labelStyle = { display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold', fontSize: '14px' }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ color: '#333', marginBottom: '20px', borderBottom: '2px solid #16a34a', paddingBottom: '10px' }}>❤️ Patient Vitals</h2>

      {!patient && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0 }}>Search Patient by ID</h3>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
            <input value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="Enter Patient ID" style={{ ...inputStyle, marginBottom: 0, flex: 1 }} required />
            <button type="submit" disabled={loading} style={{ padding: '12px 25px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{loading ? 'Searching...' : 'Search'}</button>
          </form>
          {message && <div style={{ marginTop: '15px', padding: '12px', backgroundColor: message.includes('✅') ? '#dcfce7' : '#fee2e2', color: message.includes('✅') ? '#166534' : '#991b1b', borderRadius: '8px' }}>{message}</div>}
        </div>
      )}

      {patient && (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, color: '#166534' }}>{patient.first_name} {patient.last_name}</h3>
              <p style={{ margin: '5px 0 0 0', color: '#15803d', fontSize: '14px' }}>ID: {patient.patient_id}</p>
            </div>
            <button onClick={() => { setPatient(null); setSearchId(''); }} style={{ padding: '8px 15px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Change Patient</button>
          </div>

          <form onSubmit={handleSubmit}>
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
            </div>
            <div>
              <label style={labelStyle}>Additional Notes</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} style={{ ...inputStyle, minHeight: '60px' }}></textarea>
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '15px', backgroundColor: loading ? '#9ca3af' : '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
              {loading ? 'Saving...' : '💾 Save Vitals & Proceed'}
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