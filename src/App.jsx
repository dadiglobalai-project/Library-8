import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE = {
  uploaded: "dadi_uploaded_prompts_v8",
  favorites: "dadi_favorite_prompts_v8",
  recent: "dadi_recent_prompts_v8",
  theme: "dadi_theme_v8",
  history: "dadi_optimizer_history_v8",
  drops: "dadi_weekly_drops_v8",
  adminKey: "dadi_backend_admin_key_v8"
};

const quickCards = [
  ["Match Task Type", "Search by the work output you need, such as meeting minutes, proposal, poster prompt, SOP, KPI report, or teacher evaluation."],
  ["Fill Placeholders", "Replace bracketed fields like [Source Material], [Target Audience], [Program Name], [Deadline], and [Required Output]."],
  ["Attach Real Materials", "Paste real notes, screenshots, drafts, policies, metrics, or meeting records so ChatGPT does not guess company details."],
  ["Verify Draft Integrity", "Check accuracy, privacy, confidentiality, tone, formatting, and business commitments before official use."],
  ["Iterate and Revise", "When the first output is weak, ask for stricter structure, clearer audience, better examples, or stronger source alignment."],
  ["Protect Internal Data", "Never paste private student data, credentials, payment details, or confidential partner terms into public AI tools."]
];

const assistantSamples = [
  "Find a prompt for meeting minutes.",
  "Create a system prompt for teacher evaluation.",
  "Draft a prompt for a school partnership proposal.",
  "Improve my prompt about employee productivity."
];

const improvementTips = {
  RTCF: "Role, Task, Context, Format",
  RTF: "Role, Task, Format",
  CRAFT: "Context, Role, Action, Format, Tone",
  RISEN: "Role, Instructions, Steps, End goal, Narrowing constraints",
  TAG: "Task, Audience, Goal",
  "Role-Task-Output-Constraint": "Role, Task, Output, Constraint"
};

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors.
  }
}

function normalizePrompt(raw, index = 0, prefix = "UP") {
  const prompt = raw.prompt || raw.Prompt || raw.body || raw.Body || "Role: Add your role-based prompt here.";
  const id = String(raw.id || raw.ID || raw.code || raw.Code || `${prefix}-${Date.now()}-${index + 1}`).trim();
  const title = raw.title || raw.Title || raw.name || raw.Name || `Uploaded Prompt ${index + 1}`;
  const category = raw.category || raw.Category || "Uploaded Prompts";
  const structure = raw.structure || raw.Structure || "Role-Based";
  const output = raw.output || raw.expected_output || raw["Expected Output"] || raw.expectedOutput || raw.ExpectedOutput || "custom output";
  const useCase = raw.useCase || raw.best_use_case || raw["Best Use Case"] || raw.bestUseCase || raw.UseCase || "Use for a custom Dadi prompt task.";
  const department = raw.department || raw.Department || "General";
  const level = raw.level || raw.Level || "Custom";
  const placeholders = raw.placeholders || raw.Placeholders || extractPlaceholders(prompt).join(", ");
  const tags = raw.tags || raw.Tags || "custom";
  return {
    id,
    title,
    category,
    structure,
    output,
    useCase,
    department,
    level,
    placeholders,
    prompt,
    tags,
    status: raw.status || raw.Status || "approved"
  };
}

function extractPlaceholders(text = "") {
  return Array.from(new Set((text.match(/\[[^\]]+\]/g) || []).map((x) => x.trim())));
}

function scorePrompt(text = "", context = "", audience = "", format = "", focus = "") {
  let score = 36;
  if (/role\s*:/i.test(text)) score += 12;
  if (/task\s*:/i.test(text) || text.length > 80) score += 12;
  if (/context\s*:/i.test(text) || context) score += 10;
  if (/format\s*:/i.test(text) || format) score += 9;
  if (audience) score += 7;
  if (focus) score += 6;
  if (/do not invent|verify|confidential|source/i.test(text)) score += 6;
  if (extractPlaceholders(text).length > 0) score += 4;
  return Math.min(99, score);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inside = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inside && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inside = !inside;
    } else if (char === "," && !inside) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inside) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (cells[i] || "").trim();
    });
    return obj;
  });
}

