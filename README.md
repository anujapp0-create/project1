# GSTInvoice2GSTR1 — account version (Google sign-in + ₹249/100 pages)

Users sign in with Google, get 10 free pages, then pay ₹249 for 100 more.
Credits are saved to their account, so they work on any device.

Budget ~1–1.5 hours the first time. The Google login setup (Step 3) is the
fiddliest part — go slowly there.

---

## Accounts you need (all have free tiers)

| Account | Does what | Where |
|---|---|---|
| **Vercel** | Hosts the site + the hidden server | vercel.com |
| **Anthropic** | Reads the invoices | console.anthropic.com |
| **Razorpay** | Takes ₹249 payments | razorpay.com |
| **Supabase** | Google login + credits database | supabase.com |
| **Google Cloud** | Issues the Google login (used by Supabase) | console.cloud.google.com |

---

## Step 1 — Supabase project + database

1. supabase.com → New project. Pick a region near India. Save the database password.
2. Left menu → **SQL Editor → New query**. Open the file **`supabase_setup.sql`**
   from this folder, paste all of it, click **Run**. (This builds the credits
   tables and locks them down.)
3. Left menu → **Settings → API**. Copy three things:
   - **Project URL** (e.g. `https://abcd.supabase.co`)
   - **anon public** key  → goes in `public/config.js` (public, safe)
   - **service_role** key  → goes in Vercel as a SECRET (never in the website)

Open **`public/config.js`** and paste your Project URL and anon key there.

---

## Step 2 — Anthropic + Razorpay keys

- **Anthropic:** console.anthropic.com → API Keys → create (`sk-ant-...`), add billing credit.
- **Razorpay:** sign up, finish KYC with TaxTrack details. Start in **Test mode** →
  Settings → API Keys → copy **Key Id** (`rzp_test_...`) and **Key Secret**.

---

## Step 3 — turn on Google sign-in (the fiddly bit)

**In Supabase first, get the callback URL:**
- Supabase → **Authentication → Providers → Google**. You'll see a
  **"Callback URL (for OAuth)"** like `https://abcd.supabase.co/auth/v1/callback`.
  Copy it. Leave this tab open.

**In Google Cloud:**
1. console.cloud.google.com → create a project (top bar).
2. **APIs & Services → OAuth consent screen** → choose **External** → fill app
   name + your email → Save. (For testing you can add your own email under
   "Test users"; to let anyone in, click **Publish app** later.)
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** →
   type **Web application**.
4. Under **Authorized redirect URIs**, paste the Supabase Callback URL from above.
5. Create → copy the **Client ID** and **Client Secret**.

**Back in Supabase:**
6. Authentication → Providers → **Google** → toggle **Enabled** → paste the
   Client ID and Client Secret → Save.
7. Authentication → **URL Configuration** → set **Site URL** to your Vercel
   address (you'll have it after Step 4 — come back and set it, e.g.
   `https://your-project.vercel.app`). Add the same under **Redirect URLs**.

---

## Step 4 — deploy to Vercel

1. Put this folder on GitHub (create a repo → "upload files" → drag everything in,
   keeping the `api/ lib/ public/` structure → commit).
2. vercel.com → Add New → Project → Import the repo → Deploy.
3. **Settings → Environment Variables** → add these → then Redeploy:
   ```
   ANTHROPIC_API_KEY           sk-ant-...
   MODEL                       claude-haiku-4-5-20251001
   RAZORPAY_KEY_ID             rzp_test_...
   RAZORPAY_KEY_SECRET         ...
   SUPABASE_URL                https://abcd.supabase.co
   SUPABASE_SERVICE_ROLE_KEY   ...(the SECRET service_role key)
   ```
4. Copy your live `vercel.app` address and finish Step 3.7 (Supabase Site URL).

---

## Step 5 — test it end to end

1. Open your site → **Sign in with Google** → you should land back signed in,
   with "**10 pages left**" in the top bar.
2. Upload a small invoice PDF → Excel downloads, balance drops.
3. Keep going past 10 pages → the **₹249 paywall** appears.
4. Subscribe → in Razorpay **Test mode**, pay with card `4111 1111 1111 1111`,
   any future expiry, any CVV → balance jumps by 100.
5. Sign out, sign back in → your balance is still there (proof it's per-account).

When happy, switch Razorpay to **Live mode**, swap the two Razorpay keys in
Vercel for the live ones, redeploy, and publish the Google consent screen.

---

## Money

- Your cost ≈ **₹1–2 per page** (Anthropic). At ₹249/100 pages = ₹2.49/page,
  the cheap `claude-haiku-...` model leaves a healthy margin; `claude-sonnet-4-6`
  is more accurate but thinner margin. Change `MODEL` to switch.
- Razorpay takes ~2% + GST per payment.

---

## What's solid now vs. still worth a developer's eye

**Solid:** the API key is hidden server-side; credits are per Google account and
can't be faked from the browser (the database is locked to the server only);
payments are signature-verified and can't be double-credited.

**Worth a review before scaling:** refunds/chargebacks, a proper privacy policy
and account-deletion (you now hold user data — India's DPDP Act applies), and
abuse limits. None block your launch; all matter once real money flows.

**Still true:** the output is a *working file* — you and your users must review it
before filing. The "Read me" sheet in every download says what to check.

---

## WhatsApp invoices, photos, and Tally export

**Photos work now.** The upload accepts JPG/PNG as well as PDF, so the photos and
screenshots clients send on WhatsApp can go straight in (save them from WhatsApp,
then drop or pick them — on a phone you can also use the camera). An image counts
as 1 page.

**Tally import (test this before trusting it).** On the review screen there's a
**Download Tally import (.xml)** button next to the Excel one. It produces a Tally
XML with party/sales/GST ledgers and Sales / Credit Note / Debit Note vouchers
(works for Tally ERP 9 and Prime). Every voucher is balanced.

> The catch with Tally is **ledger names**. The file creates ledgers named
> "Sales", "Output IGST/CGST/SGST", and one per customer. If your CA's company
> already uses different names, Tally may create duplicates. So: import it into a
> **test company first**, see what Tally says, and tell me what to adjust. I can't
> run Tally here, so this is a correct starting structure, not a guaranteed
> drop-in for every client's books. It currently does **sales** vouchers (what
> GSTR-1 needs); purchase vouchers can be added the same way.

**"Real" WhatsApp intake is a later phase.** A client texting invoices to a
WhatsApp number and having them appear in the CA's account needs the official
**WhatsApp Business API** through a provider (Meta direct, or a BSP like Twilio /
Gupshup / AiSensy), plus business verification and a webhook that drops incoming
files into the user's account. That's a separate project with its own approval
and monthly cost — worth doing once the core tool has paying users, but not
something that can be switched on from this code alone.

---

## How the parts connect

```
  Google login (Supabase)  ──>  the browser gets a login token
        │
  Browser sends PDF + token to ──>  /api/extract
        │                              • checks who you are
        │                              • checks your credits (Supabase DB)
        │                              • calls Anthropic with the hidden key
        ▼
  invoices come back → browser builds the Excel (SheetJS) → downloads

  Subscribe ──> /api/create-order (Razorpay) ──> checkout popup
            ──> /api/verify  • checks signature  • adds 100 pages to your account
```
