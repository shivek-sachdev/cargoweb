'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SimpleLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMessage('Attempting to log in...');

    try {
      console.log("Login attempt with:", email);

      // Try login with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      console.log("Supabase login response:", data, error);

      if (error) {
        console.error("Supabase login error:", error);
        setMessage(`Error: ${error.message}`);
        return;
      }

      // Even if Supabase login worked, we'll create our own session
      setMessage('Login successful! Setting up session and redirecting...');

      // Create a manual session in localStorage
      const manualSession = {
        email: email,
        isAuthenticated: true,
        timestamp: new Date().toISOString()
      };

      localStorage.setItem('manual_session', JSON.stringify(manualSession));
      console.log("Manual session created:", manualSession);

      // Wait a moment for dramatic effect
      setTimeout(() => {
        window.location.href = '/quotations';
      }, 1000);

    } catch (err: unknown) {
      console.error("Login error:", err);
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
      <h1 style={{ marginBottom: '20px' }}>OMGEXP Login</h1>

      {message && (
        <div style={{
          padding: '10px',
          marginBottom: '20px',
          background: message.includes('Error') ? '#ffdddd' : '#ddffdd',
          border: '1px solid',
          borderColor: message.includes('Error') ? '#ff0000' : '#00ff00'
        }}>
          {message}
        </div>
      )}

      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>

        <button
          type="submit"
          style={{
            width: '100%',
            padding: '10px',
            background: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '10px'
          }}
        >
          Login
        </button>

        <div>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            style={{
              background: 'none',
              border: 'none',
              color: '#4285f4',
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: '5px 0',
              fontSize: '14px'
            }}
          >
            {showHelp ? 'Hide help' : 'Need help?'}
          </button>
        </div>

        {showHelp && (
          <div style={{
            marginTop: '15px',
            padding: '10px',
            background: '#f5f5f5',
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            <p><strong>If you&apos;ve registered:</strong> Use the email and password you registered with.</p>
            <p><strong>If you don&apos;t have an account:</strong> You need to register first. This simple login should work with any account you&apos;ve registered with Supabase.</p>
            <p style={{ marginTop: '10px', color: '#666' }}>
              Note: This login uses a direct method that should work even if there are issues with the regular login system.
            </p>
          </div>
        )}
      </form>
    </div>
  );
} 