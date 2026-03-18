# Macra — Eat with intention.

AI-powered meal planning and macro tracking PWA.

## What is Macra?

Macra is a mobile-first Progressive Web App that generates personalized meal plans using AI, tracks daily macros, and builds smart grocery lists — all based on the user's body stats, goals, and dietary preferences.

**Business Model:** Freemium — free tier with limited AI generations, Pro tier ($4.99/mo) unlocks unlimited plans, grocery lists, and household mode.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Vite | UI framework + build tool |
| Styling | Tailwind CSS + inline styles | Design system |
| AI | Anthropic Claude API | Meal plan generation |
| Auth + DB | Supabase | User accounts, profiles, saved meals |
| Payments | Stripe | Pro subscriptions |
| Hosting | Vercel | Deployment + CDN |
| PWA | Vite PWA Plugin | Installable mobile app |

---

## Quick Start (Local Development)

```bash
# 1. Clone and install
git clone <your-repo-url>
cd macra
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Fill in your API keys (see Environment Variables below)

# 3. Run dev server
npm run dev

# 4. Open on your phone
# Use the local network URL shown in terminal (e.g. http://192.168.x.x:5173)
```

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Anthropic Claude API (for AI meal generation)
VITE_ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# Supabase (for auth + database)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxxx

# Stripe (for Pro subscriptions)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx  # server-side only
STRIPE_PRICE_ID=price_xxxxxxxxxxxxx       # your $4.99/mo price ID
```

---

## Deployment to Vercel (Free Tier)

### First Time Setup:

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial Macra deployment"
   git remote add origin https://github.com/YOUR_USERNAME/macra.git
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in with GitHub
   - Click "New Project" → Import your `macra` repo
   - Framework Preset: **Vite**
   - Add your environment variables in the Vercel dashboard
   - Click "Deploy"

3. **Your app is live** at `macra.vercel.app` (or custom domain)

### Custom Domain:
- In Vercel dashboard → Settings → Domains
- Add `macra.app` or `getmacra.com` (purchase from Namecheap, ~$14/yr)
- Vercel handles SSL automatically

---

## Supabase Setup Guide

### 1. Create Project
- Go to [supabase.com](https://supabase.com), create free account
- New Project → name it "macra"

### 2. Database Tables

Run this SQL in the Supabase SQL Editor:

```sql
-- Users profile (extends Supabase auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  name TEXT,
  sex TEXT CHECK (sex IN ('male', 'female')),
  age INTEGER,
  weight_lbs NUMERIC,
  height_ft INTEGER,
  height_in INTEGER,
  activity TEXT,
  goal TEXT,
  diet TEXT[],
  target_calories INTEGER,
  target_protein INTEGER,
  target_carbs INTEGER,
  target_fat INTEGER,
  is_pro BOOLEAN DEFAULT false,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved custom meals
CREATE TABLE saved_meals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ingredients JSONB NOT NULL,
  total_calories INTEGER,
  total_protein INTEGER,
  total_carbs INTEGER,
  total_fat INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meal log (daily tracking)
CREATE TABLE meal_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
  name TEXT NOT NULL,
  calories INTEGER,
  protein NUMERIC,
  carbs NUMERIC,
  fat NUMERIC,
  source TEXT DEFAULT 'manual',
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI generated meal plans
CREATE TABLE meal_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  meals JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (users can only see their own data)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users manage own meals" ON saved_meals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own log" ON meal_log FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own plans" ON meal_plans FOR ALL USING (auth.uid() = user_id);
```

### 3. Enable Auth
- In Supabase Dashboard → Authentication → Providers
- Enable **Email** (for email/password signups)
- Optional: Enable **Google** and **Apple** for social login

---

## Stripe Setup Guide

### 1. Create Account
- Go to [stripe.com](https://stripe.com), create account
- Complete identity verification

### 2. Create Product + Price
- Dashboard → Products → Add Product
- Name: "Macra Pro"
- Price: $4.99/month, recurring
- Copy the **Price ID** (starts with `price_`)

### 3. Webhook (for subscription status updates)
- Dashboard → Developers → Webhooks
- Add endpoint: `https://macra.vercel.app/api/webhooks/stripe`
- Events to listen for:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

### 4. Integration Flow
```
User taps "Upgrade to Macra Pro"
  → Frontend creates Stripe Checkout session via API route
  → User completes payment on Stripe's hosted page
  → Stripe webhook fires → API route updates is_pro in Supabase
  → User returns to app with Pro unlocked
```

---

## Project Structure

```
macra/
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker
│   ├── icon-192.png           # App icon
│   └── icon-512.png           # App icon (large)
├── src/
│   ├── components/            # UI components
│   │   ├── Splash.jsx
│   │   ├── Onboarding.jsx
│   │   ├── Dashboard.jsx
│   │   ├── MealPlan.jsx
│   │   ├── LogMeal.jsx
│   │   ├── MealCreator.jsx
│   │   ├── Grocery.jsx
│   │   ├── Profile.jsx
│   │   ├── BottomNav.jsx
│   │   └── ui/               # Shared UI primitives
│   │       ├── Card.jsx
│   │       ├── Ring.jsx
│   │       └── Label.jsx
│   ├── lib/
│   │   ├── supabase.js        # Supabase client
│   │   ├── stripe.js          # Stripe helpers
│   │   ├── claude.js           # Claude API integration
│   │   └── macros.js           # Macro calculator engine
│   ├── hooks/
│   │   ├── useProfile.js      # Profile state + Supabase sync
│   │   ├── useMealLog.js      # Daily meal logging
│   │   └── useSubscription.js # Pro status
│   ├── styles/
│   │   └── tokens.js          # Design tokens (colors, fonts)
│   ├── App.jsx                # Root component
│   └── main.jsx               # Entry point
├── api/                        # Vercel serverless functions
│   └── webhooks/
│       └── stripe.js          # Stripe webhook handler
├── .env.example
├── .env.local                  # Your API keys (git ignored)
├── package.json
├── vite.config.js
├── index.html
└── README.md
```

---

## Development Roadmap

### Phase 1 — MVP Launch (Current → 2 weeks)
- [x] App shell + navigation
- [x] Onboarding flow with macro calculator
- [x] AI meal plan generation (Claude API)
- [x] Custom meal creator with ingredients
- [x] Smart grocery lists (Pro feature)
- [x] Branded splash screen
- [ ] Deploy to Vercel
- [ ] Supabase auth (email signup/login)
- [ ] Supabase data persistence
- [ ] Stripe Pro subscription
- [ ] PWA manifest + service worker

### Phase 2 — Core Improvements (Weeks 3-6)
- [ ] Food database search (OpenFoodFacts API / USDA)
- [ ] Barcode scanner (device camera API)
- [ ] Meal logging with daily history
- [ ] Weekly/monthly macro trends (charts)
- [ ] Household mode (partner profiles)
- [ ] Push notifications (meal reminders)
- [ ] Share grocery list (native share API)

### Phase 3 — Growth (Weeks 7-12)
- [ ] Social login (Google, Apple)
- [ ] Meal prep / batch cooking mode
- [ ] Recipe scaling
- [ ] Export data (CSV)
- [ ] Referral system
- [ ] Landing page + SEO
- [ ] App Store (via Capacitor wrapper)

---

## Revenue Projections

| Users | Free (80%) | Pro (20%) | Monthly Revenue |
|-------|-----------|-----------|-----------------|
| 100   | 80        | 20        | $99.80          |
| 500   | 400       | 100       | $499.00         |
| 1,000 | 800       | 200       | $998.00         |
| 5,000 | 4,000     | 1,000     | $4,990.00       |
| 10,000| 8,000     | 2,000     | $9,980.00       |

**Break-even costs:**
- Vercel hosting: Free (up to 100GB bandwidth)
- Supabase: Free (up to 50K monthly active users)
- Claude API: ~$0.003-0.01 per meal plan generation
- Stripe fees: 2.9% + $0.30 per transaction
- Domain: ~$14/year

**You're profitable from user #1.**

---

## Key Files Reference

| File | What it does |
|------|-------------|
| `src/lib/macros.js` | Mifflin-St Jeor equation, macro splits |
| `src/lib/claude.js` | Claude API prompt + response parsing |
| `src/lib/supabase.js` | Database client + auth helpers |
| `api/webhooks/stripe.js` | Handles subscription lifecycle |
| `public/manifest.json` | PWA install configuration |

---

## License

Proprietary — Kelex Ventures LLC. All rights reserved.
