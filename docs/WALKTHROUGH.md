# 🛡️ CommitGuard: Verification Walkthrough & Architecture Log

## Summary of Fixes Implemented

### 1. Prototype Scope Lockdown (4 Platforms)
- **Flipkart** (`*://*.flipkart.com/*`)
- **Amazon** (`*://*.amazon.in/*`)
- **Udemy** (`*://*.udemy.com/*`)
- **MakeMyTrip** (`*://*.makemytrip.com/*`)
- Safely removed Cleartrip and UpGrad/EdTech permissions and listeners from `manifest.json` and `content.tsx`.

### 2. Udemy Dynamic Scraper & Cache Isolation
- Cleared stale unkeyed storage (`commitguard_udemy_live_price`).
- Implemented course-keyed (`commitguard_udemy_price_${courseSlug}`) and cart-keyed (`commitguard_udemy_cart_total`) session storage so navigating between courses never bleeds previous prices.
- **5-Source Live Extraction Engine for Udemy:**
  - **Source 1 (JSON-LD Structured Data):** Parses `<script type="application/ld+json">` `offers.price` directly from Schema.org markup.
  - **Source 2 (Clicked Button / Purchase Area):** Introspects clicked "Buy now" or "Checkout" button text and ancestors.
  - **Source 3 (Modern Selectors):** Supports course landing (`[data-purpose*="course-price-text"]`, `[data-purpose*="current-price"]`), cart (`[data-purpose*="shopping-cart-total"]`), and checkout (`[data-purpose*="total-price"]`, `[data-purpose*="summary-total"]`).
  - **Source 4 (Authoritative Regexes):** Matches `Total: ₹...`, `Order Total: ₹...`, and `Current price: ₹...`.
  - **Source 5 (Dynamic Title Extraction):** Scrapes real course title from `meta[property="og:title"]`, URL slug (`/course/the-complete-python-bootcamp/` ➔ `"The Complete Python Bootcamp"`), and headings, eliminating the static `"Fundamentals of Backend Engineering"` fallback.

### 3. 5-Layer Live Extraction Architecture (Amazon & Flipkart)
- Scrapes price directly from clicked action buttons (`Pay ₹...`, `Payment of ₹...`).
- Matches authoritative checkout labels (`Order Total: ₹...`, `Payment of ₹...`, `Subtotal`).
- Eliminates hardcoded dummy fallbacks (`32295`, `19999`, etc.).

---

## 🧪 Verification & Build Status
- **Deterministic Tests:** `npx tsx tests/engine.test.ts` passed (6/6 suites).
- **Extension Bundle:** `npm run build:extension` compiled cleanly to `src/extension/build/content.js`.
- **Git Commit:** Tracked in local repository.