function downloadFile(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function exportExcel(prompts) {
  const headers = ["ID", "Title", "Category", "Structure", "Expected Output", "Department", "Level", "Best Use Case", "Placeholders", "Prompt"];
  const rows = prompts.map((p) => [p.id, p.title, p.category, p.structure, p.output, p.department, p.level, p.useCase, p.placeholders, p.prompt]);
  const table = `<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
  downloadFile("dadi-prompt-library-export.xls", "application/vnd.ms-excel;charset=utf-8", table);
}

function makeWeeklyDrops(week = 25) {
  const items = [
    ["Bilingual Summer Camp Curriculum Planner", "Course Development and Lesson Planning", "CRAFT", "a complete summer camp syllabus with active gamified milestones", "Role: You are a senior Curriculum Specialist at Dadi Coach.\nTask: Create a bilingual summer camp syllabus for [Theme] targeting [Age Group] students.\nContext: Leverage active physical plays representing [Vocabulary Focus] terms over [Duration] days.\nConstraints: Output must alternate between sitting projects and active sports.\nExpected Output: Table format of daily goals."],
    ["Weekly WeCom Parent Update Compiler", "Internal Communication and WeCom Messages", "Role-Task-Context-Format", "a bilingual parent update", "Role: You are a warm Bilingual Class Coordinator at Dadi School.\nTask: Draft our weekly update message regarding [Weekly Topic].\nContext: Let parents know we practiced [Core Vocabulary] and saw outcomes in [Achievement Spotlights].\nFormat: Friendly WeCom message with bullet points and emojis."],
    ["AI Tool Test Report Builder", "AI Tool Research and Testing", "Audit-Insight-Action", "tool test matrix with recommendations", "Role: You are a Dadi AI Tool Evaluation Lead.\nTask: Evaluate [Tool Name] for [Workflow].\nContext: Test against cost, accuracy, privacy, output quality, and employee usability.\nFormat: Produce a scored table, implementation recommendation, and risk notes."],
    ["Partner School Onboarding Checklist", "Dadi 212 In-School Program", "SOP Builder", "step-by-step onboarding checklist", "Role: You are a Dadi 212 Onboarding Manager.\nTask: Create an onboarding checklist for [Partner School].\nContext: Include school confirmation, schedule setup, teacher training, CRM tracking, and parent communication.\nFormat: Checklist with owner, deadline, and evidence."],
    ["Prompt Quality Audit Card", "Prompt Engineering and Prompt Audit", "Quality Review Matrix", "bad/good/great prompt review", "Role: You are a Dadi Prompt Quality Auditor.\nTask: Review [Employee Prompt] and classify it as Bad, Good, or Great.\nContext: Use standards for role clarity, source material, output format, constraints, and business safety.\nFormat: Scorecard plus improved prompt."],
    ["Teacher Demo Class Feedback", "Class Observation and Teacher Evaluation", "Diagnostic-Plan-Deliver", "teacher evaluation report", "Role: You are a Dadi ESL Teacher Evaluation Coach.\nTask: Evaluate [Class Notes or Transcript].\nContext: Review pacing, engagement, material use, interaction, and correction strategy.\nFormat: Strengths, improvements, teaching method review, and action plan."],
    ["School Owner Objection Response", "Lead Follow-Up and Conversion Support", "Problem-Solution-Checklist", "objection handling script", "Role: You are a Dadi Business Development Coach.\nTask: Respond to a school owner concerned about [Objection].\nContext: Keep the reply factual, respectful, and focused on partnership value.\nFormat: Short reply, detailed reply, and next-step message."],
    ["Monthly KPI Reflection Builder", "KPI Reporting and Work Reflection", "Data-to-Decision", "monthly reflection draft", "Role: You are a Dadi KPI Reflection Specialist.\nTask: Convert [Monthly Accomplishments] into a professional work reflection.\nContext: Include evidence, output quality, blockers, improvements, and next-month goals.\nFormat: Executive summary with bullet points."],
    ["Poster Prompt Generator", "Image Generation and Poster Design", "Context-Action-Format", "image generation prompt", "Role: You are a Dadi visual prompt engineer.\nTask: Create an image-generation prompt for [Poster Topic].\nContext: Use Dadi green, yellow, orange, and white branding with a premium educational corporate style.\nFormat: Scene, layout, text blocks, lighting, style, aspect ratio, and quality controls."],
    ["Meeting Decision Tracker", "Meeting Minutes and Decision Logs", "Workflow Mapping", "decision and action tracker", "Role: You are a Dadi Meeting Documentation Specialist.\nTask: Turn [Meeting Notes] into a decision log and action tracker.\nContext: Capture topics, decisions, owner, deadline, unresolved issues, and follow-up proof.\nFormat: Table plus concise summary."],
    ["CRM Data Cleanup Plan", "CRM Lead Research and Database Quality", "Audit-Insight-Action", "CRM cleanup checklist", "Role: You are a Dadi CRM Quality Analyst.\nTask: Audit [CRM Data] for missing fields, duplicates, weak lead notes, and unclear follow-up stages.\nContext: Prioritize high-value school leads.\nFormat: Issue table and correction plan."],
    ["Business Proposal Executive Summary", "Business Proposal Development", "Executive Brief", "proposal summary", "Role: You are a Dadi Business Proposal Strategist.\nTask: Summarize [Proposal Draft] for decision makers.\nContext: Emphasize partnership value, operating model, responsibilities, benefits, risks, and approval points.\nFormat: One-page executive summary."],
    ["Video Script Storyboard Planner", "Video Script Writing", "Scenario-Based Advisor", "video script and storyboard", "Role: You are a Dadi Educational Video Producer.\nTask: Create a short video script for [Program/Topic].\nContext: Explain the value clearly to [Target Audience].\nFormat: Hook, scenes, visuals, voiceover, subtitles, and call-to-action."],
    ["Bilingual Document Localizer", "Translation and Localization", "Source-Alignment Editor", "English-Chinese two-column text", "Role: You are a Dadi bilingual localization editor.\nTask: Translate and localize [Source Material].\nContext: Preserve meaning, business tone, program terms, and formatting.\nFormat: English and Simplified Chinese side-by-side table."],
    ["Internal SOP Builder", "SOP, Manual, and Training Guide Creation", "SOP Builder", "clear operating procedure", "Role: You are a Dadi SOP Documentation Architect.\nTask: Create an SOP for [Process Name].\nContext: Include purpose, scope, tools, steps, owner, frequency, output standard, and quality checks.\nFormat: Internal-use SOP with approval notes."]
  ];
  return items.map((item, idx) => ({
    id: `W${week}-${String(idx + 1).padStart(2, "0")}`,
    title: item[0],
    category: item[1],
    structure: item[2],
    output: item[3],
    department: "Weekly Drop",
    level: "Advanced",
    useCase: `Weekly drop prompt for ${item[1].toLowerCase()}.`,
    placeholders: extractPlaceholders(item[4]).join(", "),
    prompt: item[4],
    tags: `week-${week}, weekly-drop, premium`
  }));
}

function buildImprovedPrompt({ original, context, audience, outputFormat, tone, focus, extra }) {
  const role = focus ? `You are a senior ${focus} specialist at Dadi Coach Corporation.` : "You are a senior Dadi Coach Corporation AI work-output specialist.";
  const task = original || "Complete the requested company task with clear structure and practical recommendations.";
  return `Role: ${role}\n\nTask: ${task}\n\nContext: ${context || "Use the provided source material, current company workflow, target audience, deadlines, and operational constraints. Do not invent missing facts."}\n\nAudience: ${audience || "Dadi Coach employees, leaders, or approved business stakeholders."}\n\nRequirements:\n1. Identify the exact purpose and expected work output.\n2. Extract only source-based facts and mark unclear items as [Needs Confirmation].\n3. Organize the response into logical sections with clear labels.\n4. Include actionable next steps, owners, deadlines, risks, and review checkpoints when relevant.\n5. Use a ${tone || "professional, clear, management-ready"} tone.\n6. Focus on accuracy, clarity, structure, usability, and business safety.\n${extra ? `7. Additional instruction: ${extra}\n` : ""}\nFormat: Use ${outputFormat || "RTCF (Role, Task, Context, Format)"}. End with a short quality-check list before final use.`;
}

function analyzeImprovement(original, improved, context, audience, outputFormat, focus) {
  const base = scorePrompt(original, context, audience, outputFormat, focus);
  const score = Math.min(99, Math.max(base + 8, scorePrompt(improved, context, audience, outputFormat, focus)));
  const cards = [
    ["Clarity", original ? "Clarified the task purpose, audience, and expected result so the AI has less room to guess." : "Added a clearer task statement and direct work objective.", Math.min(99, 56 + (original.length > 70 ? 10 : 4) + (focus ? 12 : 0))],
    ["Structure", `Converted the prompt into ${outputFormat || "a role-based framework"} with Role, Task, Context, Requirements, and Format sections.`, Math.min(99, 62 + (/role\s*:/i.test(improved) ? 12 : 0) + (/format\s*:/i.test(improved) ? 12 : 0))],
    ["Context", context ? "Integrated the supplied work context and required source alignment." : "Added source-material placeholders and no-invention rules for missing facts.", Math.min(96, 52 + (context ? 22 : 7) + (audience ? 10 : 0))],
    ["Actionability", "Added practical requirements, review checkpoints, and output standards that are easier for employees to follow.", Math.min(97, 55 + (/requirements\s*:/i.test(improved) ? 18 : 0) + (/next|review|owner|deadline/i.test(improved) ? 14 : 0))],
    ["Safety", "Added fact-checking, confidentiality, and human-review instructions before official company use.", Math.min(99, 58 + (/do not invent|verify|confidential|source/i.test(improved) ? 24 : 6))]
  ];
  return { score, cards };
}

function tokenizeQuery(text = "") {
  const stop = new Set(["a", "an", "the", "for", "to", "of", "and", "or", "in", "on", "with", "about", "please", "can", "you", "me", "i", "need", "want", "find", "create", "make", "prompt", "system"]);
  return String(text).toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));
}

function scorePromptMatch(prompt, query) {
  const tokens = tokenizeQuery(query);
  const combined = `${prompt.title} ${prompt.category} ${prompt.structure} ${prompt.output} ${prompt.useCase} ${prompt.prompt}`.toLowerCase();
  let score = 0;
  tokens.forEach((token) => {
    if (String(prompt.title).toLowerCase().includes(token)) score += 14;
    if (String(prompt.category).toLowerCase().includes(token)) score += 9;
    if (String(prompt.useCase).toLowerCase().includes(token)) score += 7;
    if (String(prompt.prompt).toLowerCase().includes(token)) score += 3;
    if (combined.includes(token)) score += 1;
  });
  const q = query.toLowerCase();
  if (/meeting|minutes|recap|agenda|decision/.test(q) && /meeting|minutes|decision|agenda|recap/i.test(`${prompt.title} ${prompt.category}`)) score += 24;
  if (/teacher|class|evaluation|teaching|student/.test(q) && /teacher|class|student|teaching|course/i.test(`${prompt.title} ${prompt.category}`)) score += 20;
  if (/poster|image|visual|design|infographic/.test(q) && /poster|image|visual|design|content/i.test(`${prompt.title} ${prompt.category}`)) score += 20;
  if (/proposal|business|partner|partnership|school owner/.test(q) && /proposal|business|partner|crm|lead/i.test(`${prompt.title} ${prompt.category}`)) score += 20;
  if (/work plan|task|productivity|priority|kpi|report/.test(q) && /work|task|kpi|report|progress/i.test(`${prompt.title} ${prompt.category}`)) score += 20;
  return score;
}

function findBestPrompts(prompts, query, limit = 5) {
  return prompts
    .map((p) => ({ ...p, matchScore: scorePromptMatch(p, query) }))
    .filter((p) => p.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore || String(a.title).localeCompare(String(b.title)))
    .slice(0, limit);
}

function inferRoleFromQuery(query = "") {
  const q = query.toLowerCase();
  if (/teacher|class|student|teaching|lesson/.test(q)) return "Dadi ESL Teaching Evaluation and Training Specialist";
  if (/proposal|partner|partnership|school owner|franchise/.test(q)) return "Dadi Business Development and Partnership Strategy Specialist";
  if (/poster|image|visual|design|infographic/.test(q)) return "Dadi Visual Communication and Prompt Design Specialist";
  if (/video|script|storyboard/.test(q)) return "Dadi Educational Video Script and Production Specialist";
  if (/kpi|reflection|report|performance/.test(q)) return "Dadi KPI Reporting and Performance Analysis Specialist";
  if (/meeting|minutes|agenda|decision/.test(q)) return "Dadi Meeting Documentation and Decision Log Specialist";
  if (/crm|lead|database|outreach/.test(q)) return "Dadi CRM Lead Research and Outreach Quality Specialist";
  return "Dadi Coach Corporation Work Output Specialist";
}

function makeAssistantDraft(query = "") {
  const role = inferRoleFromQuery(query);
  const cleanTask = query.replace(/^(create|make|draft|write|build|generate)\s+/i, "").trim() || "complete the requested Dadi task";
  return `Role: You are a ${role}.\n\nTask: ${cleanTask.charAt(0).toUpperCase() + cleanTask.slice(1)}.\n\nContext: Use [Source Material], [Department Context], [Target Audience], [Program Name], [Country], [Deadline], and [Required Output]. Do not invent facts, numbers, policies, prices, partner details, or student information.\n\nRequirements:\n1. Clarify the purpose and intended reader.\n2. Extract only source-based information and mark unclear details as [Needs Confirmation].\n3. Organize the output into clear sections with practical next steps.\n4. Include quality checks, risks, and human-review reminders.\n5. Keep the tone professional, concise, and suitable for Dadi Coach Corporation use.\n\nFormat: Provide a structured, copy-ready output with headings, tables when useful, and a final review checklist.`;
}

function answerAssistantQuestion(text, prompts) {
  const q = text.trim();
  const lower = q.toLowerCase();
  if (!q) return "Please type a task, topic, or rough prompt first.";
  if (/^(hi|hello|hey|good morning|good afternoon)\b/.test(lower)) {
    return "Hello. I can help you find the best prompt template, draft a new role-based system prompt, improve a weak prompt, or explain how to use the library. Try asking: 'Find a prompt for meeting minutes' or 'Create a system prompt for teacher evaluation.'";
  }
  if (/how.*(upload|add)/.test(lower)) {
    return "Open Upload Prompts, then upload a CSV or JSON file. Useful columns are Title, Category, Structure, Expected Output, Best Use Case, and Prompt. Uploaded prompts are saved in this browser unless backend access is configured.";
  }
  if (/how.*(download|export)|excel|xls/.test(lower)) {
    return "Click Download All Prompts in the top navigation to export the active library as an Excel-compatible .xls file.";
  }
  if (/improve|optimize|fix|rewrite/.test(lower) && lower.length > 18) {
    return `Use the Improve Prompt page for scoring and a breakdown. Stronger starting version:\n\n${makeAssistantDraft(q)}\n\nNext step: click Improve Prompt to score and refine it.`;
  }
  const matches = findBestPrompts(prompts, q, 6);
  if (matches.length) {
    const list = matches.map((p, i) => `${i + 1}. ${p.title} - ${p.category} (${p.structure})`).join("\n");
    const best = matches[0];
    const bestPreview = best.prompt.length > 600 ? `${best.prompt.slice(0, 600)}...` : best.prompt;
    return `Recommended prompts:\n\n${list}\n\nBest starting choice: ${best.title}\nWhy: It most closely matches your task keywords and belongs to ${best.category}.\n\nCopy-ready preview:\n${bestPreview}\n\nTip: Open Prompt Library and search "${tokenizeQuery(q).slice(0, 3).join(" ") || q}" to view and customize it.`;
  }
  return `I could not find an exact library match, so here is a custom role-based system prompt you can use:\n\n${makeAssistantDraft(q)}`;
}

function App() {
  const initialPage = window.location.pathname === "/admin" ? "admin" : "library";
  const [page, setPageState] = useState(initialPage);
  const [theme, setTheme] = useState(readStorage(STORAGE.theme, "green"));
  const [basePrompts, setBasePrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [uploaded, setUploaded] = useState(readStorage(STORAGE.uploaded, []));
  const [favorites, setFavorites] = useState(readStorage(STORAGE.favorites, []));
  const [recent, setRecent] = useState(readStorage(STORAGE.recent, []));
  const [history, setHistory] = useState(readStorage(STORAGE.history, []));
  const [drops, setDrops] = useState(readStorage(STORAGE.drops, []));
  const [optimizerSeed, setOptimizerSeed] = useState("");

  function setPage(nextPage) {
    if (nextPage === "admin") {
      window.history.pushState({}, "", "/admin");
    } else if (window.location.pathname === "/admin") {
      window.history.pushState({}, "", "/");
    }
    setPageState(nextPage);
  }

  useEffect(() => {
    async function loadPrompts() {
      try {
        const apiRes = await fetch(`/api/prompts?status=approved&cache=${Date.now()}`);
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          const apiList = Array.isArray(apiData) ? apiData : apiData.prompts || [];
          if (apiList.length > 0) {
            setBasePrompts(apiList.map((p, i) => normalizePrompt(p, i, "DB")));
            setLoading(false);
            return;
          }
        }
      } catch {
        // Optional backend is not required for the public library.
      }
      try {
        const res = await fetch(`/prompts.json?cache=${Date.now()}`);
        if (!res.ok) throw new Error("Unable to load public/prompts.json");
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.prompts || [];
        setBasePrompts(list.map((p, i) => normalizePrompt(p, i, "BASE")));
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadPrompts();
  }, []);

  useEffect(() => writeStorage(STORAGE.theme, theme), [theme]);
  useEffect(() => writeStorage(STORAGE.uploaded, uploaded), [uploaded]);
  useEffect(() => writeStorage(STORAGE.favorites, favorites), [favorites]);
  useEffect(() => writeStorage(STORAGE.recent, recent), [recent]);
  useEffect(() => writeStorage(STORAGE.history, history), [history]);
  useEffect(() => writeStorage(STORAGE.drops, drops), [drops]);

  const allPrompts = useMemo(() => [...drops, ...uploaded, ...basePrompts], [basePrompts, uploaded, drops]);
  const categories = useMemo(() => {
    const counts = new Map();
    allPrompts.forEach((p) => counts.set(p.category, (counts.get(p.category) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allPrompts]);
  const structures = useMemo(() => Array.from(new Set(allPrompts.map((p) => p.structure).filter(Boolean))).sort(), [allPrompts]);

  function toggleFavorite(id) {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function markRecent(id) {
    setRecent((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 12));
  }
  function copyText(text, id) {
    navigator.clipboard.writeText(text);
    if (id) markRecent(id);
  }
  function installDrops() {
    const current = makeWeeklyDrops(25);
    const existing = new Set(drops.map((p) => p.id));
    setDrops([...drops, ...current.filter((p) => !existing.has(p.id))]);
  }
  function saveOptimizedPrompt(promptText, title = "Optimized Prompt") {
    const newPrompt = normalizePrompt({
      id: `OPT-${Date.now()}`,
      title,
      category: "Saved Optimized Prompts",
      structure: "Role-Based Optimized",
      output: "custom optimized output",
      department: "User Saved",
      level: "Custom",
      useCase: "Saved from the Prompt Improvement Studio.",
      prompt: promptText,
      tags: "optimized, saved"
    }, uploaded.length, "OPT");
    setUploaded((prev) => [newPrompt, ...prev]);
    setPage("library");
  }

  return (
    <div className={`app theme-${theme}`}>
      <Header page={page} setPage={setPage} theme={theme} setTheme={setTheme} onDownload={() => exportExcel(allPrompts)} total={allPrompts.length} />
      <main className="shell">
        {loading && <StateCard title="Loading prompt library" body="Preparing the Dadi prompt database..." />}
        {loadError && <StateCard title="Prompt data could not load" body={loadError} />}
        {!loading && !loadError && page === "guide" && <QuickGuide total={allPrompts.length} />}
        {!loading && !loadError && page === "library" && <PromptLibrary prompts={allPrompts} categories={categories} structures={structures} favorites={favorites} toggleFavorite={toggleFavorite} copyText={copyText} setPage={setPage} setOptimizerSeed={setOptimizerSeed} recent={recent} installDrops={installDrops} drops={drops} />}
        {!loading && !loadError && page === "assistant" && <PromptAssistant prompts={allPrompts} setPage={setPage} setOptimizerSeed={setOptimizerSeed} />}
        {!loading && !loadError && page === "improve" && <PromptImprover seed={optimizerSeed} setSeed={setOptimizerSeed} savePrompt={saveOptimizedPrompt} history={history} setHistory={setHistory} />}
        {!loading && !loadError && page === "upload" && <UploadPrompts uploaded={uploaded} setUploaded={setUploaded} allPrompts={allPrompts} />}
        {!loading && !loadError && page === "admin" && <AdminAccessPanel allPrompts={allPrompts} setPage={setPage} />}
      </main>
      <Footer />
    </div>
  );
}

function Header({ page, setPage, theme, setTheme, onDownload, total }) {
  const nav = [
    ["guide", "Quick Guide", "book"],
    ["library", "Prompt Library", "cards"],
    ["assistant", "Prompt Assistant", "chat"],
    ["improve", "Improve Prompt", "sliders"],
    ["upload", "Upload Prompts", "upload"]
  ];
  return (
    <header className="topbar">
      <div className="brandBlock" onClick={() => setPage("library")}>
        <img src="/dadi-coach-logo.png" alt="Dadi Coach Logo" className="brandLogo" />
        <div className="brandCopy"><strong>Prompt Library</strong><span>Internal AI templates</span></div>
      </div>
      <nav className="mainNav">
        {nav.map(([key, label, icon]) => <button key={key} className={page === key ? "navActive" : ""} onClick={() => setPage(key)}><Icon name={icon} />{label}</button>)}
      </nav>
      <div className="topActions">
        <button className="downloadBtn" onClick={onDownload}><Icon name="download" />Download All Prompts</button>
        <div className="themeTabs" aria-label="Theme switcher">
          {["green", "yellow", "clean"].map((key) => <button key={key} onClick={() => setTheme(key)} className={theme === key ? "themeActive" : ""}><span />{key[0].toUpperCase() + key.slice(1)}</button>)}
        </div>
        <span className="totalPill">{total.toLocaleString()} prompts</span>
      </div>
    </header>
  );
}

function QuickGuide({ total }) {
  return (
    <section className="fadeIn">
      <div className="heroPanel premiumGlow">
        <div><div className="eyebrow">Internal use only</div><h1>Dadi Coach Corporation ChatGPT Prompt Library</h1><p>Premium searchable repository of role-based system prompt templates for Dadi Coach Corporation operations, training, marketing, coordination, reporting, AI workflows, and business development.</p></div>
        <div className="statusCard"><span>Status</span><strong>{total.toLocaleString()} Prompts Active</strong><small>Role-based system templates</small></div>
      </div>
      <SectionTitle title="How to Navigate and Use This Library" />
      <div className="guideGrid">{quickCards.map(([title, body], i) => <div className="guideCard" key={title}><div className="guideIcon">{i + 1}</div><h3>{title}</h3><p>{body}</p></div>)}</div>
      <div className="twoCol">
        <div className="panel"><h2>Prompt Uniqueness and Quality Standards</h2><p>Every copy-ready system prompt should begin with <code>Role:</code>, include a specific task, define usable context, set constraints, and request a clear output format.</p><div className="metricGrid"><Metric label="Total prompt templates listed" value={total.toLocaleString()} /><Metric label="Role-based prompt format" value="Required" /><Metric label="Recommended review" value="Human check" /><Metric label="Confidentiality handling" value="Mandatory" /></div></div>
        <div className="warningPanel"><div className="eyebrow">Internal use warning</div><h2>Main Security Rule</h2><p>Never paste student personal profiles, credit card data, credentials, or confidential partner terms into public AI tools. Use placeholders and verify outputs before official use.</p><span>Version 8.0 Premium</span></div>
      </div>
    </section>
  );
}

function PromptLibrary({ prompts, categories, structures, favorites, toggleFavorite, copyText, setPage, setOptimizerSeed, recent, installDrops, drops }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [structure, setStructure] = useState("All Structures");
  const [onlyFav, setOnlyFav] = useState(false);
  const [selected, setSelected] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const pageSize = 12;

  const filtered = prompts.filter((p) => {
    const haystack = `${p.id} ${p.title} ${p.category} ${p.structure} ${p.output} ${p.useCase} ${p.prompt}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (category === "All Categories" || p.category === category) && (structure === "All Structures" || p.structure === structure) && (!onlyFav || favorites.includes(p.id));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(pageNum, totalPages);
  const display = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => setPageNum(1), [query, category, structure, onlyFav]);

  return (
    <section className="fadeIn librarySection">
      <div className="libraryLayout">
        <aside className="sidebarPanel">
          <h3>Categories</h3>
          <button className={category === "All Categories" ? "sideActive" : ""} onClick={() => setCategory("All Categories")}><Icon name="box" />All Categories <span>{prompts.length}</span></button>
          <div className="categoryScroll">{categories.map(([cat, count], i) => <button key={cat} className={category === cat ? "sideActive" : ""} onClick={() => setCategory(cat)}><Icon name={i % 4 === 0 ? "chart" : i % 4 === 1 ? "chat" : i % 4 === 2 ? "shield" : "users"} />{cat}<span>{count}</span></button>)}</div>
          <div className="sideHelp"><h4>Need help finding the right prompt?</h4><p>Ask the Prompt Assistant for smart recommendations.</p><button onClick={() => setPage("assistant")}>Open Prompt Assistant</button></div>
        </aside>
        <div className="libraryMain">
          <SchedulerCard drops={drops} installDrops={installDrops} total={prompts.length} />
          <div className="libraryContentGrid">
            <div className="libraryLeft">
              <div className="searchPanel stickySearch"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by keyword, code, role, category, or use case..." /><select value={structure} onChange={(e) => setStructure(e.target.value)}><option>All Structures</option>{structures.map((s) => <option key={s}>{s}</option>)}</select><button onClick={() => setOnlyFav(!onlyFav)} className={onlyFav ? "selected" : ""}>Favorites Only</button><button onClick={() => { setQuery(""); setCategory("All Categories"); setStructure("All Structures"); setOnlyFav(false); }}>Reset</button></div>
              <div className="libraryMeta"><strong>{filtered.length.toLocaleString()}</strong> prompts found · showing {display.length} · {categories.length} categories</div>
              <div className="promptGrid">{display.map((p) => <PromptSummaryCard key={p.id} prompt={p} isFav={favorites.includes(p.id)} onFav={() => toggleFavorite(p.id)} copyText={copyText} onView={() => setSelected(p)} setPage={setPage} setOptimizerSeed={setOptimizerSeed} />)}</div>
              <Pagination page={safePage} totalPages={totalPages} onPage={setPageNum} />
            </div>
            <aside className="rightHelp"><div className="floatingChatIcon"><Icon name="chat" /></div><h3>Need the right prompt for your task?</h3><p>Describe your task and get the closest prompt category and template recommendation instantly.</p><button onClick={() => setPage("assistant")}>Open Prompt Assistant</button></aside>
          </div>
        </div>
      </div>
      {selected && <PromptDetailModal prompt={selected} onClose={() => setSelected(null)} copyText={copyText} setPage={setPage} setOptimizerSeed={setOptimizerSeed} isFav={favorites.includes(selected.id)} onFav={() => toggleFavorite(selected.id)} />}
    </section>
  );
}

