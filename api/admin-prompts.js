import { sendJson, sendError, readJsonBody, getSupabaseAdmin, requireAdmin, normalizePromptRecord, logActivity } from './_supabase.js';

export default async function handler(req, res) {
  try {
    requireAdmin(req);
    const supabase = getSupabaseAdmin();

    if (req.method === 'GET') {
      const url = new URL(req.url, `https://${req.headers.host}`);
      const status = url.searchParams.get('status');
      let query = supabase
        .from('prompts')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(5000);
      if (status && status !== 'all') query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      return sendJson(res, 200, { ok: true, prompts: data || [] });
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const { id, status } = body;
      if (!id || !status) return sendError(res, 400, 'id and status are required.');
      const allowed = new Set(['draft', 'pending_review', 'approved', 'rejected', 'archived']);
      if (!allowed.has(status)) return sendError(res, 400, 'Invalid prompt status.');
      const { data, error } = await supabase
        .from('prompts')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id,title,status')
        .single();
      if (error) throw error;
      await logActivity(supabase, 'change_status', { status }, id);
      return sendJson(res, 200, { ok: true, prompt: data });
    }

    if (req.method === 'PUT') {
      const body = await readJsonBody(req);
      const record = normalizePromptRecord(body, 0, body.status || 'approved');
      const { data, error } = await supabase
        .from('prompts')
        .upsert(record, { onConflict: 'id' })
        .select('*')
        .single();
      if (error) throw error;
      await logActivity(supabase, 'upsert_prompt', { title: record.title, status: record.status }, record.id);
      return sendJson(res, 200, { ok: true, prompt: data });
    }

    if (req.method === 'DELETE') {
      const body = await readJsonBody(req);
      const { id } = body;
      if (!id) return sendError(res, 400, 'id is required.');
      const { error } = await supabase.from('prompts').delete().eq('id', id);
      if (error) throw error;
      await logActivity(supabase, 'delete_prompt', {}, id);
      return sendJson(res, 200, { ok: true, deleted: id });
    }

    return sendError(res, 405, 'Method not allowed.');
  } catch (error) {
    return sendError(res, error.statusCode || 500, 'Admin prompt API request failed.', error.message);
  }
}
