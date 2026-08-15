// POST /api/ask-gst  { question }
// Answers GST questions using Claude + live web search. Login required.
// Free daily limit per user (tracked in the gst_quota table).
import { getUser, admin } from "../lib/supabase.js";

const DAILY_LIMIT = parseInt(process.env.GST_DAILY_LIMIT || "10", 10);
const MODEL = process.env.ASK_MODEL || process.env.MODEL || "claude-3-5-haiku-latest";

const SYSTEM = [
  "You are a GST (Goods & Services Tax, India) assistant for tax professionals, CAs and business owners.",
  "Use the web search tool to check the current position — rates, notifications, circulars, due dates, recent amendments and case law — instead of relying on memory, which may be outdated.",
  "Answer concisely and practically. Where a provision matters, name the section/rule/notification, but NEVER invent a section number, circular number, or case citation — if you are not sure of the exact reference, say so and point to where to check.",
  "Prefer official sources (cbic-gst.gov.in, gst.gov.in, the CGST Act/Rules) over blogs.",
  "End every answer with one short line: 'Verify against the official Act/notification before relying on this.'",
  "You provide general information, not legal or tax advice for a specific case."
].join(" ");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Please sign in to ask." });

    var question = (req.body && req.body.question || "").toString().trim();
    if (!question) return res.status(400).json({ error: "Type a GST question." });
    if (question.length > 1000) return res.status(400).json({ error: "Question is too long (max 1000 chars)." });

    // --- daily quota ---
    var today = new Date().toISOString().slice(0, 10);
    var q = await admin.from("gst_quota").select("used").eq("user_id", user.id).eq("day", today).limit(1);
    var used = (q.data && q.data[0]) ? q.data[0].used : 0;
    if (used >= DAILY_LIMIT) {
      return res.status(429).json({ error: "You've used today's " + DAILY_LIMIT + " free questions. It resets tomorrow.", remaining: 0 });
    }

    // --- ask Claude with web search ---
    var ar = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: "user", content: question }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }]
      })
    });
    if (!ar.ok) { var d = await ar.text(); return res.status(502).json({ error: "GST assistant failed. " + d.slice(0, 200) }); }
    var data = await ar.json();

    var answer = "", sources = [], seen = {};
    (data.content || []).forEach(function (b) {
      if (b.type === "text") {
        answer += b.text;
        (b.citations || []).forEach(function (c) {
          var u = c.url; if (u && !seen[u]) { seen[u] = 1; sources.push({ url: u, title: c.title || u }); }
        });
      }
    });
    answer = answer.trim();
    if (!answer) return res.status(502).json({ error: "No answer came back — try rephrasing." });

    // --- record the question against today's quota (only on a real answer) ---
    if (q.data && q.data[0]) await admin.from("gst_quota").update({ used: used + 1 }).eq("user_id", user.id).eq("day", today);
    else await admin.from("gst_quota").insert({ user_id: user.id, day: today, used: 1 });

    return res.status(200).json({ answer: answer, sources: sources.slice(0, 6), remaining: Math.max(0, DAILY_LIMIT - (used + 1)) });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}

export const config = { maxDuration: 60 };
