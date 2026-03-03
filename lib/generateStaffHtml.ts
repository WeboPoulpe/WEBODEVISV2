export interface StaffMission {
  extraName: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  eventType: string;
  clientName: string;
  eventDate: string | null;
  eventLocation: string | null;
  arrivalTime: string | null;
  missionNotes: string | null;
}

const dateFr = (s?: string | null) => {
  if (!s) return '';
  try {
    return new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch {
    return s;
  }
};

const headerGradient = 'background:linear-gradient(135deg,#6a1080 0%,#9c27b0 60%,#ab47bc 100%);';

function staffPage(m: StaffMission): string {
  return `
<div style="font-family:'Georgia',serif;color:#1a1a1a;line-height:1.65;min-height:257mm;page-break-after:always;">

  <!-- Header -->
  <div style="${headerGradient}padding:14mm 20mm 11mm;margin:-20mm -20mm 0;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h1 style="font-size:20px;font-weight:bold;color:white;margin:0 0 3px;">${m.extraName}</h1>
        <p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">${m.role ?? 'Prestataire'}</p>
      </div>
      <div style="text-align:right;">
        <div style="background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.5);color:white;padding:5px 14px;border-radius:5px;font-size:13px;font-weight:bold;letter-spacing:2px;display:inline-block;">FICHE MISSION</div>
      </div>
    </div>
  </div>

  <!-- Infos événement -->
  <div style="display:flex;gap:12px;margin-top:18px;margin-bottom:16px;">
    <div style="flex:1;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:13px;">
      <p style="font-size:9px;font-weight:bold;color:#9c27b0;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 5px;">ÉVÉNEMENT</p>
      <p style="font-size:15px;font-weight:bold;margin:0 0 3px;">${m.eventType || '—'}</p>
      <p style="color:#555;margin:0 0 2px;font-size:12px;">${m.clientName}</p>
      ${m.eventDate ? `<p style="color:#9c27b0;margin:0 0 2px;font-size:12px;font-weight:600;">📅 ${dateFr(m.eventDate)}</p>` : ''}
      ${m.eventLocation ? `<p style="color:#555;margin:0;font-size:12px;">📍 ${m.eventLocation}</p>` : ''}
    </div>
    <div style="flex:0 0 140px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:13px;text-align:center;">
      <p style="font-size:9px;font-weight:bold;color:#9c27b0;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;">HEURE D'ARRIVÉE</p>
      <p style="font-size:28px;font-weight:bold;color:#6a1080;margin:0;">${m.arrivalTime ?? '—'}</p>
    </div>
  </div>

  <!-- Contact -->
  ${m.phone || m.email ? `
  <div style="margin-bottom:14px;padding:10px 14px;background:#fafafa;border-radius:6px;border:1px solid #f0f0f0;font-size:12px;color:#555;">
    ${m.phone ? `📞 ${m.phone}` : ''}${m.phone && m.email ? ' · ' : ''}${m.email ? `✉ ${m.email}` : ''}
  </div>` : ''}

  <!-- Notes de mission -->
  ${m.missionNotes ? `
  <div style="margin-bottom:16px;">
    <p style="font-size:9px;font-weight:bold;color:#9c27b0;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;">NOTES DE MISSION</p>
    <div style="padding:12px 14px;border-left:4px solid #9c27b0;background:#fafafa;border-radius:0 5px 5px 0;font-size:12px;color:#444;white-space:pre-line;line-height:1.6;">${m.missionNotes}</div>
  </div>` : `
  <div style="margin-bottom:16px;padding:12px 14px;border-left:4px solid #e0e0e0;background:#fafafa;border-radius:0 5px 5px 0;font-size:12px;color:#bbb;font-style:italic;">
    Aucune note de mission spécifique.
  </div>`}

  <!-- Signature -->
  <div style="margin-top:32px;display:flex;gap:14px;">
    <div style="flex:1;border:1px solid #e0e0e0;border-radius:8px;padding:12px;min-height:55px;">
      <p style="font-size:9px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">SIGNATURE — Prestataire</p>
      <p style="font-size:10px;color:#bbb;font-style:italic;margin:0;">Date et signature :</p>
    </div>
    <div style="flex:1;border:1px solid #e0e0e0;border-radius:8px;padding:12px;min-height:55px;">
      <p style="font-size:9px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">SIGNATURE — Traiteur</p>
      <p style="font-size:10px;color:#bbb;font-style:italic;margin:0;">Date et signature :</p>
    </div>
  </div>
</div>`;
}

export function generateStaffHtml(missions: StaffMission[]): string {
  return missions.map(staffPage).join('\n').trim();
}
