// GET /api/balance  (requires login) -> { email, balance }
import { getUser, ensureBalance } from "../lib/supabase.js";

export default async function handler(req, res) {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Not signed in.", needLogin: true });
    const balance = await ensureBalance(user.id);
    return res.status(200).json({ email: user.email, balance });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
