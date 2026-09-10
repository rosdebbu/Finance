# 🛡️ CommitGuard: Project Status & Implementation Roadmap

> **Current Prototype Scope:** Flipkart (`flipkart.com`), Amazon India (`amazon.in`), Udemy (`udemy.com`), and MakeMyTrip (`makemytrip.com`).

---

## 📚 Master Documentation & Implementation Index

All core implementation plans, deep research reports, architecture specs, and walkthroughs are permanently stored inside the project [`docs/`](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/docs) directory:

| Document | Purpose & Contents |
| :--- | :--- |
| [**`PROJECT_STATUS_AND_ROADMAP.md`**](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/docs/PROJECT_STATUS_AND_ROADMAP.md) | **Master Tracker:** Complete summary of finished work, active scope, and remaining roadmap items. |
| [**`RESEARCH_AND_FEATURE_PLAN.md`**](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/docs/RESEARCH_AND_FEATURE_PLAN.md) | **Deep Research:** Bank MITC clauses, Reddit `r/CreditCardsIndia` community data, Multi-cart poison pill, Forfeited rewards math, Pre-checkout CIBIL CUR impact, and Freelancer GST ITC claim. |
| [**`LIVE_PRICE_SCRAPING_PLAN.md`**](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/docs/LIVE_PRICE_SCRAPING_PLAN.md) | **Scraping Architecture:** 5-layer dynamic price extraction engine, session continuity (`sessionStorage`), and eradication of all hardcoded dummy fallback numbers (`32295`, `19999`, etc.). |
| [**`WALKTHROUGH.md`**](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/docs/WALKTHROUGH.md) | **Verification Log:** Build logs, test results, Udemy cache isolation fix, and prototype scope lockdown. |
| [**`PRD.md`**](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/docs/PRD.md) | **Product Requirements:** Complete PRD with problem statements, user personas, mathematical proofs, and safety guardrails. |
| [**`SYSTEM_WORKING_BLUEPRINT.md`**](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/docs/SYSTEM_WORKING_BLUEPRINT.md) | **System Architecture:** End-to-end component breakdown, data flows, and Shadow DOM injection mechanics. |
| [**`EXTENSION_GUIDE.md`**](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/docs/EXTENSION_GUIDE.md) | **Extension Manual:** Developer and user guide for running and testing the Chrome Extension. |
| [**`UI_SMOOTHNESS_GUIDE.md`**](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/docs/UI_SMOOTHNESS_GUIDE.md) | **Design Guidelines:** Micro-interactions, animations, and premium glassmorphism styling rules. |
| [**`TECH_STACK.md`**](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/docs/TECH_STACK.md) | **Technology Overview:** Dependencies, deterministic engine design, and bundler configurations. |

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
* **8/8 Automated Test Suites Passing (100% Precision):**
  - Test 1: No-Cost EMI calculation (₹80,000 laptop over 12 months).
  - Test 2: Premature FD penalty vs. Liquid Fund (₹5,00,000 at month 6).
  - Test 3: Post-tax real yield verification.
  - Test 4: Section 50AA regulatory policy trigger.
  - Test 5: Anti-Advisory heuristic guardrails.
  - Test 6: Multi-Item Cart EMI risk evaluator and leakage thresholds.
  - Test 7: Credit Utilization Ratio (CUR) / CIBIL Impact Simulator (Safe 18%, Caution 48%, Danger 75%).
  - Test 8: Dual-Ledger Forfeited Card Reward Calculator (₹65k Sony TV full-swipe vs. EMI forfeiture).

---

### 3. Chrome Extension Interceptor (`src/extension/`)
* **Platform Scope Lockdown:**
  - Restricted strictly to **Amazon.in**, **Flipkart.com**, **Udemy.com**, and **MakeMyTrip.com** in `manifest.json` and `content.tsx`.
  - Non-prototype platforms (Cleartrip, UpGrad, Scaler) safely removed.
