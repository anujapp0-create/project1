// POST /api/create-order  (requires login) -> Razorpay order for Rs 249.
import { getUser } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return res.status(500).json({ error: "Payments not configured." });

  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Please sign in first.", needLogin: true });

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const r = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 24900, currency: "INR", notes: { user_id: user.id, product: "100 page credits" } }),
    });
    const order = await r.json();
    if (!r.ok) return res.status(502).json({ error: order.error?.description || "Could not create order." });
    return res.status(200).json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId, email: user.email });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
