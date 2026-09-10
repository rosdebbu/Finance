# 🛡️ CommitGuard Manifest V3 Chrome Extension Guide

## Overview
CommitGuard operates in **two coordinated modes**:
1. **The Web Prototype (`http://localhost:3000`):** An embedded zero-friction simulation with Scenario Switchers (E-Commerce EMI, Vehicle Loan vs SIP, and Neutral Public Rate Directory).
2. **The Real Chrome Extension (`src/extension`):** Injected directly into live checkout flows on **Amazon**, **Flipkart**, **Udemy**, and **MakeMyTrip** via an encapsulated **Shadow DOM (Shadow Root)**.

---

## 🏗️ Architecture: Why Shadow DOM is Mandatory

When injecting a React application into third-party e-commerce sites:
- **Host Style Bleed-Through:** Host CSS defines global overrides for `h1`, `button`, `div`, and `.modal`, which would collide with Tailwind classes.
- **Closed Shadow Root Solution:** We attach a closed Shadow Root to a dedicated host element (`#commitguard-extension-root`):
  ```ts
  const host = document.createElement('div');
  const shadowRoot = host.attachShadow({ mode: 'closed' });
  ```
- **Scoped Tailwind Injection:** Tailwind utility classes and stylesheets are injected directly into the Shadow Root, guaranteeing 100% style encapsulation.

---

## 📂 Extension Files Structure

- **[`manifest.json`](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/src/extension/manifest.json):** Manifest V3 configuration declaring background service workers, storage/activeTab permissions, action icons, and host permissions for `amazon.in`, `flipkart.com`, `udemy.com`, and `makemytrip.com`.
- **[`content.tsx`](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/src/extension/content.tsx):** The content script that detects the platform surface, intercepts final-commitment checkout actions, runs the 5-layer dynamic price scraper, and mounts the React modal.
- **[`CommitGuardModal.tsx`](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/src/extension/CommitGuardModal.tsx):** The interceptor modal containing:
  - Plain-English breakdown of hidden interest and GST friction.
  - Dual-Ledger Card Profile Switcher with category-aware reward forfeiture calculation.
  - Pre-checkout Credit Utilization Ratio (CUR) and CIBIL impact gauge.
  - Multi-item cart risk diagnostic alert banner.
  - Interactive EMI tenure slider with instant `<1.2ms` deterministic recalculation.
- **[`background.ts`](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/src/extension/background.ts):** Service worker managing extension telemetry and lifetime events.
- **[`styles.css`](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/src/extension/styles.css):** Tailored styles sheet injected inside the closed Shadow Root.
- **[`icons/`](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/src/extension/icons):** Official Manifest V3 icons (`icon16.png`, `icon48.png`, `icon128.png`).
- **[`build/`](file:///c:/Users/Anshumaan/Documents/GitHub/Finance/src/extension/build):** The compiled standalone directory ready to be loaded directly in Google Chrome.

---

## 🚀 How to Build and Load the Extension in Chrome (Developer Mode)

### 1. Build the Extension Bundle
Run the build script to bundle TypeScript, React, Tailwind CSS, manifest, and icons into `src/extension/build`:
```bash
npm run build:extension
```

### 2. Load into Chrome
1. Open Google Chrome and navigate to:
   ```
   chrome://extensions
   ```
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the build directory:
   ```
   c:\Users\Anshumaan\Documents\GitHub\Finance\src\extension\build
   ```
5. Navigate to any supported checkout flow:
   - **Amazon India:** `amazon.in`
   - **Flipkart:** `flipkart.com`
   - **Udemy:** `udemy.com`
   - **MakeMyTrip:** `makemytrip.com`
6. When committing to an order (e.g. clicking **Pay**, **Place Order**, or **Use this payment method**), CommitGuard intercepts with the math clarity modal.
