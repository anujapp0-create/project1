// POST /api/razorpay-webhook
// Razorpay calls this directly after a payment. It's the backup that credits a
// user even if their browser closed before /api/verify ran. Idempotent: the
// same payment can only ever add credits once (shared with verify.js).
import crypto from "crypto";
import { creditPaymentOnce } from "../lib/supabase.js";

// We need the RAW body to verify Razorpay's signature, so turn off auto-parsing.
export const config = { api: { bodyParser: false }, maxDuration: 30 };

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// If the order notes weren't on the event, fetch the order from Razorpay to read them.
async function fetchOrderNotes(orderId) {
  const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || !orderId) return {};
  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const r = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, { headers: { Authorization: `Basic ${auth}` } });
    if (!r.ok) return {};
    const o = await r.json();
    return o.notes || {};
  } catch { return {}; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: "Webhook secret not configured" });

  let buf;
  try { buf = await rawBody(req); } catch { return res.status(400).json({ error: "No body" }); }

  // 1) Verify the signature so only real Razorpay events are processed.
  const sig = req.headers["x-razorpay-signature"] || "";
  const expected = crypto.createHmac("sha256", secret).update(buf).digest("hex");
  let valid = false;
  try { valid = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch { valid = false; }
  if (!valid) return res.status(400).json({ error: "Invalid signature" });

  let event;
  try { event = JSON.parse(buf.toString("utf8")); } catch { return res.status(400).json({ error: "Bad JSON" }); }

  // 2) Only successful payments credit anything.
  const type = event.event;
  if (type === "payment.captured" || type === "order.paid") {
    const pay = event.payload && event.payload.payment && event.payload.payment.entity;
    const ord = event.payload && event.payload.order && event.payload.order.entity;
    const payment_id = pay && pay.id;
    const amount = (pay && pay.amount) != null ? pay.amount : 24900;

    // Who to credit + how many pages: prefer order notes, then payment notes, then fetch.
    let notes = (ord && ord.notes) || (pay && pay.notes) || {};
    let user_id = notes.user_id;
    let pages = parseInt(notes.pages, 10);
    if (!user_id && pay && pay.order_id) {
      const on = await fetchOrderNotes(pay.order_id);
      user_id = user_id || on.user_id;
      if (!pages) pages = parseInt(on.pages, 10);
    }
    if (!pages || isNaN(pages)) pages = 100; // product only sells 100-page packs

    if (payment_id && user_id) {
      try {
        const r = await creditPaymentOnce({ payment_id, user_id, amount, pages });
        return res.status(200).json({ ok: true, credited: !!r.credited, duplicate: !!r.duplicate });
      } catch (e) {
        // Return 500 so Razorpay retries later — better a retry than a lost credit.
        return res.status(500).json({ error: "Credit failed: " + String(e.message || e) });
      }
    }
    // Couldn't identify the user; acknowledge so Razorpay stops retrying.
    return res.status(200).json({ ok: true, skipped: "no user_id" });
  }

  // Any other event: just acknowledge.
  return res.status(200).json({ ok: true, ignored: type });
}
