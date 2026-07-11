// Server-side Supabase: validates the user's login and reads/writes credits.
// Uses the SERVICE ROLE key, which must stay secret (server only).
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// Who is calling? Reads the "Authorization: Bearer <token>" header and validates it.
export async function getUser(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user; // { id, email, ... }
}

// Grants 10 free demo pages on first sight, then returns current balance.
export async function ensureBalance(userId) {
  const { data, error } = await admin.rpc("grant_demo", { uid: userId });
  if (error) throw new Error("Credits error: " + error.message);
  return data;
}

export async function spend(userId, n) {
  const { data, error } = await admin.rpc("spend_pages", { uid: userId, n });
  if (error) throw new Error("Credits error: " + error.message);
  return data; // new balance, or -1 if not enough
}

export async function addPages(userId, n) {
  const { data, error } = await admin.rpc("add_pages", { uid: userId, n });
  if (error) throw new Error("Credits error: " + error.message);
  return data; // new balance
}

// Idempotently record a payment and add its pages. Safe to call from both the
// browser (verify.js) and the Razorpay webhook — whichever runs first credits;
// the second sees the unique-key violation and skips, so credit happens once.
export async function creditPaymentOnce({ payment_id, user_id, amount, pages }) {
  const { error } = await admin.from("payments").insert({ payment_id, user_id, amount, pages });
  if (error) {
    if (error.code === "23505") return { duplicate: true }; // already credited
    throw new Error(error.message);
  }
  const balance = await addPages(user_id, pages);
  return { credited: true, balance };
}
