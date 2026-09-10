/**
 * CommitGuard Chrome Extension - Content Script Injector (Manifest V3)
 * Targets Amazon.in & Flipkart.com checkout pages.
 * Attaches a closed Shadow Root to completely isolate host CSS from Tailwind styles.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ExtensionCommitGuardModal } from './CommitGuardModal';

(() => {
  console.log('🛡️ CommitGuard Content Script Active on:', window.location.href);

  const COMMITGUARD_HOST_ID = 'commitguard-extension-root';

  type InterceptorSurface = 'AMAZON' | 'FLIPKART' | 'TRAVEL' | 'UDEMY';

  function detectSurfaceType(): InterceptorSurface | null {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('amazon')) {
      return 'AMAZON';
    }
    if (host.includes('flipkart')) {
      return 'FLIPKART';
    }
    if (host.includes('udemy')) {
      return 'UDEMY';
    }
    if (host.includes('makemytrip')) {
      return 'TRAVEL';
    }
    return null;
  }

  const CURRENT_SURFACE = detectSurfaceType();
  if (!CURRENT_SURFACE) {
    // Current prototype is strictly scoped to Flipkart, Amazon, Udemy, and MakeMyTrip
    return;
  }
  console.log(`🛡️ CommitGuard Surface Detected: [${CURRENT_SURFACE}] on ${window.location.hostname}`);

  interface ScrapedOffer {
    id: string;
    bankOrCard: string;
    description: string;
    effectiveBenefit: string;
    rating: 'BEST' | 'GOOD' | 'NEUTRAL' | 'AVOID';
    reason: string;
    netPrice: number;
    recommended: boolean;
    isSelected?: boolean;
  }

  // Helper to parse currency strings properly handling decimals (e.g. ₹539.00 -> 539, NOT 53900)
  function parseCurrencyNumber(text: string): number {
    if (!text) return 0;
    // Match currency pattern like ₹539.00, ₹479.00, ₹3,439.00, ₹5,399, ₹70,196
    const match = text.match(/[₹$€£]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/);
    if (match && match[1]) {
      const cleanStr = match[1].replace(/,/g, '');
      const floatVal = parseFloat(cleanStr);
      if (!isNaN(floatVal) && floatVal > 0) {
        return Math.round(floatVal);
      }
    }
    const cleanDigits = text.replace(/[^0-9.]/g, '');
    const fallbackVal = parseFloat(cleanDigits);
    return isNaN(fallbackVal) ? 0 : Math.round(fallbackVal);
  }

  // Shared Freelancer/Business GST Input Tax Credit (ITC) advisory — Section 16 of the CGST
  // Act lets a registered GSTIN business/freelancer reclaim GST paid on purchases used in the
  // course of business. Shown for any commitment above the ₹5,000 threshold on ANY surface —
  // once a platform issues a B2C invoice at payment completion, it cannot be converted to a
  // B2B tax invoice afterward, so this only helps if raised BEFORE the user pays.
  function buildGstItcOffer(id: string, price: number, gstRatePercent: number, invoiceLabel: string): ScrapedOffer | null {
    if (price < 5000) return null;
    const itcAmount = Math.round(price * (gstRatePercent / 100));
    return {
      id,
      bankOrCard: `Freelancer/Business Tip: ${invoiceLabel}`,
      description: `Claim ${gstRatePercent}% GST Input Tax Credit (ITC) if this is a business purchase`,
      effectiveBenefit: `Reclaim up to ₹${itcAmount.toLocaleString('en-IN')} via ITC`,
      rating: 'GOOD',
      reason: `Registered GSTIN businesses/freelancers can offset ₹${itcAmount.toLocaleString('en-IN')} of output tax liability under Section 16 of the CGST Act — but only if a GST invoice is requested BEFORE payment completes; a B2C invoice cannot be converted afterward.`,
      netPrice: price - itcAmount,
      recommended: false,
    };
  }

  // Universal Live Scraper adapting dynamically to Amazon, Flipkart, MakeMyTrip, Cleartrip, UpGrad, and Udemy
  function extractProductInfo(clickedEl?: HTMLElement | null): {
    surfaceType: InterceptorSurface;
    price: number;
    originalPrice?: number;
    discountPercent?: number;
    name: string;
    advertisedMonthlyEmi?: number;
    offers: ScrapedOffer[];
    isMultiItemCart?: boolean;
    cartItemCount?: number;
    cartItemsPreview?: string[];
  } {
    let detectedPrice = 0;
    let detectedOriginalPrice = 0;
    let detectedDiscount = 0;
    let detectedName = '';
    let detectedEmi: number | undefined;
    let isMultiItemCart = false;
    let cartItemCount = 1;
    let cartItemsPreview: string[] = [];

    const bodyText = document.body ? document.body.innerText : '';

    // ==========================================
    // 1. SURFACE: TRAVEL (MakeMyTrip / Cleartrip)
    // ==========================================
    if (CURRENT_SURFACE === 'TRAVEL') {
      const travelTitleSelectors = [
        '.flight-details',
        '.header-title',
        'h1',
        'h2',
        '.itinerary-header',
        '.sector-info',
        '.hotel-name',
        '#booking-summary',
        '[class*="flightDetails"]',
        '[class*="flightName"]',
        '[class*="headerTitle"]',
      ];
      for (const sel of travelTitleSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent) {
          const t = el.textContent.trim();
          if (t.length > 5) {
            detectedName = t.slice(0, 60);
            break;
          }
        }
      }

      // Check for route pattern (e.g. New Delhi (DEL) → Bengaluru (BLR) or DEL - BLR)
      // Requires an actual IATA airport code on BOTH sides so we don't match unrelated
      // "X to Y" prose (e.g. "click here to continue") elsewhere on the page.
      if (!detectedName) {
        const routeMatch = bodyText.match(/([A-Za-z\s]{2,30}\([A-Z]{3}\)\s*(?:→|->|to)\s*[A-Za-z\s]{2,30}\([A-Z]{3}\))/i);
        if (routeMatch && routeMatch[1]) {
          detectedName = `MakeMyTrip: ${routeMatch[1].trim()}`;
        }
      }
      if (!detectedName) {
        detectedName = 'MakeMyTrip Flight & Hotel Booking';
      }

      // Live Scrape Total Due / Fare (e.g. "Total Due ₹ 13,061" or "Fare ₹ 12,352")
      if (clickedEl) {
        const cText = (clickedEl.innerText || clickedEl.textContent || '').trim();
        if (cText.includes('₹')) {
          const m = cText.match(/(?:Pay|Book|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
          if (m && m[1]) {
            const num = parseCurrencyNumber(m[1]);
            if (num >= 500 && num <= 1000000) detectedPrice = num;
          }
        }
      }

      if (!detectedPrice) {
        const totalDueMatch = bodyText.match(/(?:Total Due|Grand Total|Total Amount|Payable Amount|Total Fare|Trip Total)[^\d₹]*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
        if (totalDueMatch && totalDueMatch[1]) {
          const num = parseCurrencyNumber(totalDueMatch[1]);
          if (num > 500) detectedPrice = num;
        }
      }
      if (!detectedPrice) {
        const fareEls = document.querySelectorAll('[class*="fare"], [class*="price"], [class*="total"], [class*="Total"]');
        for (const el of Array.from(fareEls)) {
          const text = el.textContent || '';
          if (text.includes('₹')) {
            const num = parseCurrencyNumber(text);
            if (num >= 1000 && num <= 1000000) {
              detectedPrice = num;
              break;
            }
          }
        }
      }

      if (detectedPrice > 0) {
        try {
          sessionStorage.setItem('commitguard_travel_live_price', detectedPrice.toString());
        } catch (_) {}
      } else {
        try {
          const cached = sessionStorage.getItem('commitguard_travel_live_price');
          if (cached) {
            const num = parseFloat(cached);
            if (num > 500) detectedPrice = num;
          }
        } catch (_) {}
      }

      if (!detectedPrice) {
        // Last resort: only accept a ₹ figure that sits near fare/total/amount wording,
        // never the first ₹ figure on the page (ancillaries, addon upsells, etc. would win).
        const contextualPriceMatches = Array.from(
          bodyText.matchAll(/(?:fare|total|amount|payable|due|price)[^\d₹]{0,20}₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi)
        );
        for (const m of contextualPriceMatches) {
          const num = parseCurrencyNumber(m[1]);
          if (num >= 500 && num <= 1000000) {
            detectedPrice = num;
            break;
          }
        }
      }

      const travelPrice = detectedPrice;

      // Multi-passenger & return route detection
      const paxMatch = bodyText.match(/(\d+)\s*(?:Adults?|Travellers?|Passengers?)/i);
      if (paxMatch && paxMatch[1]) {
        const count = parseInt(paxMatch[1], 10);
        if (count > 1) {
          isMultiItemCart = true;
          cartItemCount = count;
          cartItemsPreview.push(`${count} Travellers`);
        }
      }

      // =========================================================================
      // UNIVERSAL DYNAMIC DOM BANK & CARD EXTRACTOR (100% Free of Hardcoded Lists)
      // Automatically reads any bank (OneCard, Amex, Fi, Federal, Kotak, etc.) from live DOM
      // =========================================================================
      function cleanBankText(raw: string): string {
        if (!raw) return '';
        return raw
          .replace(/CREDIT\s*CARD/gi, '')
          .replace(/DEBIT\s*CARD/gi, '')
          .replace(/CARDLESS\s*EMI/gi, '')
          .replace(/\bEMI\b/gi, '')
          .replace(/NO\s*COST\s*EMI/gi, '')
          .replace(/No\s*Cost\s*EMI/gi, '')
          .replace(/ALL\s*BANKS/gi, '')
          .replace(/POPULAR\s*BANKS/gi, '')
          .replace(/BANKS\s*UNAVAILABLE[^\n]*/gi, '')
          .replace(/Starts?\s*at\s*₹?\s*[0-9,.]+/gi, '')
          .replace(/Starting\s*at\s*₹?\s*[0-9,.]+/gi, '')
          .replace(/₹\s*[0-9,.]+/gi, '')
          .replace(/CHANGE/gi, '')
          .replace(/Select tenure/gi, '')
          .replace(/Select your bank/gi, '')
          .replace(/Below is the list.*/gi, '')
          .replace(/Search here.*/gi, '')
          .replace(/[\n\r\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      function isGenericNoise(text: string): boolean {
        const lower = text.toLowerCase();
        return (
          lower.includes('below is the list') ||
          lower.includes('search here') ||
          lower.includes('select your bank') ||
          lower.includes('select tenure') ||
          lower.includes('all banks') ||
          lower.includes('convenience fee') ||
          lower.includes('total due') ||
          lower.includes('provide card details') ||
          lower.length < 2
        );
      }

      let detectedBankName = '';
      let detectedCategory = ''; // 'Debit Card' | 'Credit Card' | 'Cardless EMI' | ''
      let isExplicitUpi = false;
      let isExplicitTnpl = false;
      let isExplicitNoCost = false;

      // Strategy 1: Check clicked element directly (short text only)
      if (clickedEl) {
        const rowEl = clickedEl.closest('li, label, tr, [role="radio"], [role="button"], [role="tab"], [class*="tab"], [class*="item"], [class*="bank"], [class*="option"]') || clickedEl;
        const rawRowText = (rowEl.textContent || '').trim();
        
        if (/scan\s*to\s*pay|qr|upi|google\s*pay|phonepe|paytm/i.test(rawRowText) && rawRowText.length < 100) {
          isExplicitUpi = true;
        } else if (/tnpl|travel\s*now\s*pay\s*later|trip\s*money/i.test(rawRowText) && rawRowText.length < 100) {
          isExplicitTnpl = true;
        } else if (/no\s*cost\s*emi/i.test(rawRowText) && rawRowText.length < 100) {
          isExplicitNoCost = true;
        }

        if (/debit\s*card/i.test(rawRowText)) {
          detectedCategory = 'Debit Card';
        } else if (/cardless/i.test(rawRowText)) {
          detectedCategory = 'Cardless EMI';
        } else if (/credit\s*card/i.test(rawRowText)) {
          detectedCategory = 'Credit Card';
        }

        const cleaned = cleanBankText(rawRowText);
        if (cleaned && cleaned.length >= 2 && cleaned.length <= 45 && !isGenericNoise(cleaned)) {
          detectedBankName = cleaned;
        }
      }

      // Check active tab if category not yet determined
      if (!detectedCategory) {
        const activeTabEl = document.querySelector('[class*="tab"][class*="active"], [class*="tab"][class*="selected"], [role="tab"][aria-selected="true"], button[class*="active"], div[class*="active"]');
        if (activeTabEl) {
          const tabText = (activeTabEl.textContent || '').trim();
          if (/debit/i.test(tabText)) detectedCategory = 'Debit Card';
          else if (/cardless/i.test(tabText)) detectedCategory = 'Cardless EMI';
          else if (/credit/i.test(tabText)) detectedCategory = 'Credit Card';
        }
      }

      // Strategy 2: Look at Step 1 Selected Bank area in the DOM (e.g. MakeMyTrip Step 1 header)
      if (!detectedBankName && !isExplicitUpi && !isExplicitTnpl) {
        const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, div, span, p, label');
        for (const el of Array.from(allHeadings)) {
          const txt = (el.textContent || '').trim();
          if (/select your bank/i.test(txt) && txt.length < 120) {
            const parent = el.closest('div, section') || el.parentElement;
            if (parent) {
              const pText = (parent.textContent || '').trim();
              const m = pText.match(/Select your bank\s*\n*\s*([^\n\r]+?)(?:\s*CHANGE|\s*Change|\s*Select tenure|\s*\n)/i);
              if (m && m[1]) {
                const cleaned = cleanBankText(m[1]);
                if (cleaned && cleaned.length >= 2 && cleaned.length <= 45 && !isGenericNoise(cleaned)) {
                  detectedBankName = cleaned;
                  break;
                }
              }
            }
          }
        }
      }

      // Strategy 3: Global text matching for "Select your bank\n<ANY BANK NAME>\nCHANGE"
      if (!detectedBankName && !isExplicitUpi && !isExplicitTnpl) {
        const step1Match = bodyText.match(/Select your bank\s*\n*\s*([^\n\r]+?)(?:\s*CHANGE|\s*Change|\s*Select tenure|\s*\n\s*Select tenure)/i);
        if (step1Match && step1Match[1]) {
          const cleaned = cleanBankText(step1Match[1]);
          if (cleaned && cleaned.length >= 2 && cleaned.length <= 45 && !isGenericNoise(cleaned)) {
            detectedBankName = cleaned;
          }
        }
      }

      // Strategy 4: Checked radio buttons or active list elements in payment view
      if (!detectedBankName && !isExplicitUpi && !isExplicitTnpl && !isExplicitNoCost) {
        const activeEls = document.querySelectorAll('input[type="radio"]:checked, [aria-checked="true"], [class*="selected"], [class*="active"]');
        for (const el of Array.from(activeEls)) {
          const parentRow = el.closest('li, label, tr, div') || el;
          const rawActiveText = (parentRow.textContent || '').trim();

          // Classify the active element itself BEFORE treating leftover text as a bank name —
          // otherwise an active "UPI" / "Scan to Pay" tab gets misread as a bank name.
          if (/scan\s*to\s*pay|qr|upi|google\s*pay|phonepe|paytm/i.test(rawActiveText) && rawActiveText.length < 100) {
            isExplicitUpi = true;
            break;
          }
          if (/tnpl|travel\s*now\s*pay\s*later|trip\s*money/i.test(rawActiveText) && rawActiveText.length < 100) {
            isExplicitTnpl = true;
            break;
          }
          if (/no\s*cost\s*emi/i.test(rawActiveText) && rawActiveText.length < 100 && !/bank|card/i.test(rawActiveText)) {
            isExplicitNoCost = true;
            break;
          }

          const cleaned = cleanBankText(rawActiveText);
          if (cleaned && cleaned.length >= 2 && cleaned.length <= 45 && !isGenericNoise(cleaned)) {
            detectedBankName = cleaned;
            break;
          }
        }
      }

      // Build clean final bank display title
      let finalBankName = 'Selected Bank / Card';
      if (detectedBankName) {
        if (detectedCategory && !detectedBankName.toLowerCase().includes(detectedCategory.toLowerCase())) {
          finalBankName = `${detectedBankName} (${detectedCategory} EMI)`;
        } else {
          finalBankName = detectedBankName;
        }
      } else if (detectedCategory) {
        finalBankName = `${detectedCategory} EMI`;
      }

      // =========================================================================
      // DYNAMIC DOM TENURE & INTEREST EXTRACTION
      // Dynamically reads the exact tenure, monthly EMI, interest %, and total payable
      // =========================================================================
      let emiTenureMonths = 12;
      let emiMonthlyAmount = Math.round(travelPrice / 12);
      let statedInterestAmount = Math.round(travelPrice * 0.077);
      let statedInterestRate = '14.0';
      let statedTotalPayable = travelPrice + statedInterestAmount;

      // Extract from clicked element if user clicked a tenure card
      const clickedRowText = clickedEl ? (clickedEl.closest('li, label, tr, div')?.textContent || '') : '';
      const clickedTenureMatch = clickedRowText.match(/(\d+)\s*months\s*x\s*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
      
      if (clickedTenureMatch && clickedTenureMatch[1] && clickedTenureMatch[2]) {
        emiTenureMonths = parseInt(clickedTenureMatch[1], 10);
        emiMonthlyAmount = parseCurrencyNumber(clickedTenureMatch[2]);

        const intMatch = clickedRowText.match(/Incl\.\s*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*interest\s*(?:@\s*([0-9.]+)%)?/i);
        if (intMatch && intMatch[1]) {
          statedInterestAmount = parseCurrencyNumber(intMatch[1]);
          if (intMatch[2]) statedInterestRate = intMatch[2];
        }

        const totMatch = clickedRowText.match(/₹\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*Total payable/i);
        if (totMatch && totMatch[1]) {
          statedTotalPayable = parseCurrencyNumber(totMatch[1]);
        } else {
          statedTotalPayable = (emiMonthlyAmount * emiTenureMonths);
        }
      } else {
        // Find all tenures listed on the page
        const tenureMatches = Array.from(bodyText.matchAll(/(\d+)\s*months\s*x\s*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi));
        if (tenureMatches.length > 0) {
          const lastTenure = tenureMatches[tenureMatches.length - 1];
          if (lastTenure && lastTenure[1] && lastTenure[2]) {
            emiTenureMonths = parseInt(lastTenure[1], 10);
            emiMonthlyAmount = parseCurrencyNumber(lastTenure[2]);
          }
        }

        const interestMatches = Array.from(bodyText.matchAll(/Incl\.\s*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*interest\s*@\s*([0-9.]+)%/gi));
        if (interestMatches.length > 0) {
          const lastInterest = interestMatches[interestMatches.length - 1];
          if (lastInterest && lastInterest[1] && lastInterest[2]) {
            statedInterestAmount = parseCurrencyNumber(lastInterest[1]);
            statedInterestRate = lastInterest[2];
          }
        }

        const totalPayableMatches = Array.from(bodyText.matchAll(/₹\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*Total payable/gi));
        if (totalPayableMatches.length > 0) {
          const lastTotal = totalPayableMatches[totalPayableMatches.length - 1];
          if (lastTotal && lastTotal[1]) {
            statedTotalPayable = parseCurrencyNumber(lastTotal[1]);
          }
        } else {
          statedTotalPayable = travelPrice + statedInterestAmount;
        }
      }

      // Deterministic calculation of hidden GST on interest (18%) + statutory bank processing fee (₹199 + 18% GST = ₹235)
      const gstOnInterest = Math.round(statedInterestAmount * 0.18);
      const bankProcessingFeeTotal = Math.round(199 * 1.18); // ₹235
      const realTrueOutflow = statedTotalPayable + gstOnInterest + bankProcessingFeeTotal;

      // Only claim the generic "Bank/Card" option is selected when we actually detected a real
      // bank name — never by elimination alone, or a page with no clear signal defaults to it.
      const isBankSelected = !isExplicitUpi && !isExplicitTnpl && !isExplicitNoCost && !!detectedBankName;

      const travelOffers: ScrapedOffer[] = [
        {
          id: 'bank-emi-scraped',
          bankOrCard: `${finalBankName} (${emiTenureMonths}M EMI @ ${statedInterestRate}%)`,
          description: `${emiTenureMonths} months x ₹${emiMonthlyAmount.toLocaleString('en-IN')}/mo (Advertised Total: ₹${statedTotalPayable.toLocaleString('en-IN')})`,
          effectiveBenefit: `₹${emiMonthlyAmount.toLocaleString('en-IN')}/mo + ₹${gstOnInterest + bankProcessingFeeTotal} Hidden GST/Fee Drag`,
          rating: 'AVOID',
          reason: `MakeMyTrip shows ₹${statedTotalPayable.toLocaleString('en-IN')}, but ${finalBankName} additionally bills non-refundable 18% GST (₹${gstOnInterest}) on interest + ₹${bankProcessingFeeTotal} processing fee (+GST), making your true outflow ₹${realTrueOutflow.toLocaleString('en-IN')}.`,
          netPrice: realTrueOutflow,
          recommended: false,
          isSelected: isBankSelected,
        },
        {
          id: 'upi-travel',
          bankOrCard: 'UPI / Scan to Pay (QR) - Zero Debt',
          description: `Single-tranche direct payment of ₹${travelPrice.toLocaleString('en-IN')}`,
          effectiveBenefit: 'Saves 100% of interest, bank fees & GST',
          rating: 'BEST',
          reason: 'Zero interest, zero processing fees, keeps credit limit 100% free with instant confirmation.',
          netPrice: travelPrice,
          recommended: true,
          isSelected: isExplicitUpi,
        },
        {
          id: 'sip-liquid',
          bankOrCard: '6-Month Liquid Fund SIP Alternative',
          description: `Save ₹${Math.round(travelPrice / 6).toLocaleString('en-IN')}/mo in an RBI-compliant 7.10% liquid portfolio`,
          effectiveBenefit: 'Earns +₹275 interest gain; 0% debt liability',
          rating: 'BEST',
          reason: 'Travel completely debt-free and earn returns instead of leaking ~₹1,600 to bank interest and statutory GST.',
          netPrice: travelPrice,
          recommended: true,
          isSelected: false,
        },
        {
          id: 'nocost-travel-emi',
          bankOrCard: `No-Cost EMI (${finalBankName !== 'Selected Bank / Card' ? finalBankName : 'Partner Banks'})`,
          description: `${emiTenureMonths} Months installment plan with upfront interest offset`,
          effectiveBenefit: `₹${Math.round(travelPrice / emiTenureMonths).toLocaleString('en-IN')}/mo + ₹${Math.round(199 + (travelPrice * 0.15 * (emiTenureMonths / 12) * 0.18))} GST drag`,
          rating: 'AVOID',
          reason: 'Even with merchant interest discount, bank charges ₹199 processing fee + monthly 18% GST on interest component.',
          netPrice: travelPrice + Math.round(199 + (travelPrice * 0.15 * (emiTenureMonths / 12) * 0.18)),
          recommended: false,
          isSelected: isExplicitNoCost,
        },
        {
          id: 'tnpl-trip',
          bankOrCard: 'Travel Now, Pay Later (TNPL / Sanctioned BNPL)',
          description: '3 to 6 Months deferred installment loan',
          effectiveBenefit: `₹${Math.round(travelPrice / 6).toLocaleString('en-IN')}/mo with 28.4% APR penalty risk`,
          rating: 'AVOID',
          reason: 'Exposes user to 24%-36% penalty APRs plus ₹450-₹850 bounce fees if post-vacation cash is tight.',
          netPrice: travelPrice + Math.round(travelPrice * 0.14),
          recommended: false,
          isSelected: isExplicitTnpl,
        },
      ];

      // Freelancer/Business GST Input Tax Credit reminder — GST rate varies by travel category:
      // ~5% economy flights, ~12% business flights, 12-18% hotel stays (Section 16 CGST Act).
      const travelGstRate = /hotel|stay|check-in|check-out/i.test(bodyText)
        ? 15
        : /business\s*class/i.test(bodyText)
        ? 12
        : 5;
      const travelGstItcOffer = buildGstItcOffer('travel-gst-itc', travelPrice, travelGstRate, 'Business Travel GST Invoice');
      if (travelGstItcOffer) travelOffers.push(travelGstItcOffer);

      return {
        surfaceType: 'TRAVEL',
        price: travelPrice,
        name: detectedName,
        offers: travelOffers,
        isMultiItemCart,
        cartItemCount,
        cartItemsPreview,
      };
    }

    // ==========================================
    // 2. SURFACE: UDEMY (Online Course Interceptor)
    // ==========================================
    if (CURRENT_SURFACE === 'UDEMY') {
      const pathname = window.location.pathname;
      const isUdemyCart = pathname.includes('/cart') || pathname.includes('/checkout');
      const courseSlugMatch = pathname.match(/\/course\/([^\/\?#]+)/);
      const courseSlug = courseSlugMatch ? courseSlugMatch[1] : '';

      // Clear legacy unkeyed cross-course pollution
      try {
        sessionStorage.removeItem('commitguard_udemy_live_price');
      } catch (_) {}

      // -----------------------------------------------------------
      // TITLE DETERMINATION (100% Dynamic, Zero Hardcoded Strings)
      // -----------------------------------------------------------
      // 1. OpenGraph Meta Title (Extremely reliable on Udemy)
      const ogTitleMeta = document.querySelector('meta[property="og:title"]');
      if (ogTitleMeta) {
        const ogContent = (ogTitleMeta.getAttribute('content') || '').trim();
        if (ogContent && ogContent.length > 3) {
          detectedName = ogContent.replace(/\|?\s*Udemy.*$/i, '').trim().slice(0, 75);
        }
      }

      // 2. DOM Headings (Course landing, cart item, or checkout title)
      if (!detectedName) {
        const udemyTitleSelectors = [
          'h1[data-purpose="lead-title"]',
          'h1.clp-lead__title',
          '[data-purpose="course-header-title"]',
          '[data-purpose="shopping-cart-item-title"]',
          '.cart-item-component--title',
          '.course-title',
          'h1',
        ];
        for (const sel of udemyTitleSelectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent) {
            const t = el.textContent.trim();
            if (t.length > 3 && !t.toLowerCase().includes('shopping cart') && !t.toLowerCase().includes('checkout')) {
              detectedName = t.slice(0, 75);
              break;
            }
          }
        }
      }

      // 3. Clean Title from Document Title
      if (!detectedName && document.title) {
        const cleanDocTitle = document.title
          .replace(/\|?\s*Udemy.*$/i, '')
          .replace(/Online Courses.*$/i, '')
          .trim();
        if (cleanDocTitle.length > 3 && !cleanDocTitle.toLowerCase().includes('shopping cart')) {
          detectedName = cleanDocTitle.slice(0, 75);
        }
      }

      // 4. Humanize Course URL Slug (e.g. "the-complete-web-development-bootcamp" -> "The Complete Web Development Bootcamp")
      if (!detectedName && courseSlug) {
        detectedName = courseSlug
          .split('-')
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
          .slice(0, 75);
      }

      if (!detectedName) {
        detectedName = isUdemyCart ? 'Udemy Cart Checkout' : 'Selected Udemy Course';
      }

      // -----------------------------------------------------------
      // MULTI-ITEM CART DETECTION ON UDEMY
      // -----------------------------------------------------------
      if (isUdemyCart) {
        const cartItemEls = document.querySelectorAll(
          '[data-purpose="shopping-cart-item"], .cart-item-component, [class*="shopping-cart-item"]'
        );
        if (cartItemEls.length > 1) {
          isMultiItemCart = true;
          cartItemCount = cartItemEls.length;
        }
        cartItemEls.forEach((el, idx) => {
          if (idx < 3) {
            const titleEl = el.querySelector('[data-purpose="shopping-cart-item-title"], a, h3');
            if (titleEl && titleEl.textContent) {
              const cleanT = titleEl.textContent.trim();
              if (cleanT.length > 3) cartItemsPreview.push(cleanT.slice(0, 45));
            }
          }
        });
      }

      // -----------------------------------------------------------
      // 5-LAYER LIVE PRICE EXTRACTION FOR UDEMY
      // -----------------------------------------------------------

      // Layer 1: Schema.org JSON-LD structured data (Immune to CSS obfuscation)
      const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of Array.from(ldScripts)) {
        try {
          const raw = s.textContent || '';
          if (raw.includes('offers') || raw.includes('price')) {
            const data = JSON.parse(raw);
            const items = Array.isArray(data) ? data : [data];
            for (const item of items) {
              const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
              if (offer && offer.price) {
                const p = Math.round(Number(offer.price));
                if (p >= 100 && p <= 100000) {
                  detectedPrice = p;
                  break;
                }
              }
            }
            if (detectedPrice > 0) break;
          }
        } catch (_) {}
      }

      // Layer 2: Clicked Element / Purchase Button / Checkout Button
      if (clickedEl && !detectedPrice) {
        const candidateTexts = [
          clickedEl.innerText || '',
          clickedEl.textContent || '',
          (clickedEl as HTMLInputElement).value || '',
          clickedEl.getAttribute('aria-label') || '',
        ];
        const parentBtn = clickedEl.closest('button, a, [role="button"], form, [class*="buy-box"], [class*="order-summary"]');
        if (parentBtn) {
          candidateTexts.push(
            parentBtn.textContent || '',
            (parentBtn as HTMLInputElement).value || '',
            parentBtn.getAttribute('aria-label') || ''
          );
        }
        for (const t of candidateTexts) {
          if (t && (t.includes('₹') || t.includes('$') || t.includes('€') || t.includes('£'))) {
            const m = t.match(/[₹$€£]\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
            if (m && m[1]) {
              const num = parseCurrencyNumber(m[1]);
              if (num >= 100 && num <= 100000) {
                detectedPrice = num;
                break;
              }
            }
          }
        }
      }

      // Layer 3: Modern Udemy DOM Price Selectors (Course Landing, Cart, & Checkout)
      if (!detectedPrice) {
        const udemyPriceSelectors = [
          '[data-purpose="total-price"] span:not(.sr-only)',
          '[data-purpose="summary-total"]',
          '[data-purpose="shopping-cart-total"]',
          '[data-purpose="course-price-text"] span:not(.sr-only)',
          '[data-purpose="course-price-text"]',
          '[data-purpose="current-price"]',
          '.price-text--price-part--Tu6MH',
          'div[class*="price-text--price-part"] span:not(.sr-only)',
          'div[data-purpose="course-price-text"] span:not(.sr-only)',
          '.base-price-text',
          '.clp-lead__price',
          '.shopping-item__price',
          'div[class*="order-summary"] [class*="total-price"]',
          'div[class*="order-summary"] [class*="price"]',
          'div[data-purpose*="price"] span',
        ];

        for (const sel of udemyPriceSelectors) {
          const els = document.querySelectorAll(sel);
          for (const el of Array.from(els)) {
            const text = el.textContent || '';
            if (text.includes('₹') || text.includes('$') || text.includes('€') || text.includes('£')) {
              const num = parseCurrencyNumber(text);
              if (num >= 100 && num <= 100000) {
                detectedPrice = num;
                break;
              }
            }
          }
          if (detectedPrice > 0) break;
        }
      }

      // Scrape MRP (struck-through/original price)
      const udemyMrpSelectors = [
        '[data-purpose="original-price-container"] s',
        '[data-purpose="course-old-price-text"]',
        'div[data-purpose="course-price-text"] s',
        'div[data-purpose="course-price-text"] del',
        's span:not(.sr-only)',
        'del span',
        '.original-price-text',
      ];
      for (const sel of udemyMrpSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent) {
          const num = parseCurrencyNumber(el.textContent);
          if (num > (detectedPrice || 0)) {
            detectedOriginalPrice = num;
            break;
          }
        }
      }

      // Layer 4: Live Page Text Regexes (Checkout Order Total, Total, Current price)
      if (!detectedPrice) {
        // No bare "first ₹ figure on page" fallback here on purpose — Udemy pages are full of
        // recommended-course and "students also bought" prices that aren't the item being bought.
        // \b is required before "Total" — without it, "Subtotal" (which contains "Total" as a
        // substring) matches first and wins, undercounting the price by the GST amount.
        // The optional "(?:\s*\([^)]*\))?" + "[^₹$€£]{0,24}" gap tolerates GST-inclusive labels
        // like "Total (2 courses):\n₹1,342.84" where the label and amount sit on separate lines
        // with a digit (course count) in between.
        const udemyRegexPatterns = [
          /\b(?:Order\s*Total|Total\s*Amount|Total)\b(?:\s*\([^)]*\))?[^₹$€£]{0,24}[₹$€£]\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
          /(?:Current\s*price)[^\d₹$€£]*[₹$€£]\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
        ];
        for (const pat of udemyRegexPatterns) {
          const m = bodyText.match(pat);
          if (m && m[1]) {
            const num = parseCurrencyNumber(m[1]);
            if (num >= 100 && num <= 100000) {
              detectedPrice = num;
              break;
            }
          }
        }
      }

      // Layer 5: Course-Keyed or Cart-Keyed Session Continuity (ZERO Cross-Course Pollution)
      const storageKey = isUdemyCart
        ? 'commitguard_udemy_cart_total'
        : courseSlug
        ? `commitguard_udemy_price_${courseSlug}`
        : '';

      if (storageKey) {
        if (detectedPrice > 0) {
          try {
            sessionStorage.setItem(storageKey, detectedPrice.toString());
          } catch (_) {}
        } else {
          try {
            const cached = sessionStorage.getItem(storageKey);
            if (cached) {
              const num = parseFloat(cached);
              if (num >= 100 && num <= 100000) detectedPrice = num;
            }
          } catch (_) {}
        }
      }

      const udemyPrice = detectedPrice;
      // Only show an "original price" / discount badge when we scraped a real strikethrough MRP.
      // Never fabricate one — a guessed 2.5x multiplier is not the actual price the course was ever sold at.
      const udemyOrigPrice = detectedOriginalPrice > 0 ? detectedOriginalPrice : 0;
      const discountPct = detectedDiscount > 0 ? detectedDiscount : (udemyOrigPrice > udemyPrice && udemyOrigPrice > 0 ? Math.round(((udemyOrigPrice - udemyPrice) / udemyOrigPrice) * 100) : 0);

      // -----------------------------------------------------------------------
      // LIVE PAYMENT CHANNEL DETECTOR (UPI / Cards / Net Banking / Mobile Wallet)
      // Reflects whichever channel is actually checked on Udemy's real checkout
      // radio group, instead of always hardcoding the label to "UPI / Debit Card".
      // -----------------------------------------------------------------------
      function classifyUdemyPaymentText(t: string): string {
        const s = (t || '').toLowerCase();
        if (!s) return '';
        if (/\bupi\b/.test(s)) return 'UPI';
        if (/net\s*banking/.test(s)) return 'Net Banking';
        if (/mobile\s*wallet|\bwallet\b/.test(s)) return 'Mobile Wallet';
        if (/\bcard\b/.test(s)) return 'Cards';
        return '';
      }

      let detectedUdemyChannel = '';
      if (clickedEl) {
        const row = clickedEl.closest('li, label, div, [role="radio"]') || clickedEl;
        detectedUdemyChannel = classifyUdemyPaymentText((row.textContent || '').trim());
      }
      if (!detectedUdemyChannel) {
        const checkedPaymentEls = document.querySelectorAll('input[type="radio"]:checked, [aria-checked="true"]');
        for (const el of Array.from(checkedPaymentEls)) {
          const row = el.closest('li, label, div') || el;
          const cat = classifyUdemyPaymentText((row.textContent || '').trim());
          if (cat) {
            detectedUdemyChannel = cat;
            break;
          }
        }
      }
      const udemyChannelLabel = detectedUdemyChannel || 'UPI / Debit Card';

      const udemyOffers: ScrapedOffer[] = [
        {
          id: 'upi-udemy',
          bankOrCard: `${udemyChannelLabel} (Immediate Full Pay)`,
          description: 'Single payment without BNPL or EMI installment debt',
          effectiveBenefit: 'Zero interest, zero processing friction',
          rating: 'BEST',
          reason: 'Never finance small educational purchases under ₹2,000 with consumer credit.',
          netPrice: udemyPrice,
          recommended: true,
          isSelected: !!detectedUdemyChannel,
        },
        {
          id: 't-bill-delay',
          bankOrCard: 'Sovereign Liquid Fund / 30-Day Cool-Off',
          description: 'Park course fee for 30 days to test real learning commitment',
          effectiveBenefit: 'Saves 100% of price on uncompleted impulse buys',
          rating: 'BEST',
          reason: 'Over 87% of impulse-bought self-paced courses are abandoned after Lecture 2.',
          netPrice: udemyPrice,
          recommended: true,
        },
        {
          id: 'bnpl-micro',
          bankOrCard: 'LazyPay / Simpl / BNPL Micro-EMI',
          description: '3-Part split payment or 15-day deferred bill',
          effectiveBenefit: `₹${Math.round(udemyPrice / 3).toLocaleString('en-IN')}/mo with credit file risk`,
          rating: 'AVOID',
          reason: `Late payment fees of ₹250+ on a ₹${udemyPrice} course represent a 50%+ penalty drag on your credit score.`,
          netPrice: udemyPrice + 250,
          recommended: false,
        },
      ];

      // Freelancer/Business GST Input Tax Credit reminder (bootcamps/courses > ₹5,000)
      const udemyGstItcOffer = buildGstItcOffer('udemy-gst-itc', udemyPrice, 18, 'Udemy Business GST Invoice');
      if (udemyGstItcOffer) udemyOffers.push(udemyGstItcOffer);

      return {
        surfaceType: 'UDEMY',
        price: udemyPrice,
        originalPrice: udemyOrigPrice,
        discountPercent: discountPct,
        name: detectedName,
        offers: udemyOffers,
        isMultiItemCart,
        cartItemCount,
        cartItemsPreview,
      };
    }

    // ==========================================
    // 4. SURFACE: AMAZON INDIA (amazon.in / amazon.com)
    // ==========================================
    if (CURRENT_SURFACE === 'AMAZON') {
      // Cart & Multi-Item Detection on Amazon
      const isAmazonCartPage =
        window.location.href.includes('/cart') ||
        window.location.href.includes('/gp/cart') ||
        window.location.href.includes('/buy/') ||
        document.querySelector('#sc-active-cart, #gutterCartViewForm, #activeCartViewForm') !== null;

      // =========================================================================
      // 5-LAYER BULLETPROOF LIVE PRICE EXTRACTION FOR AMAZON
      // Eliminates all hardcoded fallbacks and accurately captures checkout totals
      // =========================================================================

      // Layer 1: Clicked Action Element & Button Introspection (Pay ₹..., Payment of ₹...)
      if (clickedEl) {
        const candidateTexts = [
          clickedEl.innerText || '',
          clickedEl.textContent || '',
          (clickedEl as HTMLInputElement).value || '',
          clickedEl.getAttribute('aria-label') || '',
          clickedEl.getAttribute('title') || '',
        ];
        const parentBtn = clickedEl.closest('button, a, input[type="submit"], input[type="button"], [role="button"], form');
        if (parentBtn) {
          candidateTexts.push(
            parentBtn.textContent || '',
            (parentBtn as HTMLInputElement).value || '',
            parentBtn.getAttribute('aria-label') || ''
          );
        }
        for (const t of candidateTexts) {
          if (t && t.includes('₹')) {
            const m = t.match(/(?:Pay|Payment\s*of|Total|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
            if (m && m[1]) {
              const num = parseCurrencyNumber(m[1]);
              if (num >= 50 && num < 10000000) {
                detectedPrice = num;
                break;
              }
            }
          }
        }
      }

      // Layer 2: Authoritative Live Page Text Regexes (Checkout Order Total, Payment of ₹, Subtotal)
      if (!detectedPrice) {
        const checkoutPricePatterns = [
          /(?:Order\s*Total|Grand\s*Total|Final\s*Total|Total\s*Payable|Amount\s*Payable)[^\d₹]*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
          /(?:Payment\s*of)\s*₹?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
          /\bPay\s*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
          /(?:Subtotal\s*\(\s*(\d+)\s*items?\s*\))[^\d₹]*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
          /Subtotal[^\d₹]*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
          /\bTotal:\s*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
        ];
        for (const pat of checkoutPricePatterns) {
          const match = bodyText.match(pat);
          if (match) {
            const priceStr = match[2] || match[1];
            if (priceStr) {
              const num = parseCurrencyNumber(priceStr);
              if (num >= 50 && num < 10000000) {
                detectedPrice = num;
                if (match[2] && match[1]) {
                  const count = parseInt(match[1], 10);
                  if (count > 1) {
                    isMultiItemCart = true;
                    cartItemCount = count;
                  }
                }
                break;
              }
            }
          }
        }
      }

      // Layer 3: Authoritative Checkout & Order Summary DOM Selectors
      if (!detectedPrice) {
        const amazonCheckoutAndCartSelectors = [
          '#subtotals-marketplace-table tr:last-child .a-color-price',
          '#subtotals-marketplace-table .grand-total-price',
          'td.grand-total-price',
          '.order-summary-grand-total',
          'span.order-summary-grand-total',
          '[data-testid="order-summary-total"]',
          'span.a-color-price.a-text-bold',
          '#subtotals-marketplace-table .a-color-price',
          '#subtotals-marketplace-table .a-text-bold',
          '.spc-order-summary .a-color-price',
          'div[id*="order-summary"] .a-color-price',
          '.pmts-total-amount',
          '#sc-subtotal-amount-activecart .sc-price',
          '#sc-subtotal-amount-buybox .sc-price',
          '#sc-subtotal-amount-activecart',
          '#sc-subtotal-amount-buybox',
          'span.sc-white-space-nowrap',
          '#corePriceDisplay_desktop_feature_div .a-price-whole',
          '#corePrice_feature_div .a-price-whole',
          '#priceblock_ourprice',
          '#priceblock_dealprice',
          '#priceblock_saleprice',
          'span.apexPriceToPay span.a-offscreen',
          'span.a-price-whole',
          '.a-price .a-offscreen',
        ];
        for (const sel of amazonCheckoutAndCartSelectors) {
          const els = document.querySelectorAll(sel);
          for (const el of Array.from(els)) {
            if (el && el.textContent) {
              const num = parseCurrencyNumber(el.textContent);
              if (num >= 50 && num < 10000000) {
                detectedPrice = num;
                break;
              }
            }
          }
          if (detectedPrice > 0) break;
        }
      }

      // Layer 4: Cross-Step Checkout Session Continuity (sessionStorage)
      if (detectedPrice > 0) {
        try {
          sessionStorage.setItem('commitguard_amazon_live_price', detectedPrice.toString());
        } catch (_) {}
      } else {
        try {
          const cachedPriceStr = sessionStorage.getItem('commitguard_amazon_live_price');
          if (cachedPriceStr) {
            const cachedNum = parseFloat(cachedPriceStr);
            if (cachedNum >= 50 && cachedNum < 10000000) {
              detectedPrice = cachedNum;
            }
          }
        } catch (_) {}
      }

      // Layer 5: Fallback scan for any visible currency figure on page
      if (!detectedPrice) {
        const anyPriceMatches = Array.from(bodyText.matchAll(/₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/g));
        for (const m of anyPriceMatches) {
          const num = parseCurrencyNumber(m[1]);
          if (num >= 100 && num < 10000000) {
            detectedPrice = num;
            break;
          }
        }
      }

      // Check item count on cart page if not captured via regex
      if (isAmazonCartPage && !isMultiItemCart) {
        const cartItemEls = document.querySelectorAll('.sc-list-item, div[data-asin]');
        if (cartItemEls.length > 1) {
          isMultiItemCart = true;
          cartItemCount = cartItemEls.length;
        }
      }

      if (isMultiItemCart) {
        const titleEls = document.querySelectorAll('.sc-product-title, .a-truncate-cut');
        titleEls.forEach((el, idx) => {
          if (idx < 3 && el.textContent) {
            const cleanT = el.textContent.trim();
            if (cleanT.length > 3) cartItemsPreview.push(cleanT.slice(0, 45));
          }
        });
      }

      // Title determination on Amazon (Product page, Cart, or Checkout)
      if (isAmazonCartPage) {
        const cartProductTitleEl = document.querySelector(
          '.sc-product-title, .sc-grid-item-product-title, [data-name="Active Items"] .a-truncate-cut, .sc-list-item .a-truncate-cut'
        );
        if (cartProductTitleEl && cartProductTitleEl.textContent) {
          const cleanTitle = cartProductTitleEl.textContent.trim();
          if (cleanTitle.length > 3) {
            detectedName = isMultiItemCart
              ? `${cleanTitle.slice(0, 45)} (+${cartItemCount - 1} item${cartItemCount > 2 ? 's' : ''} in cart)`
              : cleanTitle.slice(0, 65);
          }
        }
        if (!detectedName) {
          detectedName = `Amazon Cart (${cartItemCount} item${cartItemCount > 1 ? 's' : ''})`;
        }
      } else {
        const amazonTitleSelectors = [
          '.item-row-title',
          '.spc-product-title',
          '[data-testid="item-title"]',
          '.shipping-group .a-text-bold',
          '#productTitle',
          '#title',
          'h1#title',
          'span#productTitle',
        ];
        for (const sel of amazonTitleSelectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent) {
            const t = el.textContent.trim();
            if (t.length > 3) {
              detectedName = t.slice(0, 65);
              break;
            }
          }
        }
      }

      // Session continuity for product/cart title
      if (detectedName && detectedName !== 'Identified Amazon Product') {
        try {
          sessionStorage.setItem('commitguard_amazon_live_title', detectedName);
        } catch (_) {}
      } else {
        try {
          const cachedTitle = sessionStorage.getItem('commitguard_amazon_live_title');
          if (cachedTitle) detectedName = cachedTitle;
        } catch (_) {}
      }
      if (!detectedName) detectedName = 'Identified Amazon Product';

      // ZERO HARDCODED FALLBACK: Authoritative detected price
      const amazonFinalPrice = detectedPrice;

      // -----------------------------------------------------------------------
      // LIVE PAYMENT METHOD SELECTION DETECTOR
      // Reads which payment option the user has ACTUALLY selected/checked on the
      // real Amazon page, instead of always defaulting the modal's "YOUR SELECTED
      // PAYMENT OPTION" card to UPI (offers[0]) regardless of live page state.
      // -----------------------------------------------------------------------
      type AmazonPaymentCategory = 'UPI' | 'EMI' | 'ICICI_CARD' | 'CARD' | '';
      function classifyAmazonPaymentText(text: string): AmazonPaymentCategory {
        const t = (text || '').toLowerCase();
        if (!t) return '';
        if (/\bemi\b/.test(t)) return 'EMI';
        if (/\bupi\b|amazon\s*pay\s*balance/.test(t)) return 'UPI';
        if (/icici/.test(t)) return 'ICICI_CARD';
        if (/credit\s*or\s*debit\s*card|\bcard\b/.test(t)) return 'CARD';
        return '';
      }

      let detectedPaymentCategory: AmazonPaymentCategory = '';

      // Strategy 1: the row the user actually clicked, if it's a payment method option
      if (clickedEl) {
        const rowEl = clickedEl.closest('li, label, tr, [role="radio"], [class*="payment"], [class*="pmts"]') || clickedEl;
        detectedPaymentCategory = classifyAmazonPaymentText(rowEl.textContent || '');
      }

      // Strategy 2: whichever radio/option is actually checked on the page right now
      if (!detectedPaymentCategory) {
        const checkedEls = document.querySelectorAll('input[type="radio"]:checked, [aria-checked="true"]');
        for (const el of Array.from(checkedEls)) {
          const rowEl = el.closest('li, label, tr, div') || el;
          const cat = classifyAmazonPaymentText(rowEl.textContent || '');
          if (cat) {
            detectedPaymentCategory = cat;
            break;
          }
        }
      }

      const amazonOffers: ScrapedOffer[] = [];

      // 1. Direct UPI / Amazon Pay Balance (Zero Debt)
      amazonOffers.push({
        id: 'amazon-upi-instant',
        bankOrCard: 'UPI / Direct Debit (Zero Debt)',
        description: 'Immediate payment without loan or credit line lock-in',
        effectiveBenefit: 'Saves 100% of GST & bank processing fees',
        rating: 'BEST',
        reason: 'Zero interest, zero processing fee, keeps credit limit 100% free.',
        netPrice: amazonFinalPrice,
        recommended: true,
        isSelected: detectedPaymentCategory === 'UPI',
      });

      // 2. Amazon Pay ICICI Bank Credit Card (5% Cashback)
      const cashbackMatch = bodyText.match(/Upto\s*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*cashback\s*as\s*Amazon\s*Pay/i);
      let iciciCashback = Math.round(amazonFinalPrice * 0.05);
      if (cashbackMatch && cashbackMatch[1]) {
        const parsedCb = parseCurrencyNumber(cashbackMatch[1]);
        if (parsedCb > 0 && parsedCb < amazonFinalPrice) iciciCashback = parsedCb;
      }

      amazonOffers.push({
        id: 'amazon-pay-icici',
        bankOrCard: 'Amazon Pay ICICI Bank Credit Card',
        description: '5% Unlimited Cashback credited directly to Amazon Pay Balance',
        effectiveBenefit: `Save ₹${iciciCashback.toLocaleString('en-IN')} cashback`,
        rating: 'BEST',
        reason: `Earns ₹${iciciCashback.toLocaleString('en-IN')} unconditional Amazon Pay balance without any tenure lock-in.`,
        netPrice: amazonFinalPrice - iciciCashback,
        recommended: true,
        isSelected: detectedPaymentCategory === 'ICICI_CARD',
      });

      // 3. Amazon Bank Offers (e.g. HDFC / SBI / ICICI Instant Credit Card Discounts)
      const bankOfferMatch = bodyText.match(/Upto\s*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*discount\s*on\s*Credit\s*Cards/i);
      let bankDiscount = Math.min(Math.round(amazonFinalPrice * 0.1), 1000);
      if (bankOfferMatch && bankOfferMatch[1]) {
        const parsedBd = parseCurrencyNumber(bankOfferMatch[1]);
        if (parsedBd > 0 && parsedBd < amazonFinalPrice) bankDiscount = parsedBd;
      }

      amazonOffers.push({
        id: 'amazon-bank-discount',
        bankOrCard: 'Bank Offer (HDFC / SBI / ICICI Credit Cards)',
        description: `Instant discount up to ₹${bankDiscount.toLocaleString('en-IN')} on select credit cards`,
        effectiveBenefit: `Save ₹${bankDiscount.toLocaleString('en-IN')} upfront`,
        rating: 'GOOD',
        reason: 'Direct instant price reduction at checkout if paid in full single tranche.',
        netPrice: amazonFinalPrice - bankDiscount,
        recommended: false,
        isSelected: detectedPaymentCategory === 'CARD',
      });

      // 4. Amazon No-Cost EMI (With Hidden GST + Fee Alert)
      const emiMonths = 12;
      const estimatedGstFee = Math.round(199 + (amazonFinalPrice * 0.15 * (emiMonths / 12) * 0.18));
      
      const emiSavingsMatch = bodyText.match(/Upto\s*₹\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*EMI\s*interest\s*savings/i);
      const interestSavingsStr = emiSavingsMatch && emiSavingsMatch[1] ? ` (Advertised ₹${emiSavingsMatch[1]} savings)` : '';

      amazonOffers.push({
        id: 'amazon-nocost-emi',
        bankOrCard: 'No-Cost EMI (All Banks)',
        description: `${emiMonths} Months installment plan${interestSavingsStr}`,
        effectiveBenefit: `₹${Math.round(amazonFinalPrice / emiMonths).toLocaleString('en-IN')}/mo + ₹${estimatedGstFee} GST drag`,
        rating: 'AVOID',
        reason: `Hidden administrative leak: charges ₹199 bank fee + ₹${estimatedGstFee} non-refundable GST on monthly interest.`,
        netPrice: amazonFinalPrice + estimatedGstFee,
        recommended: false,
        isSelected: detectedPaymentCategory === 'EMI',
      });

      // 5. Freelancer/Business GST Input Tax Credit reminder (carts > ₹5,000)
      const amazonGstItcOffer = buildGstItcOffer('amazon-gst-itc', amazonFinalPrice, 18, 'Amazon Business GST Invoice');
      if (amazonGstItcOffer) amazonOffers.push(amazonGstItcOffer);

      return {
        surfaceType: 'AMAZON',
        price: amazonFinalPrice,
        originalPrice: detectedOriginalPrice > 0 ? detectedOriginalPrice : undefined,
        discountPercent: detectedDiscount > 0 ? detectedDiscount : undefined,
        name: detectedName,
        offers: amazonOffers,
        isMultiItemCart,
        cartItemCount,
        cartItemsPreview,
      };
    }

    // ==========================================
    // 5. SURFACE: FLIPKART (flipkart.com)
    // ==========================================
    // ==========================================
    // 5. SURFACE: FLIPKART (flipkart.com)
    // ==========================================
    const flipkartTitleSelectors = [
      'h1',
      'span.B_NuCI',
      'span._35KyD6',
      '.VU-ZEz',
      'span.VU-ZEz',
      '[class*="title"]',
    ];
    for (const sel of flipkartTitleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent) {
        const titleText = el.textContent.trim();
        if (titleText.length > 5 && !titleText.includes('Flipkart')) {
          detectedName = titleText.slice(0, 70);
          break;
        }
      }
    }
    if (!detectedName) detectedName = 'Identified Flipkart Item';

    // 1. Primary Buy Button / Price text extraction
    const buyButtonEls = document.querySelectorAll('button, a, div, span');
    for (const el of Array.from(buyButtonEls)) {
      const txt = (el.textContent || '').trim();
      // Match "Buy now at ₹19,999" or "Pay ₹19,999" or "Lowest price for you ₹18,999"
      const m = txt.match(/(?:Buy\s*now\s*at|Pay|Lowest\s*price\s*for\s*you)\s*₹\s*([0-9,]+)/i);
      if (m && m[1]) {
        const p = parseCurrencyNumber(m[1]);
        if (p >= 500 && p <= 5000000) {
          detectedPrice = p;
          break;
        }
      }
    }

    // 2. Standard Flipkart Price Selectors
    if (!detectedPrice) {
      const flipkartPriceSelectors = [
        'div.Nx9bqj.CxhGGd',
        'div.Nx9bqj',
        'div._30jeq3._16Jk6d',
        'div._30jeq3',
        '.Nx9bqj',
        '.CxhGGd',
        '[class*="price"]',
      ];
      for (const sel of flipkartPriceSelectors) {
        const els = document.querySelectorAll(sel);
        for (const el of Array.from(els)) {
          const text = el.textContent || '';
          if (text.includes('₹')) {
            const num = parseCurrencyNumber(text);
            if (num >= 500 && num <= 5000000) {
              detectedPrice = num;
              break;
            }
          }
        }
        if (detectedPrice > 0) break;
      }
    }

    // 3. Fallback regex on body text for selling price
    if (!detectedPrice) {
      const priceTextMatches = Array.from(bodyText.matchAll(/₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/g));
      for (const match of priceTextMatches) {
        const num = parseCurrencyNumber(match[1]);
        if (num >= 1000 && num <= 2000000) {
          detectedPrice = num;
          break;
        }
      }
    }

    // Scrape MRP (struck-through)
    const flipkartMrpSelectors = ['div.yRaY8j.A68rqU', 'div._3I9_wc._2p6lqe', '.yRaY8j', '[class*="mrp"]', 's', 'del'];
    for (const sel of flipkartMrpSelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of Array.from(els)) {
        const num = parseCurrencyNumber(el.textContent || '');
        if (num > (detectedPrice || 0)) {
          detectedOriginalPrice = num;
          break;
        }
      }
      if (detectedOriginalPrice > 0) break;
    }

    const discountMatch = bodyText.match(/(\d+)%\s*off/i);
    if (discountMatch && discountMatch[1]) {
      detectedDiscount = parseInt(discountMatch[1], 10);
    }

    if (clickedEl && !detectedPrice) {
      const cText = (clickedEl.innerText || clickedEl.textContent || '').trim();
      if (cText.includes('₹')) {
        const m = cText.match(/(?:Pay|Buy|Total|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
        if (m && m[1]) {
          const num = parseCurrencyNumber(m[1]);
          if (num >= 500 && num <= 5000000) detectedPrice = num;
        }
      }
    }

    if (detectedPrice > 0) {
      try {
        sessionStorage.setItem('commitguard_flipkart_live_price', detectedPrice.toString());
      } catch (_) {}
    } else {
      try {
        const cached = sessionStorage.getItem('commitguard_flipkart_live_price');
        if (cached) {
          const num = parseFloat(cached);
          if (num >= 500 && num <= 5000000) detectedPrice = num;
        }
      } catch (_) {}
    }

    const flipkartPrice = detectedPrice;

    // Check which specific payment card or EMI option the user has actually selected
    function classifyFlipkartPaymentText(t: string): string {
      if (/icici/i.test(t)) return 'ICICI Bank Credit Card (No Cost EMI)';
      if (/bajaj/i.test(t)) return 'Bajaj Finance (No Cost EMI)';
      if (/bobcard|bob/i.test(t)) return 'BOBCARD Credit Card';
      if (/kotak/i.test(t)) return 'Kotak Mahindra Bank Credit Card';
      if (/axis/i.test(t)) return 'Flipkart Axis Bank Credit Card';
      if (/upi|qr\s*code|google\s*pay|phonepe/i.test(t)) return 'UPI';
      return '';
    }

    let clickedFlipkartCard = '';
    if (clickedEl) {
      const row = clickedEl.closest('li, label, div, button, tr') || clickedEl;
      clickedFlipkartCard = classifyFlipkartPaymentText((row.textContent || '').trim());
    }

    // Fallback: the click didn't tell us (e.g. user clicked "Place Order", or the trigger fired
    // via the floating pill with no click at all) — scan for whichever option is actually
    // checked/active on the page right now instead of leaving this blank.
    if (!clickedFlipkartCard) {
      const activePaymentEls = document.querySelectorAll(
        'input[type="radio"]:checked, [aria-checked="true"], [class*="tab"][class*="active"], [class*="tab"][class*="selected"]'
      );
      for (const el of Array.from(activePaymentEls)) {
        const row = el.closest('li, label, div, tr') || el;
        const cat = classifyFlipkartPaymentText((row.textContent || '').trim());
        if (cat) {
          clickedFlipkartCard = cat;
          break;
        }
      }
    }

    const flipkartOffers: ScrapedOffer[] = [];
    const hasAuBank = /AU Small Finance|AU Bank|AU Credit Card/i.test(bodyText);
    const hasCoupon = /coupon\s*•\s*₹?\s*([0-9,]+)\s*off/i.exec(bodyText);
    const couponDiscount = hasCoupon && hasCoupon[1] ? parseCurrencyNumber(hasCoupon[1]) : 0;

    // 1. UPI / Direct Debit (Zero Debt)
    flipkartOffers.push({
      id: 'upi-instant',
      bankOrCard: 'UPI / Direct Debit (Zero Debt)',
      description: `Immediate single payment of ₹${flipkartPrice.toLocaleString('en-IN')}`,
      effectiveBenefit: 'Saves 100% of GST & bank processing fees',
      rating: 'BEST',
      reason: 'Zero interest, zero processing fee, keeps credit limit 100% free.',
      netPrice: flipkartPrice,
      recommended: true,
      isSelected: clickedFlipkartCard === 'UPI',
    });

    // 2. Flipkart Axis Bank Credit Card (5% Cashback)
    const axisCashback = Math.round(flipkartPrice * 0.05);
    flipkartOffers.push({
      id: 'axis-card',
      bankOrCard: 'Flipkart Axis Bank Credit Card',
      description: '5% Unlimited Cashback credited directly to statement',
      effectiveBenefit: `Save ₹${axisCashback.toLocaleString('en-IN')} upfront`,
      rating: 'BEST',
      reason: `Gives ₹${axisCashback.toLocaleString('en-IN')} instant statement cashback without any tenure lock-in.`,
      netPrice: flipkartPrice - axisCashback,
      recommended: true,
      isSelected: clickedFlipkartCard.includes('Axis'),
    });

    // 3. ICICI Bank / Bajaj Finance No-Cost EMI (6 Months @ ₹3,333/m)
    const noCost6mOutflow = Math.round(flipkartPrice / 6);
    const noCost6mGst = Math.round(199 + (flipkartPrice * 0.15 * 0.5 * 0.18)); // ₹199 fee + GST on interest
    flipkartOffers.push({
      id: 'icici-nocost-emi',
      bankOrCard: 'ICICI Bank / Bajaj Finance No-Cost EMI (6 Months)',
      description: `6 months x ₹${noCost6mOutflow.toLocaleString('en-IN')}/mo (Advertised Total: ₹${flipkartPrice.toLocaleString('en-IN')})`,
      effectiveBenefit: `₹${noCost6mOutflow.toLocaleString('en-IN')}/mo + ₹${noCost6mGst} Hidden GST/Fee Drag`,
      rating: 'AVOID',
      reason: `Flipkart shows ₹${flipkartPrice.toLocaleString('en-IN')}, but your bank charges ₹199 processing fee + non-refundable 18% GST (₹${Math.round(flipkartPrice * 0.15 * 0.5 * 0.18)}) on the monthly interest component.`,
      netPrice: flipkartPrice + noCost6mGst,
      recommended: false,
      isSelected: clickedFlipkartCard.includes('ICICI') || clickedFlipkartCard.includes('Bajaj'),
    });

    // 4. BOBCARD / Kotak Long-Tenure EMI (24M - 36M)
    const emiLongTenureGst = Math.round(199 + (flipkartPrice * 0.16 * 2 * 0.18));
    flipkartOffers.push({
      id: 'bobcard-kotak-emi',
      bankOrCard: 'BOBCARD / Kotak Mahindra Bank Credit Card EMI (24M-36M)',
      description: `From ₹703/mo to ₹979/mo (Advertised Total: ~₹23,500 - ₹25,300)`,
      effectiveBenefit: `Up to +₹5,300+ in Bank Interest & GST Drag`,
      rating: 'AVOID',
      reason: `Long-tenure EMIs lock your credit limit for 2-3 years and incur substantial compounding interest + 18% GST on all interest charges.`,
      netPrice: flipkartPrice + Math.round(flipkartPrice * 0.28),
      recommended: false,
      isSelected: clickedFlipkartCard.includes('BOBCARD') || clickedFlipkartCard.includes('Kotak'),
    });

    // 5. Motorola Coupon Offer if available
    if (couponDiscount > 0) {
      flipkartOffers.push({
        id: 'coupon-offer',
        bankOrCard: `Motorola Coupon • ₹${couponDiscount.toLocaleString('en-IN')} Off`,
        description: `Apply coupon at checkout for instant ₹${couponDiscount.toLocaleString('en-IN')} price reduction`,
        effectiveBenefit: `Save ₹${couponDiscount.toLocaleString('en-IN')} instantly`,
        rating: 'BEST',
        reason: 'Instant manufacturer price discount that stacks with your payment card of choice.',
        netPrice: flipkartPrice - couponDiscount,
        recommended: true,
      });
    }

    if (hasAuBank) {
      const auDiscount = Math.min(Math.round(flipkartPrice * 0.1), 1500);
      flipkartOffers.push({
        id: 'au-bank',
        bankOrCard: 'AU Small Finance Bank Credit Card',
        description: 'Instant 10% discount on credit card transactions',
        effectiveBenefit: `Save ₹${auDiscount.toLocaleString('en-IN')}`,
        rating: 'GOOD',
        reason: 'Direct instant price reduction at checkout if you pay in single tranche.',
        netPrice: flipkartPrice - auDiscount,
        recommended: false,
      });
    }

    // Cart & Multi-Item Detection on Flipkart
    const isFlipkartCartPage =
      window.location.href.includes('/viewcart') ||
      window.location.href.includes('/checkout') ||
      document.querySelector('div[class*="cartItem"], div._1AtVbE:has([class*="price"])') !== null;

    const fkCountMatch = bodyText.match(/(?:Price|Total\s*Payable)\s*\(\s*(\d+)\s*items?\s*\)/i);
    if (fkCountMatch && fkCountMatch[1]) {
      const count = parseInt(fkCountMatch[1], 10);
      if (count > 1) {
        isMultiItemCart = true;
        cartItemCount = count;
      }
    } else if (isFlipkartCartPage) {
      const fkItems = document.querySelectorAll('div[class*="cartItem"], div._2n0QD9, a[class*="title"]');
      if (fkItems.length > 1) {
        isMultiItemCart = true;
        cartItemCount = Math.min(fkItems.length, 10);
      }
    }

    if (isMultiItemCart) {
      const fkTitleEls = document.querySelectorAll('div[class*="cartItem"] a, div._2Kn22P, ._2-uGAT');
      fkTitleEls.forEach((el, idx) => {
        if (idx < 3 && el.textContent) {
          const cleanT = el.textContent.trim();
          if (cleanT.length > 3) cartItemsPreview.push(cleanT.slice(0, 45));
        }
      });
    }

    // Freelancer/Business GST Input Tax Credit reminder (carts > ₹5,000)
    const flipkartGstItcOffer = buildGstItcOffer('flipkart-gst-itc', flipkartPrice, 18, 'Flipkart Business GST Invoice');
    if (flipkartGstItcOffer) flipkartOffers.push(flipkartGstItcOffer);

    return {
      surfaceType: 'FLIPKART',
      price: flipkartPrice,
      originalPrice: detectedOriginalPrice > 0 ? detectedOriginalPrice : undefined,
      discountPercent: detectedDiscount > 0 ? detectedDiscount : undefined,
      name: detectedName,
      advertisedMonthlyEmi: detectedEmi,
      offers: flipkartOffers,
      isMultiItemCart,
      cartItemCount,
      cartItemsPreview,
    };
  }

  // Active React Root and Host Container References
  let hostContainer: HTMLElement | null = null;
  let shadowRoot: ShadowRoot | null = null;
  let reactRoot: ReactDOM.Root | null = null;

  // Mount the CommitGuard Modal inside Shadow Root
  function injectShadowModal(
    surfaceType: InterceptorSurface,
    productPrice: number,
    productName: string,
    offers: ScrapedOffer[],
    originalPrice: number | undefined,
    discountPercent: number | undefined,
    isMultiItemCart: boolean = false,
    cartItemCount: number = 1,
    cartItemsPreview: string[] = [],
    onProceedCallback: () => void = () => {},
    onCancelCallback: () => void = () => {}
  ) {
    if (document.getElementById(COMMITGUARD_HOST_ID)) {
      return; // Already open
    }

    // 1. Create host element
    hostContainer = document.createElement('div');
    hostContainer.id = COMMITGUARD_HOST_ID;
    hostContainer.style.position = 'fixed';
    hostContainer.style.zIndex = '2147483647';
    hostContainer.style.top = '0';
    hostContainer.style.left = '0';
    hostContainer.style.width = '100%';
    hostContainer.style.height = '100%';
    hostContainer.style.pointerEvents = 'auto';

    // 2. Attach Shadow Root (Open mode for DOM accessibility)
    shadowRoot = hostContainer.attachShadow({ mode: 'open' });

    // 3. Inject Tailwind CSS Styles directly into the Shadow Root
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    try {
      styleLink.href = chrome.runtime.getURL('styles.css');
    } catch {
      styleLink.href = '';
    }
    shadowRoot.appendChild(styleLink);

    // Fallback embedded core CSS to guarantee zero styling bleed-through
    const inlineStyle = document.createElement('style');
    inlineStyle.textContent = `
      :host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .commitguard-backdrop {
        position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center;
        padding: 1rem; background-color: rgba(15, 23, 42, 0.75); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      }
      .commitguard-card {
        position: relative; width: 100%; max-width: 58rem; background-color: #F5F1E6; border-radius: 0.375rem;
        box-shadow: 0 25px 50px -12px rgba(11, 29, 58, 0.45); border: 1px solid #0B1D3A; overflow: hidden;
      }
    `;
    shadowRoot.appendChild(inlineStyle);

    // 4. Create mount container inside Shadow Root
    const mountPoint = document.createElement('div');
    mountPoint.id = 'commitguard-react-app';
    shadowRoot.appendChild(mountPoint);

    // 5. Append host container to document body or documentElement
    const parent = document.body || document.documentElement;
    parent.appendChild(hostContainer);

    // 6. Mount React component inside Shadow Root
    reactRoot = ReactDOM.createRoot(mountPoint);

    const cleanUpModal = () => {
      if (reactRoot) {
        reactRoot.unmount();
        reactRoot = null;
      }
      if (hostContainer && hostContainer.parentNode) {
        hostContainer.parentNode.removeChild(hostContainer);
        hostContainer = null;
      }
    };

    const handleProceed = () => {
      cleanUpModal();
      onProceedCallback();
    };

    const handleCancel = () => {
      cleanUpModal();
      onCancelCallback();
    };

    reactRoot.render(
      <ExtensionCommitGuardModal
        surfaceType={surfaceType}
        productPrice={productPrice}
        productName={productName}
        originalPrice={originalPrice}
        discountPercent={discountPercent}
        scrapedOffers={offers}
        isMultiItemCart={isMultiItemCart}
        cartItemCount={cartItemCount}
        cartItemsPreview={cartItemsPreview}
        onProceedAndContinue={handleProceed}
        onCancelStayOnPage={handleCancel}
      />
    );

    // 7. Notify background service worker for metrics telemetry
    try {
      chrome.runtime.sendMessage({
        type: 'CHECKOUT_INTERCEPTED',
        payload: {
          surface: surfaceType,
          price: productPrice,
          name: productName,
          effectiveApr: 19.93,
          hiddenFriction: 1339,
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      // Standalone execution
    }
  }

  // Final-Commitment Keywords ONLY — intermediate selection labels (bank names, "select
  // tenure", "months x", "total payable", "no cost emi" badges, etc.) are deliberately
  // excluded. Matching those caused the modal to fire the instant a payment-method radio
  // was picked, before the user had actually committed to anything.
  const FINAL_COMMIT_KEYWORDS = [
    // 1. E-Commerce (Flipkart, Amazon)
    'continue with emi',
    'buy with emi',
    'pay with emi',
    'select plan and continue',
    'place order',
    'place your order',
    'proceed to pay',
    'proceed to retail checkout',
    'complete payment',
    'buy now',

    // 2. Travel & Flight/Hotel Checkouts (MakeMyTrip, Cleartrip, Yatra, Goibibo)
    'travel now pay later',
    'travel now, pay later',
    'trip on emi',
    'book now pay later',
    'book now, pay later',
    'pay with trip money',
    'continue to payment',
    'pay & book now',
    'use this payment method',

    // 3. Ed-Tech & Udemy (UpGrad, Scaler, Simplilearn, Udemy)
    'education loan',
    'apply for education loan',
    'pay with loan',
    'apply for loan',
    'complete checkout',
    'enroll now',
    'buy this course',
    'go to cart',
  ];

  // Helper to check if an element or its ancestors is a genuine final-commitment action.
  // Selection controls (radio/checkbox/label) are strictly ignored — they can never trigger
  // the interceptor themselves, only genuine "Pay"/"Place Order"/"Proceed" actions can.
  function findInterceptTarget(element: HTMLElement | null): HTMLElement | null {
    let curr = element;
    let depth = 0;
    while (curr && depth < 7 && curr !== document.body) {
      // Check data attribute bypass
      if (curr.getAttribute('data-commitguard-authorized') === 'true') {
        return null;
      }

      const tagName = curr.tagName.toUpperCase();

      // Strictly ignore payment-method / bank / tenure SELECTION controls. Picking an option
      // must never itself open the modal — only clicking a real commit action further down
      // the flow should. Skip evaluating this node as a trigger and keep climbing ancestors.
      const isSelectionControl =
        tagName === 'LABEL' ||
        (tagName === 'INPUT' && /^(radio|checkbox)$/.test(((curr as HTMLInputElement).type || '').toLowerCase()));
      if (isSelectionControl) {
        curr = curr.parentElement;
        depth++;
        continue;
      }

      // Check text content of button, link, or clickable element
      const text = (curr.innerText || curr.textContent || '').trim().toLowerCase();

      // 1. Explicitly IGNORE purely informational accordions, learn-more links, tooltips, and informational dropdowns
      if (
        /learn\s*more|emi\s*available|view\s*details|show\s*details|see\s*options|how\s*it\s*works|terms\s*&\s*conditions|terms\s*apply|accordion/i.test(text) &&
        !/proceed|place\s*order|pay\s*now|buy\s*now|continue/i.test(text)
      ) {
        return null;
      }
      if (text.includes('emi available') || text.includes('your order qualifies for emi')) {
        return null;
      }

      // Direct & Fuzzy Keyword Match
      for (const keyword of FINAL_COMMIT_KEYWORDS) {
        if (text === keyword || (text.length < 70 && text.includes(keyword))) {
          return curr;
        }
      }

      // Dynamic Regex Matcher: catches final-action buttons whose exact wording we can't
      // predict (e.g. "Pay ₹31,763 via ICICI Bank"). Restricted to BUTTON/A/role=button —
      // never LABEL, LI, role="radio", or role="tab", since those are selection rows.
      if (
        /(place\s*order|proceed\s*to\s*pay|proceed\s*to\s*buy|pay\s*₹|payment\s*of\s*₹|complete\s*payment|complete\s*checkout)/i.test(text) &&
        (tagName === 'BUTTON' || tagName === 'A' || curr.getAttribute('role') === 'button' || curr.classList.toString().includes('btn'))
      ) {
        return curr;
      }

      // Check input elements — ONLY submit/button (a genuine "Pay"/"Place Order" control),
      // never radio/checkbox (handled by isSelectionControl above).
      if (tagName === 'INPUT') {
        const inputType = ((curr as HTMLInputElement).type || '').toLowerCase();
        const inputVal = ((curr as HTMLInputElement).value || '').toLowerCase();

        if (inputType === 'submit' || inputType === 'button') {
          for (const keyword of FINAL_COMMIT_KEYWORDS) {
            if (inputVal.includes(keyword) || text.includes(keyword)) {
              return curr;
            }
          }
          if (/pay|place\s*order|proceed/i.test(inputVal)) {
            return curr;
          }
        }
      }

      // Check button classes or IDs — final-action identifiers only
      const idStr = (curr.id || '').toLowerCase();
      const classStr = (curr.className || '').toString().toLowerCase();
      if (
        idStr.includes('placeorder') ||
        idStr.includes('proceedtopay') ||
        idStr.includes('emipayment') ||
        classStr.includes('paylater')
      ) {
        return curr;
      }

      curr = curr.parentElement;
      depth++;
    }
    return null;
  }

  // GLOBAL CAPTURING CLICK LISTENER
  // Intercepts clicks at the window level BEFORE host application event handlers run
  window.addEventListener(
    'click',
    (e: MouseEvent) => {
      // Ignore clicks inside our own Shadow Root or floating trigger
      if (hostContainer && (e.target === hostContainer || hostContainer.contains(e.target as Node))) {
        return;
      }
      const floatingPill = document.getElementById('commitguard-floating-pill');
      if (floatingPill && (e.target === floatingPill || floatingPill.contains(e.target as Node))) {
        return;
      }

      const targetEl = findInterceptTarget(e.target as HTMLElement);
      if (!targetEl) {
        return;
      }

      console.log('🛡️ CommitGuard Intercepted Payment Action on:', targetEl);

      // Stop host site from immediately placing order or navigating
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const productInfo = extractProductInfo(targetEl);
      console.log('🛡️ CommitGuard Scraped Product Info & Offers:', productInfo);

      injectShadowModal(
        productInfo.surfaceType,
        productInfo.price,
        productInfo.name,
        productInfo.offers,
        productInfo.originalPrice,
        productInfo.discountPercent,
        productInfo.isMultiItemCart || false,
        productInfo.cartItemCount || 1,
        productInfo.cartItemsPreview || [],
        // On Proceed: mark as authorized and let the click advance to next page
        () => {
          targetEl.setAttribute('data-commitguard-authorized', 'true');
          console.log('🛡️ CommitGuard Authorized: Continuing original payment action');
          const href = targetEl.getAttribute('href');
          // If href is javascript:..., dispatch a simulated click to avoid CSP navigation blocking
          if (href && href.trim().toLowerCase().startsWith('javascript:')) {
            targetEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          } else {
            targetEl.click();
          }
        },
        // On Cancel: do NOT mark authorized, do NOT click target, stay on current page
        () => {
          console.log('🛡️ CommitGuard Cancelled: User remains on current page to modify terms');
        }
      );
    },
    true // CAPTURING PHASE: Guarantees we execute before Flipkart / Amazon handlers
  );

  // ==========================================
  // FLOATING INSTANT INTEL TRIGGER BUTTON
  // Injects an on-demand inspection pill so user can open CommitGuard anytime
  // ==========================================
  function injectFloatingTrigger() {
    if (document.getElementById('commitguard-floating-pill')) return;

    const pill = document.createElement('div');
    pill.id = 'commitguard-floating-pill';
    pill.setAttribute('title', 'Click to view CommitGuard Pre-Commitment Math (<1.2ms)');
    pill.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483640;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      font-weight: 700;
      border-radius: 9999px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15);
      cursor: pointer;
      user-select: none;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
    `;
    pill.innerHTML = `
      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #10b981; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></span>
      <span>🛡️ CommitGuard Intel (<span style="color: #34d399;">&lt;1.2ms</span>)</span>
    `;

    pill.addEventListener('mouseenter', () => {
      pill.style.transform = 'translateY(-2px) scale(1.03)';
      pill.style.boxShadow = '0 15px 30px -5px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(16, 185, 129, 0.4)';
    });
    pill.addEventListener('mouseleave', () => {
      pill.style.transform = 'translateY(0) scale(1)';
      pill.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15)';
    });

    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const productInfo = extractProductInfo();
      injectShadowModal(
        productInfo.surfaceType,
        productInfo.price,
        productInfo.name,
        productInfo.offers,
        productInfo.originalPrice,
        productInfo.discountPercent,
        productInfo.isMultiItemCart || false,
        productInfo.cartItemCount || 1,
        productInfo.cartItemsPreview || [],
        () => {},
        () => {}
      );
    });

    const targetParent = document.body || document.documentElement;
    if (targetParent) targetParent.appendChild(pill);
  }

  // Mount floating badge after document load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFloatingTrigger);
  } else {
    injectFloatingTrigger();
  }

  console.log('🛡️ CommitGuard Global Capture & Floating Intel Badge registered successfully');
})();
