// POST /api/extract  (requires login)
// body: { pdfBase64 }   header: Authorization: Bearer <google-login-token>
import { PDFDocument } from "pdf-lib";
import { getUser, ensureBalance, spend } from "../lib/supabase.js";

const MODEL = process.env.MODEL || "claude-haiku-4-5-20251001";

const PROMPT = `You are reading an Indian GST tax invoice PDF. A single PDF may contain ONE invoice or MANY.
Return ONLY valid JSON - a JSON array, no markdown, no code fences. Each element:
{"supplier_gstin":string|null,"customer_gstin":string|null,"customer_name":string|null,"invoice_number":string,
"invoice_date":"DD-MM-YYYY","place_of_supply":"NN-StateName","invoice_value":number,
"document_type":"invoice"|"credit_note"|"debit_note","is_export":true|false,
"line_items":[{"description":string,"hsn_sac":string,"quantity":number,"uqc":string,
"taxable_value":number,"gst_rate":number,"igst":number,"cgst":number,"sgst":number,"cess":number}]}
Use plain numbers (no commas/symbols). Absent number=0, absent text=null. Do not invent values.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "Server not configured: ANTHROPIC_API_KEY missing." });

  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Please sign in first.", needLogin: true });

    const { pdfBase64 } = req.body || {};
    if (!pdfBase64) return res.status(400).json({ error: "No PDF provided." });

    // count pages server-side so billing can't be faked
    let pages;
    try {
      const bytes = Buffer.from(pdfBase64, "base64");
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      pages = pdf.getPageCount();
    } catch {
      return res.status(400).json({ error: "Could not read this PDF (corrupted or password-protected)." });
    }

    const balance = await ensureBalance(user.id);
    if (balance < pages) {
      return res.status(402).json({ error: "Not enough page credits.", needSubscribe: true, remaining: balance });
    }

    // read the invoice with Claude (API key stays on the server)
    const ar = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL, max_tokens: 8000,
        messages: [{ role: "user", content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
          { type: "text", text: PROMPT },
        ] }],
      }),
    });
    if (!ar.ok) {
      const detail = await ar.text();
      return res.status(502).json({ error: "Invoice reader failed. " + detail.slice(0, 200) }); // no charge on failure
    }

    const data = await ar.json();
    let raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    raw = raw.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();
    let invoices;
    try { invoices = JSON.parse(raw); } catch { invoices = []; }
    if (!Array.isArray(invoices)) invoices = [invoices];

    // success -> spend the pages now
    const remaining = await spend(user.id, pages);

    return res.status(200).json({ invoices, pagesCharged: pages, remaining: remaining < 0 ? 0 : remaining });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}

export const config = { maxDuration: 60 };
