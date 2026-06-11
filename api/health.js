import { sendJson, sendError, getSupabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed.');
  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase.from('prompts').select('id', { count: 'exact', head: true });
    if (error) throw error;
    return sendJson(res, 200, { ok: true, database: 'connected', prompt_count: count || 0 });
  } catch (error) {
    return sendError(res, 500, 'Backend health check failed.', error.message);
  }
}
