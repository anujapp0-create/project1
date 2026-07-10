// POST /api/verify  (requires login)
// Verifies the Razorpay signature, then adds 100 pages to THIS user's account.
// Idempotent: a payment can only ever add credits once.
import crypto from "crypto";
import { getUser, addPages, ensureBalance, admin } from "../lib/supabase.js";

const PAGES_PER_PURCHASE = 100;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return res.status(500).json({ error: "Payments not configured." });

  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Please sign in first.", needLogin: true });

    const { orderId, paymentId, signature } = req.body || {};
    if (!orderId || !paymentId || !signature) return res.status(400).json({ error: "Missing payment details." });

    const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
    const ok = expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!ok) return res.status(400).json({ error: "Payment could not be verified." });

    // idempotency: record the payment; if it already exists, do NOT add credits again
    const { error: insErr } = await admin.from("payments").insert({ payment_id: paymentId, user_id: user.id, amount: 24900, pages: PAGES_PER_PURCHASE });
    if (insErr) {
      if (insErr.code === "23505") {
        // genuine duplicate -> this exact payment was already credited
        const balance = await ensureBalance(user.id);
        return res.status(200).json({ balance, already: true });
      }
      // any other DB error (e.g. missing column) must NOT be silently swallowed
      return res.status(500).json({ error: "Could not record payment: " + insErr.message });
    }

    const balance = await addPages(user.id, PAGES_PER_PURCHASE);
    return res.status(200).json({ balance, added: PAGES_PER_PURCHASE });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
