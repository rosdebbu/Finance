# Live Price Scraping Architecture & Hardcoded Fallback Elimination

Fix the price mismatch bug where CommitGuard displays a hardcoded fallback (`₹32,295`) instead of the actual live Amazon checkout amount (`₹26,190.00`, `₹31,763.00`, or UPI QR amounts).

## Root Cause Analysis

1. **Hardcoded Fallback Triggered:** In `src/extension/content.tsx`:
   ```ts
   const amazonFinalPrice = detectedPrice > 0 ? detectedPrice : 32295;
   ```
   When `detectedPrice` was `0`, it forcibly defaulted to `₹32,295`.
2. **Missing Checkout Selectors & Regexes:**
   - Amazon checkout (`/gp/buy/spc/`), payment selection (`/gp/buy/payselect/`), and UPI QR screens do not contain product page selectors (`#priceblock_ourprice`, `.a-price-whole`) or cart selectors (`#sc-subtotal-amount-activecart`).
   - Amazon checkout displays prices with labels like **"Order Total:"**, **"Pay ₹..."**, or **"Payment of ₹..."**, but `content.tsx` exclusively matched the word `"Subtotal"`.
   - The clicked element (`clickedEl`, such as the yellow button `Pay ₹31,763.00`) was never inspected for price text.
   - Price information was not preserved across multi-step checkout pages via `sessionStorage`.

---

## Key Architecture Decisions

1. **Zero Hardcoded Numbers Policy:** All static fallback prices (`32295`, `19999`, `13006`, `225000`, `539`) permanently removed across all surfaces.
2. **Session Continuity (`sessionStorage`):** Once a product/cart price is identified (e.g. on product page or cart view), it is stored in `sessionStorage` (`commitguard_amazon_live_price`). When proceeding to checkout, payment options, or UPI QR screens, CommitGuard uses this authoritative amount if live DOM elements are rendering or in transit.
3. **Live Extraction Priority:** Live DOM and clicked button prices take absolute precedence over session storage.

---

## 5-Layer Live Scraping Engine Architecture

### 1. Layer 1: Clicked Action Element Introspection
- Before running global DOM queries, inspect `clickedEl`:
  - Inspect `clickedEl.innerText`, `clickedEl.textContent`, `clickedEl.getAttribute('value')`, and `clickedEl.getAttribute('aria-label')`.
  - Extract prices matching `/(?:Pay|Payment\s*of|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i`.
  - If the user clicked `Pay ₹31,763.00`, immediately extract `31763`.

### 2. Layer 2: Authoritative Checkout & Payment Regexes on `bodyText`
- Specialized matchers in priority order:
  - `/(?:Order\s*Total|Grand\s*Total|Final\s*Total|Total\s*Payable|Amount\s*Payable)[^\d₹]*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/i` (matches `Order Total: ₹26,190.00` and `Order Total ₹31,763.00`)
  - `/(?:Payment\s*of)\s*₹?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i` (matches UPI QR screen `Payment of ₹ 31763.00`)
  - `/(?:Pay)\s*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/i` (matches `Pay ₹31,763.00`)
  - `/(?:Total:)[^\d₹]*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/i` (matches order summary total lines)
  - Existing `Subtotal` regexes for cart pages.

### 3. Layer 3: Authoritative Checkout DOM Selectors
- Amazon checkout and order summary table selectors:
  - `#subtotals-marketplace-table tr:last-child .a-color-price`
  - `#subtotals-marketplace-table .grand-total-price`
  - `.order-summary-grand-total`
  - `span.order-summary-grand-total`
  - `span.a-color-price.a-text-bold`
  - `[data-testid="order-summary-total"]`
  - `div[id*="order-summary"] .a-color-price`
  - `.pmts-total-amount`
  - `input[name*="placeYourOrder"]` (scrapes price from button text/value)

### 4. Layer 4: Cross-Step Checkout Session Continuity
- When a valid price and product/cart title is scraped on any Amazon page, save to `sessionStorage`:
  - `commitguard_amazon_live_price`
  - `commitguard_amazon_live_title`
- If on a subsequent payment screen (like UPI QR code) DOM selectors are inaccessible, read `commitguard_amazon_live_price` as the fallback before any generic scanning.

### 5. Layer 5: Complete Elimination of Dummy Fallback Numbers
- Removed `32295` in Amazon scraping logic.
- Removed `19999` in Flipkart scraping logic.
- Removed `13006` in Travel scraping logic.
- Removed `225000` in EdTech scraping logic.
- Removed `539` and `3439` in Udemy scraping logic.

### 6. Title Extraction Enhancement for Checkout
- Added Amazon checkout title selectors (`.item-row-title`, `.spc-product-title`, `[data-testid="item-title"]`, `.shipping-group .a-text-bold`) and fallback to `sessionStorage` title so the modal shows the actual product or cart description instead of `"Identified Amazon Product"`.
