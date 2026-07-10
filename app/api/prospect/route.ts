import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── CORS helper ──────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token',
};

// Preflight
export function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: corsHeaders });
}

// ── Supabase client (anon key) ───────────────────────────────────────────────
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// ── POST /api/prospect ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── Validate API token ─────────────────────────────────────────────────
    const apiToken = req.headers.get('X-API-Token') || body.token;
    if (!apiToken) {
      return NextResponse.json(
        { error: 'Token manquant.' },
        { status: 401, headers: corsHeaders },
      );
    }

    const supabase = getSupabase();

    // ── Verify token exists and is active ──────────────────────────────────
    const { data: tokenData } = await supabase
      .from('user_prospect_tokens')
      .select('id, user_id, is_active')
      .eq('token', apiToken)
      .maybeSingle();

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Token invalide ou inexistant' },
        { status: 403, headers: corsHeaders },
      );
    }
    if (!tokenData.is_active) {
      return NextResponse.json(
        { error: 'Token désactivé' },
        { status: 403, headers: corsHeaders },
      );
    }

    // ── Verify-only mode (embed page checks token on load) ─────────────────
    if (body._verify) {
      return NextResponse.json(
        { valid: true },
        { status: 200, headers: corsHeaders },
      );
    }

    // ── Validate required fields ───────────────────────────────────────────
    const { first_name, last_name, email } = body;
    if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: 'Champs requis : first_name, last_name, email' },
        { status: 400, headers: corsHeaders },
      );
    }

    // ── Validate email format ──────────────────────────────────────────────
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Format email invalide' },
        { status: 400, headers: corsHeaders },
      );
    }

    // ── Insert prospect request ────────────────────────────────────────────
    const { error } = await supabase.from('prospect_requests').insert({
      first_name:      first_name.trim(),
      last_name:       last_name.trim(),
      email:           email.trim().toLowerCase(),
      phone:           body.phone?.trim() || null,
      address:         body.address?.trim() || null,
      service_address: body.service_address?.trim() || null,
      event_type:      body.event_type || null,
      event_date:      body.event_date || null,
      guest_count:     parseInt(body.guest_count) || null,
      guest_count_children: parseInt(body.guest_count_children) || null,
      message:         body.message?.trim() || null,
      user_token:      apiToken,
      owner_user_id:   tokenData.user_id,
      status:          'nouveau',
    });

    if (error) {
      // On logge le détail côté serveur mais on ne fuit pas le schéma/erreur DB au client.
      console.error('Erreur insertion prospect:', error.message, error.code);
      return NextResponse.json(
        { error: 'Erreur lors de la création de la demande.' },
        { status: 500, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      { success: true, message: 'Demande de devis enregistrée avec succès' },
      { status: 201, headers: corsHeaders },
    );
  } catch (err) {
    console.error('API /api/prospect error:', err);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500, headers: corsHeaders },
    );
  }
}
