import { getSupabaseAdmin, requireAdmin, sendError } from './_supabase.js';

function html(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed.');
  try {
    requireAdmin(req);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .order('category', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw error;
    const headers = ['ID', 'Title', 'Category', 'Structure', 'Expected Output', 'Department', 'Level', 'Best Use Case', 'Placeholders', 'Tags', 'Status', 'Prompt'];
    const rows = (data || []).map((p) => [p.id, p.title, p.category, p.structure, p.expected_output, p.department, p.level, p.best_use_case, p.placeholders, p.tags, p.status, p.prompt]);
    const table = `<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>${headers.map((h) => `<th>${html(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((c) => `<td>${html(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dadi-prompt-database-export.xls"');
    res.end(table);
  } catch (error) {
    return sendError(res, error.statusCode || 500, 'Export failed.', error.message);
  }
}