function SchedulerCard({ drops, installDrops, total }) {
  const installed = drops.filter((p) => p.id.startsWith("W25")).length;
  return (
    <div className="schedulerPanel">
      <div><div className="pipelineLabel"><span>Scheduler Live</span> Dadi Automated Drops Pipeline</div><h2>Weekly Drop Releases <em>Active Week: W25</em></h2><p>Dadi can schedule and inject 10 to 20 optimized enterprise system templates into the library. Use this demo to install this week’s curated prompts.</p><div className="dropMetrics"><Metric label="Current drop count" value="15 prompts" /><Metric label="Drops installed" value={`${installed} prompts`} /><Metric label="Total library scope" value={`${total.toLocaleString()} templates`} /></div></div>
      <div className="terminalBox"><span>Pipeline Task Feed</span><p>[14:38:30] Scheduler initialized on secure local browser storage.</p><p>[14:38:30] Baseline library synchronized and cached.</p><button onClick={installDrops}><Icon name="rocket" />Automatically Drop Week 25 (+15 prompts)</button></div>
    </div>
  );
}

function PromptSummaryCard({ prompt, isFav, onFav, copyText, onView, setPage, setOptimizerSeed }) {
  return (
    <article className="summaryCard">
      <div className="summaryHead"><span className="promptId">Prompt {prompt.id}</span><button className={`favBtn ${isFav ? "favActive" : ""}`} onClick={onFav}>★</button></div>
      <h3>{prompt.title}</h3><small>{prompt.category}</small>
      <div className="summaryRows"><p><span>Structure</span><b>{prompt.structure}</b></p><p><span>Expected Output</span><b>{prompt.output}</b></p><p><span>Best Use Case</span><b>{prompt.useCase}</b></p></div>
      <div className="summaryActions"><button onClick={onView}><Icon name="eye" />View Details</button><button onClick={() => copyText(prompt.prompt, prompt.id)}><Icon name="copy" />Copy</button><button onClick={() => { setOptimizerSeed(prompt.prompt); setPage("improve"); }}><Icon name="sliders" /></button></div>
    </article>
  );
}

