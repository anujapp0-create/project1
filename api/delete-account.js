// POST /api/delete-account  (requires login)
// Deletes the user's login. The database cleans up automatically:
//   - credits row  -> removed (ON DELETE CASCADE)
//   - payments rows -> kept but de-identified (ON DELETE SET NULL),
//     so financial/accounting records survive without personal data.
import { getUser, admin } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Not signed in.", needLogin: true });
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error(error.message);
    return res.status(200).json({ deleted: true });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
