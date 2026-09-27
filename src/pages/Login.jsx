import { useState } from 'react'
import { supabase } from '../config/supabase'

export default function Login({ deactivatedMsg }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      })
      if (error) throw error
      // If successful, App.jsx will handle the redirect and check if they are deactivated
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)', 
      fontFamily: 'Arial, sans-serif',
      padding: '20px'
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '40px', 
        borderRadius: '16px', 
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)', 
        width: '100%', 
        maxWidth: '400px' 
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}></div>
          <h1 style={{ margin: 0, color: '#16a34a', fontSize: '28px' }}>Al-Haq</h1>
          <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>Herbal Centre HMS</p>
        </div>

        {/* NEW: Deactivation Warning Message */}
        {deactivatedMsg && (
          <div style={{ 
            backgroundColor: '#fee2e2', 
            color: '#991b1b', 
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '20px', 
            fontWeight: 'bold', 
            textAlign: 'center', 
            border: '1px solid #fca5a5',
            fontSize: '14px'
          }}>
            🚫 {deactivatedMsg}
          </div>
        )}

        {/* Standard Error Message */}
        {error && (
          <div style={{ 
            backgroundColor: '#fee2e2', 
            color: '#991b1b', 
            padding: '12px', 
            borderRadius: '8px', 
            marginBottom: '20px', 
            fontSize: '14px',
            textAlign: 'center'
          }}>
            ❌ {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: 'bold', fontSize: '14px' }}>Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required
              style={{ 
                width: '100%', 
                padding: '12px', 
                border: '1px solid #ddd', 
                borderRadius: '8px', 
                fontSize: '16px', 
                boxSizing: 'border-box' 
              }} 
              placeholder="Enter your email"
            />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: 'bold', fontSize: '14px' }}>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required
              style={{ 
                width: '100%', 
                padding: '12px', 
                border: '1px solid #ddd', 
                borderRadius: '8px', 
                fontSize: '16px', 
                boxSizing: 'border-box' 
              }} 
              placeholder="Enter your password"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '14px', 
              backgroundColor: loading ? '#9ca3af' : '#16a34a', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              fontSize: '16px', 
              fontWeight: 'bold', 
              cursor: 'pointer',
              transition: 'background-color 0.3s ease'
            }}
          >
            {loading ? 'Logging in...' : '🔐 Login to Dashboard'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '25px', fontSize: '12px', color: '#9ca3b8' }}>
          © 2026 Al-Haq Herbal Centre. Secure Access Only.
        </p>
      </div>
    </div>
  )
}