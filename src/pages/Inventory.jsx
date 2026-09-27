import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

export default function Inventory() {
  const [medications, setMedications] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRestockModal, setShowRestockModal] = useState(false)
  const [editingMed, setEditingMed] = useState(null)
  const [restockingMed, setRestockingMed] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  
  const [formData, setFormData] = useState({
    name: '', herbal_type: 'Powder', category: 'General', quantity_in_stock: 0,
    unit: 'bottles', reorder_level: 5, unit_price: 0, expiry_date: '',
    batch_number: '', supplier: '', description: ''
  })

  const [restockData, setRestockData] = useState({ quantity: 0, supplier: '', batch_number: '' })

  useEffect(() => { fetchMedications() }, [])

  const fetchMedications = async () => {
    setLoading(true)
    // Added error checking here
    const { data, error } = await supabase.from('medications').select('*').order('name')
    if (error) {
      console.error("Fetch Error:", error)
      setMessage('❌ Error loading inventory: ' + error.message)
    } else {
      setMedications(data || [])
    }
    setLoading(false)
  }

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })
  const handleRestockChange = (e) => setRestockData({ ...restockData, [e.target.name]: e.target.value })

  const totalItems = medications.length
  const totalValue = medications.reduce((sum, med) => sum + (med.quantity_in_stock * med.unit_price), 0)
  const lowStockCount = medications.filter(m => m.quantity_in_stock <= m.reorder_level).length
  
  const today = new Date()
  const thirtyDaysFromNow = new Date(today.setDate(today.getDate() + 30))
  const expiringSoonCount = medications.filter(m => m.expiry_date && new Date(m.expiry_date) <= thirtyDaysFromNow).length

  const handleExportCSV = () => {
    const headers = ['Name', 'Category', 'Stock', 'Unit', 'Price', 'Total Value', 'Expiry Date', 'Supplier', 'Batch No']
    const rows = medications.map(m => [
      m.name, m.category, m.quantity_in_stock, m.unit, m.unit_price, 
      (m.quantity_in_stock * m.unit_price).toFixed(2), m.expiry_date || 'N/A', m.supplier || 'N/A', m.batch_number || 'N/A'
    ])
    
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n"
    rows.forEach(row => {
      csvContent += row.map(cell => `"${cell}"`).join(",") + "\n"
    })
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "al_haq_inventory_report.csv")
    document.body.appendChild(link)
    link.click()
  }

  const handleAddNew = () => {
    setEditingMed(null)
    setFormData({ name: '', herbal_type: 'Powder', category: 'General', quantity_in_stock: 0, unit: 'bottles', reorder_level: 5, unit_price: 0, expiry_date: '', batch_number: '', supplier: '', description: '' })
    setShowAddModal(true)
  }

  const handleEdit = (med) => {
    setEditingMed(med)
    setFormData(med)
    setShowAddModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      if (editingMed) {
        const { error } = await supabase.from('medications').update({ ...formData, updated_at: new Date() }).eq('id', editingMed.id)
        if (error) throw error
        setMessage('✅ Medication updated!')
      } else {
        const { error } = await supabase.from('medications').insert([formData])
        if (error) throw error
        setMessage('✅ Medication added!')
      }
      setShowAddModal(false)
      fetchMedications() // Refresh the list
    } catch (err) { 
      setMessage(' Error: ' + err.message) 
      console.error(err)
    }
    setLoading(false)
  }

  const handleOpenRestock = (med) => {
    setRestockingMed(med)
    setRestockData({ quantity: 0, supplier: med.supplier || '', batch_number: '' })
    setShowRestockModal(true)
  }

  const handleConfirmRestock = async (e) => {
    e.preventDefault()
    if (restockData.quantity <= 0) return
    setLoading(true)
    try {
      const newStock = restockingMed.quantity_in_stock + parseInt(restockData.quantity)
      const { error } = await supabase.from('medications').update({
        quantity_in_stock: newStock,
        supplier: restockData.supplier,
        batch_number: restockData.batch_number,
        updated_at: new Date()
      }).eq('id', restockingMed.id)
      
      if (error) throw error
      setMessage(`✅ Restocked ${restockData.quantity} units! New Stock: ${newStock}`)
      setShowRestockModal(false)
      fetchMedications()
    } catch (err) { setMessage('❌ Error: ' + err.message) }
    setLoading(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this medication permanently?')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('medications').delete().eq('id', id)
      if (error) throw error
      setMessage('✅ Deleted!')
      fetchMedications()
    } catch (err) { setMessage('❌ Error: ' + err.message) }
    setLoading(false)
  }

  const inputStyle = { width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px' }
  const labelStyle = { display: 'block', marginBottom: '5px', color: '#333', fontWeight: 'bold', fontSize: '14px' }
  const filteredMeds = medications.filter(med => med.name.toLowerCase().includes(searchTerm.toLowerCase()) || med.category?.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#333', margin: 0 }}> Inventory Management</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleExportCSV} style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>📥 Export to Excel</button>
          <button onClick={handleAddNew} style={{ padding: '10px 20px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>+ Add Medication</button>
        </div>
      </div>

      {message && <div style={{ backgroundColor: message.includes('✅') ? '#dcfce7' : '#fee2e2', color: message.includes('✅') ? '#166534' : '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '25px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '5px solid #3b82f6' }}>
          <div style={{ color: '#666', fontSize: '13px' }}>Total Items</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>{totalItems}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '5px solid #16a34a' }}>
          <div style={{ color: '#666', fontSize: '13px' }}>Total Stock Value</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a' }}>${totalValue.toFixed(2)}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '5px solid #f59e0b' }}>
          <div style={{ color: '#666', fontSize: '13px' }}>Low Stock Alert</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>{lowStockCount}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '5px solid #ef4444' }}>
          <div style={{ color: '#666', fontSize: '13px' }}>Expiring Soon (30 Days)</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444' }}>{expiringSoonCount}</div>
        </div>
      </div>

      <input type="text" placeholder="Search inventory..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ ...inputStyle, maxWidth: '400px', marginBottom: '20px' }} />

      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
          <thead style={{ backgroundColor: '#f9fafb' }}>
            <tr>
              <th style={thStyle}>Medication</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Stock</th>
              <th style={thStyle}>Price</th>
              <th style={thStyle}>Expiry</th>
              <th style={thStyle}>Supplier / Batch</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMeds.map((med) => (
              <tr key={med.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={tdStyle}><div style={{ fontWeight: 'bold' }}>{med.name}</div><div style={{ fontSize: '12px', color: '#666' }}>{med.herb_type}</div></td>
                <td style={tdStyle}>{med.category}</td>
                <td style={tdStyle}>
                  <span style={{ backgroundColor: med.quantity_in_stock <= med.reorder_level ? '#fee2e2' : '#dcfce7', color: med.quantity_in_stock <= med.reorder_level ? '#991b1b' : '#166534', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '13px' }}>
                    {med.quantity_in_stock} {med.unit}
                  </span>
                </td>
                <td style={tdStyle}>${med.unit_price}</td>
                <td style={tdStyle}>{med.expiry_date ? new Date(med.expiry_date).toLocaleDateString() : 'N/A'}</td>
                <td style={tdStyle}><div style={{fontSize: '13px'}}>{med.supplier || '-'}</div><div style={{fontSize: '11px', color: '#666'}}>{med.batch_number || ''}</div></td>
                <td style={tdStyle}>
                  <button onClick={() => handleOpenRestock(med)} style={actionBtnStyle('#3b82f6')}>Restock</button>
                  <button onClick={() => handleEdit(med)} style={actionBtnStyle('#f59e0b')}>Edit</button>
                  <button onClick={() => handleDelete(med.id)} style={actionBtnStyle('#ef4444')}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredMeds.length === 0 && <p style={{ textAlign: 'center', padding: '30px', color: '#666' }}>No medications found.</p>}
      </div>

      {showAddModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h2 style={{ color: '#16a34a', marginTop: 0 }}>{editingMed ? 'Edit Medication' : 'Add New Medication'}</h2>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div><label style={labelStyle}>Name *</label><input name="name" value={formData.name} onChange={handleChange} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Category</label>
                  <select name="category" value={formData.category} onChange={handleChange} style={inputStyle}>
                    <option value="General">General</option><option value="Detox">Detox</option><option value="Immunity">Immunity</option><option value="Digestion">Digestion</option><option value="Skin Care">Skin Care</option><option value="Respiratory">Respiratory</option>
                  </select>
                </div>
                <div><label style={labelStyle}>Type</label>
                  {/* FIXED: Changed herb_type to herbal_type */}
                  <select name="herbal_type" value={formData.herbal_type} onChange={handleChange} style={inputStyle}>
                    <option value="Powder">Powder</option><option value="Capsule">Capsule</option><option value="Tea">Tea</option><option value="Gel">Gel</option><option value="Oil">Oil</option>
                  </select>
                </div>
                <div><label style={labelStyle}>Unit</label>
                  <select name="unit" value={formData.unit} onChange={handleChange} style={inputStyle}>
                    <option value="bottles">Bottles</option><option value="packets">Packets</option><option value="boxes">Boxes</option><option value="jars">Jars</option>
                  </select>
                </div>
                <div><label style={labelStyle}>Initial Stock</label><input type="number" name="quantity_in_stock" value={formData.quantity_in_stock} onChange={handleChange} style={inputStyle} /></div>
                <div><label style={labelStyle}>Reorder Level</label><input type="number" name="reorder_level" value={formData.reorder_level} onChange={handleChange} style={inputStyle} /></div>
                <div><label style={labelStyle}>Unit Price ($)</label><input type="number" step="0.01" name="unit_price" value={formData.unit_price} onChange={handleChange} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Expiry Date</label><input type="date" name="expiry_date" value={formData.expiry_date} onChange={handleChange} style={inputStyle} /></div>
              </div>
              <div><label style={labelStyle}>Supplier</label><input name="supplier" value={formData.supplier} onChange={handleChange} style={inputStyle} /></div>
              <div><label style={labelStyle}>Batch Number</label><input name="batch_number" value={formData.batch_number} onChange={handleChange} style={inputStyle} /></div>
              <div><label style={labelStyle}>Description</label><textarea name="description" value={formData.description} onChange={handleChange} style={{ ...inputStyle, minHeight: '60px' }}></textarea></div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '12px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{loading ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '12px 25px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRestockModal && restockingMed && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h2 style={{ color: '#3b82f6', marginTop: 0 }}>📦 Restock: {restockingMed.name}</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>Current Stock: <strong>{restockingMed.quantity_in_stock} {restockingMed.unit}</strong></p>
            <form onSubmit={handleConfirmRestock}>
              <div><label style={labelStyle}>Quantity to Add *</label><input type="number" name="quantity" value={restockData.quantity} onChange={handleRestockChange} style={inputStyle} required min="1" /></div>
              <div><label style={labelStyle}>Supplier Name</label><input name="supplier" value={restockData.supplier} onChange={handleRestockChange} style={inputStyle} placeholder="e.g. Herbal Farms Ltd" /></div>
              <div><label style={labelStyle}>New Batch Number</label><input name="batch_number" value={restockData.batch_number} onChange={handleRestockChange} style={inputStyle} placeholder="e.g. BATCH-2026-001" /></div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{loading ? 'Updating...' : 'Confirm Restock'}</button>
                <button type="button" onClick={() => setShowRestockModal(false)} style={{ padding: '12px 25px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle = { padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontSize: '14px', color: '#666' }
const tdStyle = { padding: '12px', fontSize: '14px' }
const actionBtnStyle = (color) => ({ padding: '6px 12px', backgroundColor: color, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px', fontSize: '12px', fontWeight: 'bold' })
const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }
const modalContent = { backgroundColor: 'white', padding: '30px', borderRadius: '12px', maxWidth: '600px', width: '90%', maxHeight: '85vh', overflowY: 'auto' }