function PromptDetailModal({ prompt, onClose, copyText, setPage, setOptimizerSeed, isFav, onFav }) {
  const [values, setValues] = useState({});
  const variables = extractPlaceholders(prompt.prompt).slice(0, 10);
  const customized = variables.reduce((txt, key) => txt.replaceAll(key, values[key] || key), prompt.prompt);
  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modalPanel" onClick={(e) => e.stopPropagation()}>
        <div className="modalHead"><div><span className="promptId">Prompt {prompt.id}</span><h2>{prompt.title}</h2><p>{prompt.category}</p></div><button className="closeBtn" onClick={onClose}>×</button></div>
        <div className="promptMeta"><span>Structure: <b>{prompt.structure}</b></span><span>Expected Output: <b>{prompt.output}</b></span></div>
        <p className="useCase"><b>Best Use Case:</b> {prompt.useCase}</p>
        {variables.length > 0 && <div className="variablePanel"><h4>Customize Template Variables ({variables.length})</h4><div className="variableGrid">{variables.map((v) => <label key={v}>{v}<input value={values[v] || ""} onChange={(e) => setValues({ ...values, [v]: e.target.value })} placeholder={`Enter value for ${v}...`} /></label>)}</div></div>}
        <pre className="promptBox">{customized}</pre>
        <div className="cardActions"><button onClick={onFav}>{isFav ? "Remove Favorite" : "Add Favorite"}</button><button onClick={() => copyText(customized, prompt.id)}>Copy customized prompt</button><button onClick={() => { setOptimizerSeed(customized); setPage("improve"); onClose(); }}>Send to Optimizer</button></div>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onPage }) {
  const items = [1, 2, 3, 4, "...", totalPages].filter((x, i, arr) => arr.indexOf(x) === i && (x === "..." || x <= totalPages));
  return <div className="pagination"><button onClick={() => onPage(Math.max(1, page - 1))}>«</button>{items.map((x, i) => x === "..." ? <span key={i}>...</span> : <button key={x} className={page === x ? "pageActive" : ""} onClick={() => onPage(x)}>{x}</button>)}<button onClick={() => onPage(Math.min(totalPages, page + 1))}>»</button></div>;
}

