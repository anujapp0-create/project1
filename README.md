# These go into Vercel -> Project -> Settings -> Environment Variables.
# (The public Supabase URL + anon key go in public/config.js instead.)

# --- Anthropic (reads the invoices) ---
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
MODEL=claude-haiku-4-5-20251001

# --- Razorpay (takes the Rs 249 payments) ---
RAZORPAY_KEY_ID=rzp_live_xxxx
RAZORPAY_KEY_SECRET=xxxxxxxx

# --- Supabase (login + credits database) ---
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
# SECRET - never put this in the website. Server only.
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxx
