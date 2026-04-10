'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

// ── Embeddable quote request form ────────────────────────────────────────────
// Usage: <iframe src="https://yourapp.vercel.app/embed/TOKEN?accent=ff6600&bg=1a1a1a&radius=12" />
//
// Query params for customization:
//   accent  = hex color without # (default: 9c27b0)
//   bg      = background hex without # (default: ffffff)
//   text    = text color hex without # (default: 1a1a1a)
//   radius  = border radius in px (default: 12)
//   font    = font family (default: system-ui)
//   title   = form title (default: Demande de devis)
//   dark    = 1 for dark mode preset

const EVENT_TYPES = ['Mariage', 'Cocktail', 'Anniversaire', 'Séminaire', 'Gala', 'Communion', 'Baptême', 'Autre'];

export default function EmbedForm() {
  const { token } = useParams<{ token: string }>();
  const sp = useSearchParams();

  // ── Theme from query params ──────────────────────────────────────────────
  const isDark = sp.get('dark') === '1';
  const accent = `#${sp.get('accent') || (isDark ? 'ff6600' : '9c27b0')}`;
  const bg = `#${sp.get('bg') || (isDark ? '0f0f0f' : 'ffffff')}`;
  const textColor = `#${sp.get('text') || (isDark ? 'e5e5e5' : '1a1a1a')}`;
  const radius = parseInt(sp.get('radius') || '12');
  const fontFamily = sp.get('font') || 'system-ui, -apple-system, sans-serif';
  const title = sp.get('title') || 'Demande de devis';

  const inputBg = isDark ? '#1a1a1a' : '#f9fafb';
  const inputBorder = isDark ? '#333' : '#e5e7eb';
  const labelColor = isDark ? '#aaa' : '#6b7280';
  const cardBg = isDark ? '#141414' : '#ffffff';
  const successBg = isDark ? '#0a2e1a' : '#ecfdf5';
  const successText = isDark ? '#4ade80' : '#065f46';

  // ── State ────────────────────────────────────────────────────────────────
  const [valid, setValid] = useState<boolean | null>(null);
  const [stage, setStage] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [message, setMessage] = useState('');

  // ── Verify token ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch(`/api/prospect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, _verify: true }),
    }).catch(() => null);
    // For now just show the form — the API will validate on submit
    setValid(true);
    setStage('form');
  }, [token]);

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('Prénom, nom et email sont requis.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          service_address: serviceAddress.trim() || null,
          event_type: eventType || null,
          event_date: eventDate || null,
          guest_count: guestCount || null,
          message: message.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'envoi');
      } else {
        setStage('success');
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    }
    setSubmitting(false);
  };

  // ── Styles ───────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    fontSize: '14px',
    fontFamily,
    color: textColor,
    background: inputBg,
    border: `1px solid ${inputBorder}`,
    borderRadius: radius * 0.6,
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: labelColor,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const btnStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    fontSize: '15px',
    fontWeight: 700,
    fontFamily,
    color: '#fff',
    background: accent,
    border: 'none',
    borderRadius: radius * 0.6,
    cursor: submitting ? 'wait' : 'pointer',
    opacity: submitting ? 0.7 : 1,
    transition: 'opacity 0.2s, transform 0.1s',
  };

  if (stage === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200, background: bg, fontFamily }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${inputBorder}`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (stage === 'success') {
    return (
      <div style={{ background: bg, fontFamily, padding: 40, textAlign: 'center', minHeight: 200 }}>
        <div style={{ background: successBg, borderRadius: radius, padding: '32px 24px', maxWidth: 400, margin: '0 auto' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>&#10003;</div>
          <h2 style={{ color: successText, fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Demande envoyée !</h2>
          <p style={{ color: successText, fontSize: 14, margin: 0, opacity: 0.8 }}>
            Nous reviendrons vers vous rapidement.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: bg, fontFamily, padding: '16px 16px 24px', minHeight: '100%' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; background: ${bg}; }
        input:focus, select:focus, textarea:focus { border-color: ${accent} !important; box-shadow: 0 0 0 3px ${accent}22; }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2 style={{ color: textColor, fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>{title}</h2>
        <p style={{ color: labelColor, fontSize: 13 }}>Remplissez le formulaire ci-dessous</p>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 520, margin: '0 auto' }}>
        {/* Name row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Prénom *</label>
            <input style={inputStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" required />
          </div>
          <div>
            <label style={labelStyle}>Nom *</label>
            <input style={inputStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" required />
          </div>
        </div>

        {/* Email + Phone */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Email *</label>
            <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@email.com" required />
          </div>
          <div>
            <label style={labelStyle}>Téléphone</label>
            <input style={inputStyle} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" />
          </div>
        </div>

        {/* Event type + Date + Guests */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Type d&#39;événement</label>
            <select style={inputStyle} value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="">— Choisir —</option>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input style={inputStyle} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Couverts</label>
            <input style={inputStyle} type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} placeholder="80" />
          </div>
        </div>

        {/* Addresses */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Adresse</label>
            <input style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Votre adresse" />
          </div>
          <div>
            <label style={labelStyle}>Lieu de la prestation</label>
            <input style={inputStyle} value={serviceAddress} onChange={(e) => setServiceAddress(e.target.value)} placeholder="Lieu de l'événement" />
          </div>
        </div>

        {/* Message */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Message</label>
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Décrivez votre projet..."
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: isDark ? '#3b1111' : '#fef2f2', color: isDark ? '#fca5a5' : '#991b1b', padding: '10px 14px', borderRadius: radius * 0.6, fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={submitting} style={btnStyle}>
          {submitting ? 'Envoi en cours...' : 'Envoyer ma demande'}
        </button>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 10, color: labelColor, marginTop: 12, opacity: 0.6 }}>
          Propulsé par WeboDevis
        </p>
      </form>
    </div>
  );
}