function PromptAssistant({ prompts, setPage, setOptimizerSeed }) {
  const [messages, setMessages] = useState([{ role: "bot", text: "Hello. I am your Dadi Prompt Coach. Ask me to find a prompt, draft a role-based system prompt, improve your current AI instruction, or explain how to use the library." }]);
  const [input, setInput] = useState("");
  const endRef = useRef(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);
  function send(text = input) {
    if (!text.trim()) return;
    const userText = text.trim();
    const bot = answerAssistantQuestion(userText, prompts);
    setMessages((prev) => [...prev, { role: "user", text: userText }, { role: "bot", text: bot }]);
    setInput("");
  }
  function improveLatest() {
    const source = input.trim() || [...messages].reverse().find((m) => m.role === "user")?.text || "";
    if (!source) return;
    setOptimizerSeed(source);
    setPage("improve");
  }
  return (
    <section className="assistantLayout fadeIn">
      <aside className="assistantSide"><h3>Prompt Coach</h3><p>Ask a real question. The assistant can search the prompt library, recommend templates, draft a role-based system prompt, or send your rough instruction to the optimizer.</p>{assistantSamples.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}<div className="labCard"><b>Dadi Prompt Lab</b><span>Prompt Advisor v8.0</span><small>Improved local assistant for prompt finding, drafting, usage help, and optimization handoff.</small></div></aside>
      <div className="chatPanel"><div className="chatHead"><div><h2>Dadi Prompt Coach</h2><p>Prompt Finder · Draft Assistant · Usage Guide · Prompt Auditor</p></div><span>Smart Local Search</span></div><div className="chatBody">{messages.map((m, i) => <div key={i} className={`bubble ${m.role}`}>{m.text}</div>)}<div ref={endRef} /></div><div className="chatInput"><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask: find a prompt, create a system prompt, improve my prompt, or how to upload..." /><button onClick={() => send()}>Ask</button><button onClick={improveLatest}>Improve</button></div></div>
    </section>
  );
}

