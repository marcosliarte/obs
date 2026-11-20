/* Mantém o projeto do Supabase ativo.
   No plano gratuito ele é pausado após ~7 dias sem requisições; o cron do
   Vercel (vercel.json) chama esta rota uma vez por dia e faz um SELECT leve. */
const SUPABASE_URL = 'https://lzfkwdirmwcuwgrgiguq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_PeRkBtbqIR4XK5jvkrVz_g_MVVVWYPQ';

module.exports = async (req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/streamkit_config?select=id&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
      cache: 'no-store'
    });
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, supabase: r.status, at: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e && e.message || e), at: new Date().toISOString() });
  }
};
