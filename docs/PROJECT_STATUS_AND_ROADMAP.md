# 🛡️ CommitGuard: Project Status & Implementation Roadmap

> **Current Prototype Scope:** Flipkart (`flipkart.com`), Amazon India (`amazon.in`), Udemy (`udemy.com`), and MakeMyTrip (`makemytrip.com`).

---

## 📋 Part 1: Everything Completed So Far

### 1. Core Deterministic Financial Engine (`src/lib/financial-engine.ts`)
* **No-Cost EMI Reality Proof & Friction Math:**
  - Exposes the hidden merchant subvention discount vs. non-refundable 18% GST on monthly bank interest.
  - Computes exact upfront bank processing fee (₹199 + 18% GST = ₹234.82).
  - Calculates true effective APR (typically **19% – 23%+**) on advertised "0% interest" plans.
* **FD Break Penalty vs. Zero-Penalty Liquid Fund Simulator:**
  - Calculates the -1.00% premature withdrawal penal rate haircut.
  - Computes net rupee loss vs. sovereign zero-penalty overnight/liquid funds.
  - Automatically flags the "Liquidity Trap" condition.
* **Post-Tax Real Yield Engine:**
  - Adjusts nominal yields across marginal income tax slabs (0%, 5%, 20%, 30%) and CPI inflation.
  - Proves that a 7.20% FD yields **-0.44% real returns** for 30% slab taxpayers.
* **Regulatory Policy Trigger Evaluator:**
  - Real-time warnings for **Section 50AA** (debt mutual fund indexation removal), **RBI CoFT** (Card-on-File Tokenization), and **Section 80C** exhaustion.
* **Anti-Advisory Heuristic Scanner:**
  - Enforces SEBI RIA safe-harbor compliance by filtering subjective advice into factual mathematical proofs.
* **Multi-Item Cart EMI Risk Evaluator (`evaluateMultiCartEmiRisk`):**
  - Analyzes mixed-item shopping carts to detect when combining ineligible items invalidates merchant subvention discounts, exposing users to unadvertised interest leakage and GST drag.

---

### 2. Deterministic Test Suite (`tests/engine.test.ts`)
* **6/6 Automated Test Suites Passing (100% Precision):**
  - Test 1: No-Cost EMI calculation (₹80,000 laptop over 12 months).
  - Test 2: Premature FD penalty vs. Liquid Fund (₹5,00,000 at month 6).
  - Test 3: Post-tax real yield verification.
  - Test 4: Section 50AA regulatory policy trigger.
  - Test 5: Anti-Advisory heuristic guardrails.
  - Test 6: Multi-Item Cart EMI risk evaluator and leakage thresholds.

---

### 3. Chrome Extension Interceptor (`src/extension/`)
* **Platform Scope Lockdown:**
  - Restricted strictly to **Amazon.in**, **Flipkart.com**, **Udemy.com**, and **MakeMyTrip.com** in `manifest.json` and `content.tsx`.
  - Non-prototype platforms (Cleartrip, UpGrad, Scaler) safely removed.
* **Closed Shadow DOM Root:**
  - Injected via `attachShadow({ mode: 'closed' })` to guarantee 0% CSS leakage between host websites and Tailwind styling.
* **CSP Security Compliance:**
  - Dispatches simulated events to eliminate Content Security Policy (`script-src 'self'`) inline script execution violations.
* **5-Layer Live Dynamic Price Scraping Architecture:**
  - **Layer 1 (Clicked Button / Action Element):** Directly scrapes price from clicked buttons (`Pay ₹31,763.00`, `Payment of ₹...`, `Buy now at ₹...`).
  - **Layer 2 (Authoritative Checkout Regexes):** Scrapes `Order Total: ₹26,190.00`, `Order Total ₹31,763.00`, and UPI QR amounts.
  - **Layer 3 (Checkout DOM Selectors):** Scrapes `#subtotals-marketplace-table .grand-total-price`, `.order-summary-grand-total`, `.pmts-total-amount`.
  - **Layer 4 (Course-Isolated & Cart-Scoped Session Continuity):** Stores live prices in `sessionStorage` keyed to unique product slugs or cart IDs, preventing stale or cross-page cache pollution.
  - **Layer 5 (Schema.org JSON-LD Data for Udemy):** Reads `<script type="application/ld+json">` `offers.price` directly from structured metadata (immune to CSS class changes).
* **100% Elimination of Hardcoded Dummy Numbers:**
  - Completely purged static fallback numbers: `32295` (Amazon), `19999` (Flipkart), `13006` (Travel), `225000` (EdTech), `539`/`3439` (Udemy), and the static `"Fundamentals of Backend Engineering"` title fallback.
