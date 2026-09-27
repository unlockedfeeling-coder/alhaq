import { useState } from 'react'
import { supabase } from '../config/supabase'

export default function RecoverID() {
  const [searchName, setSearchName] = useState('')
  const [searchPhone, setSearchPhone] = useState('')
  const [searchDob, setSearchDob] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [copiedId, setCopiedId] = useState('')

  const handleSearch = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setResults([])
    setCopiedId('')

    // Ensure at least one field is filled
    if (!searchName.trim() && !searchPhone.trim() && !searchDob) {
      setMessage('⚠️ Please enter at least a Name, Phone Number, or Date of Birth.')
      setLoading(false)
      return
    }

    try {
      let query = supabase.from('patients').select('*')
      
      // Dynamically build the query based on what is filled in
      if (searchName.trim()) {
        query = query.or(`first_name.ilike.%${searchName}%,last_name.ilike.%${searchName}%`)
      }
      if (searchPhone.trim()) {
        query = query.eq('phone', searchPhone.trim())
      }
      if (searchDob) {
        query = query.eq('date_of_birth', searchDob)
      }

      const { data, error } = await query.limit(20)

      if (error) throw error
      
      if (data && data.length > 0) {
        setResults(data)
      } else {
        setMessage('❌ No patient found. Please check the details or register them as a new patient.')
      }
    } catch (err) {
      setMessage('❌ Error searching: ' + err.message)
    }
    setLoading(false)
  }

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(''), 2000)
  }

  const inputStyle = { width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box', marginBottom: '0' }
  const labelStyle = { display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold', fontSize: '14px' }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ color: '#333', marginBottom: '20px', borderBottom: '2px solid #16a34a', paddingBottom: '10px' }}>🔍 Patient ID Recovery</h2>
      
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
        <p style={{ color: '#666', marginBottom: '20px', marginTop: 0 }}>
          Search for a returning patient who has forgotten their Patient ID. Fill in whatever details you remember (Date of Birth is optional).
        </p>

        <form onSubmit={handleSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div>
              <label style={labelStyle}>👤 Patient Name (Optional)</label>
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="e.g. Yakubu"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>📞 Phone Number (Optional)</label>
              <input
                type="tel"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                placeholder="e.g. 0555123456"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>🎂 Date of Birth (Optional)</label>
              <input
                type="date"
                value={searchDob}
                onChange={(e) => setSearchDob(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '15px', backgroundColor: loading ? '#9ca3af' : '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '20px' }}>
            {loading ? 'Searching Database...' : '🔍 Search for Patient'}
          </button>
        </form>

        {message && (
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: message.includes('❌') || message.includes('⚠️') ? '#fee2e2' : '#dcfce7', color: message.includes('❌') || message.includes('⚠️') ? '#991b1b' : '#166534', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold' }}>
            {message}
          </div>
        )}
      </div>

      {/* RESULTS SECTION */}
      {results.length > 0 && (
        <div>
          <h3 style={{ color: '#333', marginBottom: '15px' }}>✅ Patient(s) Found ({results.length})</h3>
          {results.map((p, idx) => (
            <div key={idx} style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', marginBottom: '15px', border: '1px solid #bbf7d0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Patient ID:</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a', fontFamily: 'monospace', backgroundColor: '#f0fdf4', padding: '5px 15px', borderRadius: '8px', border: '2px dashed #16a34a' }}>
                    {p.patient_id}
                  </div>
                </div>
                <button 
                  onClick={() => handleCopyId(p.patient_id)} 
                  style={{ 
                    padding: '10px 20px', 
                    backgroundColor: copiedId === p.patient_id ? '#166534' : '#3b82f6', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '6px', 
                    cursor: 'pointer', 
                    fontWeight: 'bold',
                    transition: 'all 0.2s'
                  }}
                >
                  {copiedId === p.patient_id ? '✅ Copied!' : '📋 Copy ID'}
                </button>
              </div>

              <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '15px', color: '#333', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                <div><strong>👤 Name:</strong> {p.first_name} {p.last_name}</div>
                <div><strong>📞 Phone:</strong> {p.phone || 'N/A'}</div>
                <div><strong>🎂 DOB:</strong> {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString() : 'N/A'}</div>
                <div><strong>🩸 Blood:</strong> {p.blood_type || 'N/A'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}