function PromptImprover({ seed, setSeed, savePrompt, history, setHistory }) {
  const [original, setOriginal] = useState(seed || "");
  const [context, setContext] = useState("");
  const [audience, setAudience] = useState("Dadi Coach employees");
  const [outputFormat, setOutputFormat] = useState("RTCF (Role, Task, Context, Format)");
  const [tone, setTone] = useState("Professional, clear, and management-ready");
  const [focus, setFocus] = useState("");
  const [extra, setExtra] = useState("");
  const [improved, setImproved] = useState("");
  const [analysis, setAnalysis] = useState({ score: 0, cards: [] });
  useEffect(() => { if (seed) { setOriginal(seed); setSeed(""); } }, [seed, setSeed]);
  function improve() {
    const next = buildImprovedPrompt({ original, context, audience, outputFormat, tone, focus, extra });
    const report = analyzeImprovement(original, next, context, audience, outputFormat, focus);
    setImproved(next);
    setAnalysis(report);
    setHistory([{ original, improved: next, score: report.score, date: new Date().toLocaleString() }, ...history].slice(0, 20));
  }
  return (
    <section className="fadeIn">
      <div className="pageTitle"><div><h1>Improve Your Prompt</h1><p>Refine and enhance your prompt to make it clearer, more specific, and highly effective.</p></div><div className="guideActions"><button onClick={() => alert(Object.entries(improvementTips).map(([k, v]) => `${k}: ${v}`).join("\n"))}>Improvement Guide</button><button onClick={() => alert(history.map((h) => `${h.date} - Score ${h.score}`).join("\n") || "No history yet.")}>History</button></div></div>
      <div className="improveGrid">
        <div className="panel"><h3>1. Enter Your Original Prompt</h3><textarea value={original} onChange={(e) => setOriginal(e.target.value)} placeholder="Paste or type the prompt you want to improve..." /><div className="formGrid"><label>Task Context / Source Material<input value={context} onChange={(e) => setContext(e.target.value)} placeholder="e.g., Project brief, metrics, rules..." /></label><label>Target Audience<input value={audience} onChange={(e) => setAudience(e.target.value)} /></label><label>Output Format<select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}>{["RTCF (Role, Task, Context, Format)", "RTF", "CRAFT", "RISEN", "TAG", "Role-Task-Output-Constraint"].map((x) => <option key={x}>{x}</option>)}</select></label><label>Tone / Style<select value={tone} onChange={(e) => setTone(e.target.value)}><option>Professional, clear, and management-ready</option><option>Simple and employee-friendly</option><option>Executive and concise</option><option>Warm and parent-friendly</option></select></label><label>Prompt Focus<textarea value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g., priorities, KPI, action steps..." /></label><label>Additional Instructions<textarea value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="e.g., include examples, use metrics..." /></label></div><div className="formActions"><button onClick={() => { setOriginal(""); setContext(""); setFocus(""); setExtra(""); }}>Clear All</button><button className="primary" onClick={improve}>Improve Prompt + Score Breakdown</button></div></div>
        <div className="panel"><div className="improvedHead"><h3>2. Improved Prompt <span>Optimized</span></h3><div className="scoreRing">{analysis.score || scorePrompt(original, context, audience, outputFormat, focus)}<small>/100</small></div></div><pre className="improvedBox">{improved || "Click Improve Prompt to generate a stronger role-based system prompt with a scoring breakdown."}</pre><div className="cardActions"><button onClick={() => improved && navigator.clipboard.writeText(improved)}>Copy</button><button onClick={() => setOriginal(improved || original)}>Edit Improved Prompt</button><button onClick={() => improved && savePrompt(improved)}>Save to Library</button></div></div>
      </div>
      <SectionTitle title="Improvement Breakdown" />
      <div className="breakdownGrid">{(analysis.cards.length ? analysis.cards : [["Clarity", "Waiting for prompt analysis.", 0], ["Structure", "Waiting for prompt analysis.", 0], ["Context", "Waiting for prompt analysis.", 0], ["Actionability", "Waiting for prompt analysis.", 0], ["Safety", "Waiting for prompt analysis.", 0]]).map(([title, body, score]) => <div className="breakCard" key={title}><div className="breakTop"><strong>{title}</strong>{score ? <span>{score}/100</span> : null}</div>{score ? <div className="miniBar"><i style={{ width: `${score}%` }} /></div> : null}<p>{body}</p></div>)}</div>
    </section>
  );
}

