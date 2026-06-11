import { createClient } from '@supabase/supabase-js';

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function sendError(res, status, message, details = undefined) {
  sendJson(res, status, { ok: false, error: message, details });
}

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON request body.'));
      }
    });
    req.on('error', reject);
  });
}

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function getAdminKey(req) {
  const headerKey = req.headers['x-admin-key'];
  if (Array.isArray(headerKey)) return headerKey[0];
  return headerKey || '';
}

export function requireAdmin(req) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    throw new Error('ADMIN_KEY is not configured in Vercel Environment Variables.');
  }
  const provided = getAdminKey(req);
  if (provided !== expected) {
    const error = new Error('Unauthorized admin request.');
    error.statusCode = 401;
    throw error;
  }
}

export function normalizePromptRecord(raw, index = 0, defaultStatus = 'pending_review') {
  const id = String(raw.id || raw.ID || raw.prompt_id || `PROMPT-${Date.now()}-${index + 1}`).trim();
  const title = String(raw.title || raw.Title || raw.name || raw.Name || `Prompt ${index + 1}`).trim();
  const category = String(raw.category || raw.Category || 'Uploaded Prompts').trim();
  const structure = String(raw.structure || raw.Structure || 'Role-Based').trim();
  const expected_output = String(raw.expected_output || raw.output || raw['Expected Output'] || raw.expectedOutput || 'custom output').trim();
  const department = String(raw.department || raw.Department || 'General').trim();
  const level = String(raw.level || raw.Level || 'Custom').trim();
  const best_use_case = String(raw.best_use_case || raw.useCase || raw['Best Use Case'] || raw.bestUseCase || 'Use for a Dadi prompt task.').trim();
  const placeholders = Array.isArray(raw.placeholders) ? raw.placeholders.join(', ') : String(raw.placeholders || raw.Placeholders || '').trim();
  const tags = Array.isArray(raw.tags) ? raw.tags.join(', ') : String(raw.tags || raw.Tags || '').trim();
  const prompt = String(raw.prompt || raw.Prompt || raw.body || raw.Body || 'Role: Add your role-based system prompt here.').trim();
  const status = String(raw.status || defaultStatus).trim();
  return {
    id,
    title,
    category,
    structure,
    expected_output,
    department,
    level,
    best_use_case,
    placeholders,
    tags,
    prompt,
    status
  };
}

export async function logActivity(supabase, action, details = {}, promptId = null, actor = 'admin') {
  try {
    await supabase.from('prompt_activity_logs').insert({
      prompt_id: promptId,
      actor,
      action,
      details
    });
  } catch {
    // Activity logging should not block the main action.
  }
}