* **Interception Trigger Fine-Tuning (Popup Glitch Fix):**
  - Excluded all selection inputs (`input[type="radio"]`, `input[type="checkbox"]`, and selection `<label>` elements) to ensure toggling payment methods never triggers premature popups.
  - Intercepts strictly on final commitment/advancement buttons:
    - `"Proceed to Buy"` / `"Proceed to Checkout"`
    - `"Use this payment method"` / `"Use this Payment Method"`
    - `"Place Order"` / `"Place your order"`
    - `"Pay ₹..."` / `"Complete Payment"`
    - `"Enroll now"` / `"Buy now"`
* **Closed Shadow DOM Root:**
  - Injected via `attachShadow({ mode: 'closed' })` to guarantee 0% CSS leakage between host websites and Tailwind styling.
* **CSP Security Compliance:**
  - Dispatches simulated synthetic events to eliminate Content Security Policy (`script-src 'self'`) inline script execution violations.
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
* **Official Extension Icons Bundled:**
  - Generated and bundled official Manifest V3 extension icons (`icon16.png`, `icon48.png`, `icon128.png`) in `src/extension/icons/` and `src/extension/build/icons/`.
* **Floating Instant Intel Pill:**
  - Injects a non-intrusive floating trigger on supported checkout pages for on-demand math verification.

---

### 4. Interactive Embedded Modal Dashboard (`CommitGuardModal.tsx`)
* **Dual-Ledger Card Switcher & Forfeited Rewards Calculator:**
  - Category-aware card database (`src/lib/card-rewards.ts`) covering 10+ popular Indian credit cards (Amazon Pay ICICI, Flipkart Axis, HDFC Infinia/Millennia, SBI Cashback, Axis Atlas/Magnus, etc.).
  - Computes exact cashback/reward points earned on full-swipe vs. 100% forfeiture on EMI conversion per bank MITC clauses.
  - Displays real-time side-by-side delta between full-swipe rewards vs. net EMI friction.
* **Pre-Checkout CIBIL / Credit Utilization Ratio (CUR) Danger Simulator:**
  - Pre-transaction card limit inputs with rapid presets (`₹50k`, `₹1L`, `₹2L`, or custom numeric input) and current balance tracking.
  - Visual color-coded gauge with safe (`< 30%`), caution (`30% - 50%`), and danger (`> 50%`) utilization tiering.
  - Computes prospective single-card utilization spike and potential 20–40 point CIBIL score drop risk before placing the order.
* **Interactive Tenure Snap Points:**
  - Supports 3, 6, 9, 12, 18, and 24-month tenure simulations with real-time recalculation of GST drag, processing fees, and effective APR.

---

## ⏳ Part 2: Pending Implementations & Roadmap

### 1. 💼 Freelancer / SMB GST Input Tax Credit (ITC) Reclaimer
* **Concept:** Many freelancers and sole proprietors make business electronics, tech accessories, and software purchases under standard personal B2C invoices, losing 18% in tax write-offs.
* **Features to Implement:**
  - For carts `> ₹5,000` on Amazon and Flipkart, display a non-intrusive banner:
    > *"Buying for business or freelance work? Claim back ₹X,XXX (18% GST Input Tax Credit) with your GSTIN before placing your order."*

---

### 2. ⚙️ Card Profile Persistence (`chrome.storage.sync`)
* **Concept:** Allow users to save their primary credit cards (e.g. Amazon Pay ICICI, Flipkart Axis) in `chrome.storage.sync` via the extension popup so their rewards profile is automatically pre-selected on checkout pages.

---

### 3. 🌐 End-to-End Live Extension Testing Across All 4 Domains
* **Live Validation:** Verify dynamic live price scraping and commitment trigger reliability on active merchant checkout sessions for Amazon India, Flipkart, Udemy, and MakeMyTrip.

---

## 🚫 Explicitly Rejected / Discarded Features
* **24-Hour Cooling-Off Storage Vault:**
  - *Status:* **Permanently Eliminated**.
  - *Rationale:* User feedback confirmed that artificial checkout delays and forced cold storage frustrate users. CommitGuard strictly provides instant, transparent math clarity at the exact moment of commitment.