function UploadPrompts({ uploaded, setUploaded, allPrompts }) {
  const [message, setMessage] = useState("");
  function handleFile(file) {
    if (!file) return;
    file.text().then((text) => {
      try {
        const data = file.name.toLowerCase().endsWith(".csv") ? parseCsv(text) : (JSON.parse(text).prompts || JSON.parse(text));
        if (!Array.isArray(data)) throw new Error("File must contain an array or a { prompts: [] } object.");
        const normalized = data.map((p, i) => normalizePrompt(p, i, "UP"));
        setUploaded((prev) => [...normalized, ...prev]);
        setMessage(`${normalized.length} prompt templates uploaded successfully.`);
      } catch (err) {
        setMessage(`Upload failed: ${err.message}`);
      }
    });
  }
  function backup() {
    downloadFile("dadi-uploaded-prompts-backup.json", "application/json", JSON.stringify({ prompts: uploaded }, null, 2));
  }
  const sampleCsv = "ID,Title,Category,Structure,Expected Output,Department,Level,Best Use Case,Tags,Prompt\nTEST-001,Sample Work Plan Prompt,Uploaded Prompts,RTCF,work plan,General,Basic,Testing upload,upload test,Role: You are a Dadi work planning assistant. Task: Create a work plan for [Topic]. Context: Use [Source Material]. Format: Table with actions and deadlines.";
  return (
    <section className="fadeIn uploadPage">
      <div className="panel uploadPanel"><div><div className="eyebrow">Prompt Upload</div><h1>Add your own prompt templates</h1><p>Upload JSON or CSV files with columns such as Title, Category, Structure, Expected Output, Best Use Case, and Prompt. Uploaded prompts are saved in this browser.</p><div className="uploadActions"><label className="fileButton">Upload JSON / CSV<input type="file" accept=".json,.csv" onChange={(e) => handleFile(e.target.files[0])} /></label><button onClick={backup}>Download JSON Backup</button><button onClick={() => { setUploaded([]); setMessage("Uploaded prompts cleared."); }}>Clear Uploaded</button><button onClick={() => downloadFile("sample_prompt_upload.csv", "text/csv", sampleCsv)}>Download Sample CSV</button></div>{message && <p className="notice">{message}</p>}</div><div className="uploadStats"><Metric label="Uploaded prompts" value={uploaded.length} /><Metric label="Total active prompts" value={allPrompts.length} /></div></div>
      <div className="panel"><h2>Upload Format Reference</h2><p>For CSV upload, include these headers: <code>ID</code>, <code>Title</code>, <code>Category</code>, <code>Structure</code>, <code>Expected Output</code>, <code>Best Use Case</code>, and <code>Prompt</code>.</p></div>
    </section>
  );
}

