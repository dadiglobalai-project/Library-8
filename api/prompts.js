import { sendJson, sendError, readJsonBody, getSupabaseAdmin, normalizePromptRecord, logActivity, getAdminKey } from './_supabase.js';

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseAdmin();

    if (req.method === 'GET') {
      const url = new URL(req.url, `https://${req.headers.host}`);
      const status = url.searchParams.get('status') || 'approved';
      const search = (url.searchParams.get('q') || '').trim();
      const limit = Number(url.searchParams.get('limit') || 1500);
      let query = supabase
        .from('prompts')
        .select('id,title,category,structure,expected_output,department,level,best_use_case,placeholders,tags,prompt,status,created_at,updated_at')
        .eq('status', status)
        .order('category', { ascending: true })
        .order('id', { ascending: true })
        .limit(Math.min(limit, 5000));

      if (search) {
        query = query.or(`title.ilike.%${search}%,category.ilike.%${search}%,prompt.ilike.%${search}%,best_use_case.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return sendJson(res, 200, { ok: true, prompts: data || [] });
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const input = Array.isArray(body) ? body : body.prompts || [body];
      const isAdmin = process.env.ADMIN_KEY && getAdminKey(req) === process.env.ADMIN_KEY;
      const records = input.map((item, index) => normalizePromptRecord(item, index, isAdmin ? 'approved' : 'pending_review'));
      const { data, error } = await supabase
        .from('prompts')
        .upsert(records, { onConflict: 'id' })
        .select('id,title,status');
      if (error) throw error;
      await logActivity(supabase, 'upload_prompts', { count: records.length, admin_upload: isAdmin }, null, isAdmin ? 'admin' : 'contributor');
      return sendJson(res, 200, { ok: true, uploaded: data || [], message: isAdmin ? 'Prompts uploaded and approved.' : 'Prompts submitted for admin review.' });
    }

    return sendError(res, 405, 'Method not allowed.');
  } catch (error) {
    return sendError(res, error.statusCode || 500, 'Prompt API request failed.', error.message);
  }
}
