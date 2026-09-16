// src/app/login/page.tsx

'use client';

import { useState } from 'react';

const COLORS = {
  navy: '#1B2A4A',
  grey: '#5A6472',
  bg: '#F7F9FB',
  card: '#FFFFFF',
};

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      // Full reload, not client-side nav — middleware needs a real
      // request to see the freshly-set session cookie.
      window.location.href = '/';
    } else {
      const data = await res.json();
      setError(data.error ?? 'Incorrect password');
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLORS.bg,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: 24,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: COLORS.card,
          borderRadius: 16,
          padding: 32,
          width: '100%',
          maxWidth: 360,
          boxShadow: '0 1px 3px rgba(27,42,74,0.08)',
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.navy, marginBottom: 4 }}>(kalm) ops</div>
        <div style={{ fontSize: 13, color: COLORS.grey, marginBottom: 20 }}>Founders only.</div>

        <input
          type="password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #DDE3EA',
            fontSize: 14,
            boxSizing: 'border-box',
            marginBottom: 12,
          }}
        />

        {error && <p style={{ color: '#B23A3A', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            background: COLORS.navy,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