function AdminAccessPanel({ allPrompts, setPage }) {
  const [adminKey, setAdminKey] = useState(readStorage(STORAGE.adminKey, ""));
  const [status, setStatus] = useState("all");
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("Backend admin access lets approved staff seed the database, review uploads, approve prompts, archive prompts, and export the central library.");
  const [busy, setBusy] = useState(false);
  useEffect(() => writeStorage(STORAGE.adminKey, adminKey), [adminKey]);

  async function adminFetch(path, options = {}) {
    const res = await fetch(path, { ...options, headers: { "Content-Type": "application/json", "x-admin-key": adminKey, ...(options.headers || {}) } });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data.error || data.details || `Request failed with status ${res.status}`);
    return data;
  }
  async function testConnection() {
    setBusy(true);
    setMessage("Checking Supabase backend connection...");
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || "Health check failed.");
      setMessage(`Backend connected. Database currently has ${data.prompt_count || 0} prompts.`);
    } catch (err) {
      setMessage(`Backend not ready: ${err.message}`);
    } finally { setBusy(false); }
  }
  async function loadAdminPrompts(nextStatus = status) {
    if (!adminKey) return setMessage("Enter the ADMIN_KEY first.");
    setBusy(true);
    try {
      const data = await adminFetch(`/api/admin-prompts?status=${nextStatus}`);
      setItems((data.prompts || []).map((p, i) => normalizePrompt(p, i, "DB")));
      setMessage(`Loaded ${(data.prompts || []).length} backend prompts.`);
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }
  async function seedDatabase() {
    if (!adminKey) return setMessage("Enter the ADMIN_KEY first.");
    if (!confirm(`Upload ${allPrompts.length} current prompts to the Supabase database as approved prompts?`)) return;
    setBusy(true);
    try {
      const data = await adminFetch("/api/bulk-upload-prompts", { method: "POST", body: JSON.stringify({ prompts: allPrompts }) });
      setMessage(`Seed complete. ${data.count} prompts were uploaded to the central backend.`);
      await loadAdminPrompts("approved");
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }
  async function changeStatus(id, newStatus) {
    setBusy(true);
    try {
      await adminFetch("/api/admin-prompts", { method: "PATCH", body: JSON.stringify({ id, status: newStatus }) });
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p)));
      setMessage(`Prompt ${id} changed to ${newStatus}.`);
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }
  async function deletePrompt(id) {
    if (!confirm(`Delete prompt ${id} from the backend database?`)) return;
    setBusy(true);
    try {
      await adminFetch("/api/admin-prompts", { method: "DELETE", body: JSON.stringify({ id }) });
      setItems((prev) => prev.filter((p) => p.id !== id));
      setMessage(`Prompt ${id} deleted.`);
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }
  function openBackendExport() {
    if (!adminKey) return setMessage("Enter the ADMIN_KEY first.");
    fetch("/api/export-prompts", { headers: { "x-admin-key": adminKey } }).then(async (res) => {
      if (!res.ok) throw new Error((await res.json()).error || "Export failed.");
      return res.blob();
    }).then((blob) => {
      const link = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = link;
      a.download = "dadi-prompt-database-export.xls";
      a.click();
      URL.revokeObjectURL(link);
    }).catch((err) => setMessage(err.message));
  }
  return (
    <section className="fadeIn adminOnly">
      <div className="pageTitle"><div><h1>Backend Admin Access</h1><p>This page is hidden from the normal navigation. It is only for authorized Dadi staff who know the private admin URL and ADMIN_KEY.</p></div></div>
      <div className="adminGrid">
        <div className="panel"><h2>Backend Control Panel</h2><p className="muted">Use the same ADMIN_KEY that you saved in Vercel Environment Variables. Keep this key internal.</p><label>Admin Key<input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Enter ADMIN_KEY from Vercel..." /></label><div className="cardActions wrapActions"><button onClick={testConnection} disabled={busy}>Test Backend</button><button onClick={seedDatabase} disabled={busy}>Seed Current 1,000 Prompts</button><button onClick={openBackendExport} disabled={busy}>Export Backend Excel</button><button onClick={() => setPage("library")}>Return to Library</button></div><div className="noticeBox">{busy ? "Working..." : message}</div></div>
        <div className="panel"><h2>Review Prompt Database</h2><div className="filterRow"><select value={status} onChange={(e) => { setStatus(e.target.value); loadAdminPrompts(e.target.value); }}><option value="all">All statuses</option><option value="pending_review">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="archived">Archived</option></select><button onClick={() => loadAdminPrompts(status)} disabled={busy}>Refresh List</button></div><div className="adminList">{items.length === 0 && <p className="muted">No backend prompts loaded yet.</p>}{items.slice(0, 80).map((p) => <div className="adminItem" key={p.id}><div><strong>{p.title}</strong><small>{p.id} · {p.category} · {p.status || "unknown"}</small></div><div className="miniActions"><button onClick={() => changeStatus(p.id, "approved")}>Approve</button><button onClick={() => changeStatus(p.id, "pending_review")}>Pending</button><button onClick={() => changeStatus(p.id, "archived")}>Archive</button><button onClick={() => deletePrompt(p.id)}>Delete</button></div></div>)}</div></div>
      </div>
    </section>
  );
}

function Metric({ label, value }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
function SectionTitle({ title }) { return <h2 className="sectionTitle">{title}</h2>; }
function StateCard({ title, body }) { return <div className="panel state"><h2>{title}</h2><p>{body}</p></div>; }
function Footer() { return <footer className="footer">Internal Use Only | Dadi Coach Corporation Prompt Library | Premium Web Version</footer>; }

function Icon({ name }) {
  const icons = {
    book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5Z",
    cards: "M3 3h8v8H3z M13 3h8v8h-8z M3 13h8v8H3z M13 13h8v8h-8z",
    chat: "M21 12a8 8 0 0 1-8 8H7l-4 3v-6a8 8 0 1 1 18-5Z",
    sliders: "M4 6h10 M18 6h2 M4 12h2 M10 12h10 M4 18h10 M18 18h2 M14 4v4 M8 10v4 M14 16v4",
    upload: "M12 16V4 M7 9l5-5 5 5 M4 20h16",
    download: "M12 4v12 M7 11l5 5 5-5 M4 20h16",
    box: "M4 7l8-4 8 4-8 4-8-4Z M4 7v10l8 4 8-4V7",
    chart: "M4 19V5 M8 19v-8 M12 19v-5 M16 19V7 M20 19V3",
    shield: "M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4Z",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
    eye: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    copy: "M9 9h10v12H9z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
    rocket: "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z M12 15l-3-3a22 22 0 0 1 2-5 12 12 0 0 1 8-5s0 4-5 8a22 22 0 0 1-5 2Z"
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[name] || icons.box} /></svg>;
}

export default App;
