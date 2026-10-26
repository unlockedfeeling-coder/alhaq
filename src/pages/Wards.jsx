import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

export default function Wards() {
  const [beds, setBeds] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAdmitModal, setShowAdmitModal] = useState(false)
  const [selectedBed, setSelectedBed] = useState(null)
  
  const [formData, setFormData] = useState({
    ward_name: 'Male General', bed_number: '', price_per_night: 50
  })
  
  const [admitData, setAdmitData] = useState({
    patient_id: '', patient_name: ''
  })

  useEffect(() => { fetchBeds() }, [])

  const fetchBeds = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('hospital_beds')
      .select('*')
      .order('ward_name')
      .order('bed_number')
    
    if (error) console.error("Error fetching beds:", error)
    else setBeds(data || [])
    setLoading(false)
  }

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })
  const handleAdmitChange = (e) => setAdmitData({ ...admitData, [e.target.name]: e.target.value })

  // Group beds by ward for the UI
  const groupedBeds = beds.reduce((acc, bed) => {
    if (!acc[bed.ward_name]) acc[bed.ward_name] = []
    acc[bed.ward_name].push(bed)
    return acc
  }, {})

  const handleAddBed = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('hospital_beds').insert([formData])
      if (error) throw error
      setMessage('✅ Bed added successfully!')
      setShowAddModal(false)
      setFormData({ ward_name: 'Male General', bed_number: '', price_per_night: 50 })
      fetchBeds()
    } catch (err) { setMessage('❌ Error: ' + err.message) }
    setLoading(false)
  }

  const handleQuickAdmit = (bed) => {
    setSelectedBed(bed)
    setAdmitData({ patient_id: '', patient_name: '' })
    setShowAdmitModal(true)
  }

  const handleConfirmAdmit = async (e) => {
    e.preventDefault()
    if (!admitData.patient_id || !admitData.patient_name) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('hospital_beds')
        .update({
          status: 'Occupied',
          current_patient_id: admitData.patient_id,
          patient_name: admitData.patient_name,
          admission_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', selectedBed.id)
      
      if (error) throw error
      setMessage(`✅ ${admitData.patient_name} admitted to ${selectedBed.ward_name} - ${selectedBed.bed_number}`)
      setShowAdmitModal(false)
      fetchBeds()
    } catch (err) { setMessage('❌ Error: ' + err.message) }
    setLoading(false)
  }

  const handleDischarge = async (bed) => {
    if (!window.confirm(`Discharge ${bed.patient_name} from ${bed.bed_number}?`)) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('hospital_beds')
        .update({
          status: 'Available',
          current_patient_id: null,
          patient_name: null,
          admission_date: null
        })
        .eq('id', bed.id)
      
      if (error) throw error
      setMessage(`✅ Patient discharged. ${bed.bed_number} is now available.`)
      fetchBeds()
    } catch (err) { setMessage('❌ Error: ' + err.message) }
    setLoading(false)
  }

  // Stats
  const totalBeds = beds.length
  const occupiedBeds = beds.filter(b => b.status === 'Occupied').length
  const availableBeds = totalBeds - occupiedBeds

  const inputStyle = { width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '15px' }
  const labelStyle = { display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold', fontSize: '14px' }
  const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }
  const modalContent = { backgroundColor: 'white', padding: '30px', borderRadius: '12px', maxWidth: '500px', width: '90%' }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h2 style={{ color: '#333', margin: 0 }}> Ward & Bed Management</h2>
        <button onClick={() => setShowAddModal(true)} style={{ padding: '10px 20px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          ➕ Add New Bed
        </button>
      </div>

      {message && (
        <div style={{ 
          backgroundColor: message.includes('✅') ? '#dcfce7' : '#fee2e2', 
          color: message.includes('✅') ? '#166534' : '#991b1b', 
          padding: '15px', borderRadius: '8px', marginBottom: '20px', fontWeight: 'bold' 
        }}>
          {message}
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '5px solid #3b82f6' }}>
          <div style={{ color: '#666', fontSize: '13px' }}>Total Beds</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>{totalBeds}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '5px solid #16a34a' }}>
          <div style={{ color: '#666', fontSize: '13px' }}>Available</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a' }}>{availableBeds}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '5px solid #ef4444' }}>
          <div style={{ color: '#666', fontSize: '13px' }}>Occupied</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444' }}>{occupiedBeds}</div>
        </div>
      </div>

      {/* Wards Grid */}
      {loading ? <p style={{textAlign: 'center', color: '#666'}}>Loading beds...</p> : 
        Object.keys(groupedBeds).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px' }}>
            <p style={{ color: '#666', fontSize: '18px' }}>No beds added yet. Click "Add New Bed" to set up your wards.</p>
          </div>
        ) : (
          Object.keys(groupedBeds).map(ward => (
            <div key={ward} style={{ marginBottom: '30px' }}>
              <h3 style={{ color: '#333', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', marginBottom: '15px' }}>
                🛏️ {ward} Ward
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px' }}>
                {groupedBeds[ward].map(bed => (
                  <div key={bed.id} style={{ 
                    backgroundColor: 'white', 
                    padding: '20px', 
                    borderRadius: '12px', 
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    border: `2px solid ${bed.status === 'Occupied' ? '#ef4444' : '#16a34a'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0, fontSize: '18px', color: '#333' }}>{bed.bed_number}</h4>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '12px', 
                          fontSize: '12px', 
                          fontWeight: 'bold',
                          backgroundColor: bed.status === 'Occupied' ? '#fee2e2' : '#dcfce7',
                          color: bed.status === 'Occupied' ? '#991b1b' : '#166534'
                        }}>
                          {bed.status === 'Occupied' ? '🔴 Occupied' : '🟢 Available'}
                        </span>
                      </div>
                      
                      {bed.status === 'Occupied' ? (
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                          <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '5px' }}>{bed.patient_name}</div>
                          <div style={{ fontSize: '12px' }}>ID: {bed.current_patient_id}</div>
                          <div style={{ fontSize: '12px' }}>Admitted: {bed.admission_date}</div>
                          <div style={{ fontSize: '12px', marginTop: '5px', color: '#f59e0b', fontWeight: 'bold' }}>GH₵ {bed.price_per_night} / night</div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                          <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 'bold' }}>Ready for admission</div>
                          <div style={{ fontSize: '12px', marginTop: '5px' }}>GH₵ {bed.price_per_night} / night</div>
                        </div>
                      )}
                    </div>

                    <div>
                      {bed.status === 'Occupied' ? (
                        <button 
                          onClick={() => handleDischarge(bed)} 
                          style={{ width: '100%', padding: '10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                        >
                          Discharge Patient
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleQuickAdmit(bed)} 
                          style={{ width: '100%', padding: '10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                        >
                          Quick Admit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )
      }

      {/* Add Bed Modal */}
      {showAddModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h2 style={{ color: '#16a34a', marginTop: 0 }}>➕ Add New Bed</h2>
            <form onSubmit={handleAddBed}>
              <div><label style={labelStyle}>Ward Name *</label>
                <select name="ward_name" value={formData.ward_name} onChange={handleChange} style={inputStyle}>
                  <option value="Male General">Male General</option>
                  <option value="Female General">Female General</option>
                  <option value="Pediatric">Pediatric</option>
                  <option value="Maternity">Maternity</option>
                  <option value="VIP Ward">VIP Ward</option>
                  <option value="Isolation">Isolation</option>
                </select>
              </div>
              <div><label style={labelStyle}>Bed Number *</label><input name="bed_number" value={formData.bed_number} onChange={handleChange} style={inputStyle} required placeholder="e.g. Bed 01" /></div>
              <div><label style={labelStyle}>Price Per Night (GH)</label><input type="number" name="price_per_night" value={formData.price_per_night} onChange={handleChange} style={inputStyle} required /></div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '12px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{loading ? 'Adding...' : 'Add Bed'}</button>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '12px 25px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Admit Modal */}
      {showAdmitModal && selectedBed && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h2 style={{ color: '#3b82f6', marginTop: 0 }}>🛏️ Admit Patient to {selectedBed.bed_number}</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>Ward: <strong>{selectedBed.ward_name}</strong> | Price: <strong>GH₵ {selectedBed.price_per_night}/night</strong></p>
            <form onSubmit={handleConfirmAdmit}>
              <div><label style={labelStyle}>Patient ID *</label><input name="patient_id" value={admitData.patient_id} onChange={handleAdmitChange} style={inputStyle} required placeholder="e.g. AH-2026-001" /></div>
              <div><label style={labelStyle}>Patient Name *</label><input name="patient_name" value={admitData.patient_name} onChange={handleAdmitChange} style={inputStyle} required placeholder="e.g. John Doe" /></div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{loading ? 'Admitting...' : 'Confirm Admission'}</button>
                <button type="button" onClick={() => setShowAdmitModal(false)} style={{ padding: '12px 25px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}