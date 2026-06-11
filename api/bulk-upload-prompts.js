import { sendJson, sendError, readJsonBody, getSupabaseAdmin, requireAdmin, normalizePromptRecord, logActivity } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed.');
  try {
    requireAdmin(req);
    const body = await readJsonBody(req);
    const input = Array.isArray(body) ? body : body.prompts;
    if (!Array.isArray(input)) return sendError(res, 400, 'Request body must be an array or { prompts: [] }.');
    const supabase = getSupabaseAdmin();
    const records = input.map((item, index) => normalizePromptRecord(item, index, 'approved'));
    const chunkSize = 250;
    let total = 0;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const { error } = await supabase.from('prompts').upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
      total += chunk.length;
    }
    await logActivity(supabase, 'bulk_upload_prompts', { count: total });
    return sendJson(res, 200, { ok: true, count: total });
  } catch (error) {
    return sendError(res, error.statusCode || 500, 'Bulk upload failed.', error.message);
  }
}