* **Udemy Scraper Overhaul:**
  - Wiped legacy unkeyed cache (`commitguard_udemy_live_price`).
  - Added multi-course cart detection and dynamic title scraping from OpenGraph metadata and humanized URL slugs.
* **Floating Instant Intel Pill:**
  - Injects a non-intrusive floating trigger on supported checkout pages for on-demand math verification.

---

### 4. Interactive Web Application & Modal Dashboard (`src/components/`, `src/app/`)
* Modern Next.js 14 dashboard with discrete tenure snap points (3, 6, 9, 12, 18, 24 months).
* Multi-item cart diagnostic warning banners.
* Real-time payment method comparison cards (UPI vs. No-Cost EMI vs. Bank Offers).

---

## ⏳ Part 2: Pending Implementations & Roadmap

### 1. 🎯 Interception Trigger Fine-Tuning (Popup Glitch Fix on Payment Selection)
* **Problem:** Currently, clicking payment method selection options (such as radio buttons `(•) EMI` or accordion headers) can trigger the modal prematurely while the user is still configuring their payment method.
* **Required Fix:** 
  - Strictly ignore `input[type="radio"]`, `input[type="checkbox"]`, and selection `<label>` elements.
  - Trigger interception **only** on final commitment/advancement buttons:
    - `"Proceed to Buy"`
    - `"Use this payment method"`
    - `"Pay ₹..."`
    - `"Place Order"`
    - `"Complete Payment"`
    - `"Enroll now"` / `"Buy now"`

---

### 2. 💳 Dual-Ledger Card Switcher & Forfeited Rewards Calculator
* **Concept:** Instead of pFinTools' clunky 15-bank dropdown, CommitGuard uses an **Adaptive Quick Card Switcher** (`Amazon Pay ICICI (5%)`, `Flipkart Axis (5%)`, `HDFC Infinia/Regalia`, `SBI Cashback`, or Custom %).
* **Features to Implement:**
  - Computes the exact monetary value of cashback/reward points forfeited by choosing an EMI installment over upfront payment.
  - Displays side-by-side comparison:
    - **Upfront Full-Swipe Benefit:** `+₹1,500` (Direct Cashback / Points).
    - **Net EMI Reality:** `-₹2,480` (18% GST Drag + Processing Fees + Forfeited Rewards).

---

### 3. 📉 Pre-Checkout CIBIL / Credit Utilization Ratio (CUR) Danger Simulator
* **Concept:** Existing tools (CRED, OneScore) only alert users **after** a credit score drops. CommitGuard warns the user **pre-transaction**.
* **Features to Implement:**
  - Quick credit limit input (`₹50k`, `₹1L`, `₹2L`, or custom numeric input).
  - Computes prospective utilization:
    $$\text{CUR} = \frac{\text{Order Principal} + \text{Existing Card Balance}}{\text{Credit Limit}} \times 100$$
  - Visual color-coded gauge:
    - 🟢 **Safe (`< 30%`):** Minimal score impact.
    - 🟡 **Caution (`30% - 50%`):** Mild utilization drag.
    - 🔴 **Danger (`> 50%`):** Warning of potential 20–40 point CIBIL score drop from high single-card utilization.

---

### 4. 💼 Freelancer / SMB GST Input Tax Credit (ITC) Reclaimer
* **Concept:** Many freelancers and sole proprietors make business electronics and software purchases under standard personal B2C invoices, losing 18% in tax write-offs.
* **Features to Implement:**
  - For carts `> ₹5,000` on Amazon and Flipkart, display a non-intrusive banner:
    > *"Buying for business or freelance work? Claim back ₹X,XXX (18% GST Input Tax Credit) with your GSTIN before placing your order."*

---

### 5. 📦 Production Packaging & Chrome Web Store Readiness
* **Icons & Assets:** Generate official Manifest V3 extension icons (16x16, 48x48, 128x128).
* **Settings & Preferences:** Allow users to save their primary credit cards (e.g. Amazon Pay ICICI, Flipkart Axis) in `chrome.storage.sync` so rewards math is pre-configured on every checkout.

---

## 🚫 Explicitly Rejected / Discarded Features
* **24-Hour Cooling-Off Storage Vault:**
  - *Status:* **Permanently Eliminated**.
  - *Rationale:* User feedback confirmed that artificial checkout delays and forced cold storage frustrate users. CommitGuard strictly provides instant, transparent math clarity at the exact moment of commitment.
