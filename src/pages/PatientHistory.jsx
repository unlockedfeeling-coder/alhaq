import { useState } from 'react'
import { supabase } from '../config/supabase'

export default function PatientHistory() {
  const [searchId, setSearchId] = useState('')
  const [patient, setPatient] = useState(null)
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSearch = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setPatient(null)
    setHistory(null)

    try {
      const { data: pData, error: pError } = await supabase.from('patients').select('*').eq('patient_id', searchId.toUpperCase()).single()
      if (pError) throw pError

      setPatient(pData)

      // Fetch all related history in parallel
      const [vitalsRes, consultsRes, labsRes, imagingRes] = await Promise.all([
        supabase.from('vitals').select('*').eq('patient_id', pData.patient_id).order('recorded_at', { ascending: false }),
        supabase.from('consultations').select('*').eq('patient_id', pData.patient_id).order('created_at', { ascending: false }),
        supabase.from('lab_results').select('*').eq('patient_id', pData.patient_id).order('created_at', { ascending: false }),
        supabase.from('imaging_results').select('*').eq('patient_id', pData.patient_id).order('created_at', { ascending: false })
      ])

      setHistory({
        vitals: vitalsRes.data || [],
        consults: consultsRes.data || [],
        labs: labsRes.data || [],
        imaging: imagingRes.data || []
      })
    } catch (err) {
      setMessage('❌ Patient not found or error loading history: ' + err.message)
    }
    setLoading(false)
  }

  const handlePrint = () => { window.print() }

  const inputStyle = { width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold', fontSize: '14px' }

  return (
    <div>
      {/* PRINT STYLES: Hides sidebar and search bar when printing */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-record, #printable-record * { visibility: visible; }
          #printable-record { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ color: '#333', marginBottom: '20px', borderBottom: '2px solid #16a34a', paddingBottom: '10px' }}>📁 Patient Medical Records</h2>
        
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
            <input value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="Enter Patient ID to view full history..." style={{ ...inputStyle, flex: 1 }} required />
            <button type="submit" disabled={loading} style={{ padding: '12px 25px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              {loading ? 'Loading...' : 'Search Records'}
            </button>
          </form>
          {message && <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px' }}>{message}</div>}
        </div>
      </div>

      {/* PRINTABLE AREA */}
      {patient && history && (
        <div id="printable-record" style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          
          {/* Header */}
          <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#16a34a' }}>Medical Record for {patient.first_name} {patient.last_name}</h3>
            <button onClick={handlePrint} style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              🖨️ Print / Save as PDF
            </button>
          </div>

          {/* Patient Demographics */}
          <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Patient Demographics</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '14px' }}>
              <div><strong>ID:</strong> {patient.patient_id}</div>
              <div><strong>Name:</strong> {patient.first_name} {patient.last_name}</div>
              <div><strong>DOB:</strong> {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'N/A'}</div>
              <div><strong>Gender:</strong> {patient.gender}</div>
              <div><strong>Blood Type:</strong> {patient.blood_type}</div>
              <div><strong>Phone:</strong> {patient.phone}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Allergies:</strong> <span style={{color: '#dc2626'}}>{patient.allergies || 'None reported'}</span></div>
            </div>
          </div>

          {/* Consultations */}
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ color: '#333', borderBottom: '2px solid #16a34a', paddingBottom: '5px' }}> Consultation History</h4>
            {history.consults.length === 0 ? <p style={{color: '#666'}}>No past consultations.</p> :
              history.consults.map((c, idx) => (
                <div key={idx} style={{ padding: '15px', marginBottom: '10px', borderLeft: '4px solid #16a34a', backgroundColor: '#f0fdf4', borderRadius: '4px' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>{new Date(c.created_at).toLocaleString()}</div>
                  {c.chief_complaint && <div><strong>Complaint:</strong> {c.chief_complaint}</div>}
                  {c.doctor_notes && <div><strong>Doctor's Notes:</strong> {c.doctor_notes}</div>}
                  {c.prescription && <div><strong>Prescription:</strong> {c.prescription}</div>}
                </div>
              ))
            }
          </div>

          {/* Vitals */}
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ color: '#333', borderBottom: '2px solid #3b82f6', paddingBottom: '5px' }}>❤️ Vitals History</h4>
            {history.vitals.length === 0 ? <p style={{color: '#666'}}>No vitals recorded.</p> :
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#eff6ff' }}>
                    <th style={thStyle}>Date</th><th style={thStyle}>BP</th><th style={thStyle}>Heart Rate</th><th style={thStyle}>Temp</th><th style={thStyle}>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {history.vitals.map((v, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={tdStyle}>{new Date(v.recorded_at).toLocaleDateString()}</td>
                      <td style={tdStyle}>{v.blood_pressure}</td>
                      <td style={tdStyle}>{v.heart_rate} bpm</td>
                      <td style={tdStyle}>{v.temperature}°C</td>
                      <td style={tdStyle}>{v.weight} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          </div>

          {/* Lab Results */}
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ color: '#333', borderBottom: '2px solid #f59e0b', paddingBottom: '5px' }}>🧪 Lab Results</h4>
            {history.labs.length === 0 ? <p style={{color: '#666'}}>No lab results.</p> :
              history.labs.map((l, idx) => (
                <div key={idx} style={{ padding: '10px', marginBottom: '10px', backgroundColor: '#fffbeb', borderRadius: '4px', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>{new Date(l.created_at).toLocaleDateString()} - <strong>{l.test_name}</strong></div>
                  <div><strong>Result:</strong> {l.result}</div>
                  {l.notes && <div style={{fontSize: '12px', color: '#666'}}>Note: {l.notes}</div>}
                </div>
              ))
            }
          </div>

          {/* Footer for Print */}
          <div className="no-print" style={{ marginTop: '40px', textAlign: 'center', color: '#666', fontSize: '12px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
            Generated by Al-Haq Herbal Centre HMS on {new Date().toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle = { padding: '10px', textAlign: 'left', color: '#333', fontWeight: 'bold' }
const tdStyle = { padding: '10px', color: '#555' }