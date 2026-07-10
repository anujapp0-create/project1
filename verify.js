// GET /api/history  (requires login) -> { history: [{payment_id, amount, pages, created_at}] }
import { getUser, admin } from "../lib/supabase.js";

export default async function handler(req, res) {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Not signed in.", needLogin: true });
    const { data, error } = await admin
      .from("payments")
      .select("payment_id, amount, pages, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return res.status(200).json({ history: data || [] });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
