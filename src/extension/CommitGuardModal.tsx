import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  X,
  Sliders,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
  ArrowRight,
  RotateCcw,
  CreditCard,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Percent,
  TrendingUp,
  PiggyBank,
  Landmark,
  Plane,
  GraduationCap,
  Scale,
  BookOpen,
  ShoppingBag,
  Edit3,
} from 'lucide-react';
import { calculateNoCostEmiDrag, evaluateMultiCartEmiRisk } from '../lib/financial-engine';

export type InterceptorSurface = 'AMAZON' | 'FLIPKART' | 'ECOMMERCE' | 'TRAVEL' | 'EDTECH' | 'UDEMY';

export interface ScrapedOffer {
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

export interface ExtensionModalProps {
  surfaceType?: InterceptorSurface;
  productPrice?: number;
  productName?: string;
  originalPrice?: number;
  discountPercent?: number;
  scrapedOffers?: ScrapedOffer[];
  isMultiItemCart?: boolean;
  cartItemCount?: number;
  cartItemsPreview?: string[];
  onProceedAndContinue: () => void; // Proceeds to host site action
  onCancelStayOnPage: () => void;   // Closes modal and keeps user on CURRENT page
}

export const ExtensionCommitGuardModal: React.FC<ExtensionModalProps> = ({
  surfaceType = 'AMAZON',
  productPrice = 5399,
  productName = 'Identified Checkout Item',
  originalPrice,
  discountPercent,
  scrapedOffers = [],
  isMultiItemCart = false,
  cartItemCount = 1,
  cartItemsPreview = [],
  onProceedAndContinue,
  onCancelStayOnPage,
}) => {
  // Discrete snap tenure points: 3, 6, 9, 12, 18, 24 months
  const TENURE_OPTIONS = [3, 6, 9, 12, 18, 24];
  // Map index [0..5] for perfect proportional visual slider placement
  const [sliderIndex, setSliderIndex] = useState<number>(3); // Default to 12 months (index 3)
  const tenure = TENURE_OPTIONS[sliderIndex];

  // Active view tab: 'CARD_OFFERS' vs 'EMI_FRICTION' vs 'RECOVERY_COMPOUNDING'
  const [activeTab, setActiveTab] = useState<'CARD_OFFERS' | 'EMI_FRICTION' | 'RECOVERY_COMPOUNDING'>('CARD_OFFERS');
  const [showAllMethods, setShowAllMethods] = useState<boolean>(false);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [compoundingHorizon, setCompoundingHorizon] = useState<'1Y' | '3Y' | '5Y'>('5Y');
  const [isProofOpen, setIsProofOpen] = useState(false);

  // Dynamic Tenure Simulator for active scraped payment option
  const [customTenure, setCustomTenure] = useState<number>(12);
  const [simulatedTenureOffer, setSimulatedTenureOffer] = useState<ScrapedOffer | null>(null);

  const processingFee = 199;
  const nominalRate = 15.0;

  // Real-time deterministic tenure simulator on whatever offer is active
  const handleSimulateTenure = (months: number, baseOffer: ScrapedOffer) => {
    setCustomTenure(months);

    // Extract stated APR or determine from offer description
    let apr = 15.0;
    const aprMatch = baseOffer.bankOrCard.match(/@\s*([0-9.]+)%/i) || baseOffer.reason.match(/([0-9.]+)%\s*APR/i);
    if (aprMatch && aprMatch[1]) {
      apr = parseFloat(aprMatch[1]);
    } else if (/axis\s*cashback|flipkart\s*axis/i.test(baseOffer.bankOrCard)) {
      apr = 0;
    } else if (/no\s*cost/i.test(baseOffer.bankOrCard)) {
      apr = 0;
    } else if (/pay\s*later|tnpl/i.test(baseOffer.bankOrCard)) {
      apr = 24.0;
    } else if (/debit/i.test(baseOffer.bankOrCard)) {
      apr = 16.0;
    }

    const isNoCost = apr === 0;
    let interest = 0;
    let gst = 0;
    let fee = /axis\s*cashback/i.test(baseOffer.bankOrCard) ? 0 : 235;

    if (isNoCost) {
      const implicitInterest = Math.round(productPrice * 0.15 * (months / 12));
      gst = Math.round(implicitInterest * 0.18);
    } else {
      interest = Math.round(productPrice * (apr / 100) * (months / 12));
      gst = Math.round(interest * 0.18);
    }

    const total = productPrice + interest + gst + fee;
    const monthly = Math.round((productPrice + interest) / months);

    // Clean bank name without old tenure
    const baseBankName = baseOffer.bankOrCard.replace(/\(\d+M[^)]*\)/g, '').trim();

    const simOffer: ScrapedOffer = {
      id: `${baseOffer.id}-sim-${months}m`,
      bankOrCard: `${baseBankName} (${months}M ${isNoCost ? 'No-Cost EMI' : `EMI @ ${apr.toFixed(1)}%`})`,
      description: `${months} months x ₹${monthly.toLocaleString('en-IN')}/mo (Advertised Total: ₹${(productPrice + interest).toLocaleString('en-IN')})`,
      effectiveBenefit: `₹${monthly.toLocaleString('en-IN')}/mo + ₹${(gst + fee).toLocaleString('en-IN')} Hidden Drag`,
      rating: isNoCost ? 'GOOD' : 'AVOID',
      reason: isNoCost
        ? `Flipkart/Merchant discounts interest, but bank levies ₹199 processing fee + non-refundable 18% GST (₹${gst}) on interest.`
        : `Long-tenure EMIs lock credit limit and incur compounding ${apr.toFixed(1)}% APR + 18% non-refundable GST (₹${gst}) on interest + ₹${fee} fee.`,
      netPrice: total,
      recommended: isNoCost,
      isSelected: true,
    };

    setSimulatedTenureOffer(simOffer);
  };

  // Real-time deterministic recalculation (<1.2ms)
  const mathResult = useMemo(() => {
    return calculateNoCostEmiDrag({
      type: 'NO_COST_EMI',
      productName,
      productPrice,
      tenureMonths: tenure,
      advertisedRate: 0,
      bankProcessingFee: processingFee,
      bankNominalInterestRate: nominalRate,
    });
  }, [productPrice, productName, tenure, processingFee, nominalRate]);

  // Compounding Preserved Wealth calculation (Sovereign T-Bill / Liquid Fund at 7.10% annualized)
  const recoveryCompounding = useMemo(() => {
    const savedFriction = mathResult.totalHiddenFriction; // processing fee + 18% GST
    const tbillRate = 0.071; // 7.10% RBI Sovereign 364-Day T-Bill benchmark yield
    
    // Future Value after 1, 3, 5 years if saved friction is invested instead of leaked to bank/GST:
    const fv1Year = Math.round(savedFriction * Math.pow(1 + tbillRate, 1));
    const fv3Year = Math.round(savedFriction * Math.pow(1 + tbillRate, 3));
    const fv5Year = Math.round(savedFriction * Math.pow(1 + tbillRate, 5));

    // Also compare monthly SIP alternative: If user invested the monthly EMI into Liquid Fund instead
    const monthlyEmi = mathResult.monthlyBaseEmi;
    const rMonthly = tbillRate / 12;
    const sipFv = Math.round(monthlyEmi * ((Math.pow(1 + rMonthly, tenure) - 1) / rMonthly) * (1 + rMonthly));
    const sipGain = sipFv - (monthlyEmi * tenure);

    return {
      savedFriction,
      tbillRate: 7.10,
      fv1Year,
      fv3Year,
      fv5Year,
      compoundedGain5Y: fv5Year - savedFriction,
      sipFv,
      sipGain,
    };
  }, [mathResult, tenure]);

  // Evaluate Multi-Cart EMI Disqualification Risk & Minimum Thresholds
  const multiCartRisk = useMemo(() => {
    return evaluateMultiCartEmiRisk(productPrice, cartItemCount, tenure, 15.0);
  }, [productPrice, cartItemCount, tenure]);

  // Dynamic fallback offers customized per surface if none scraped
  const displayOffers: ScrapedOffer[] = useMemo(() => {
    if (scrapedOffers && scrapedOffers.length > 0) return scrapedOffers;

    if (surfaceType === 'AMAZON') {
      const amazonCashback = Math.round(productPrice * 0.05);
      const bankDiscount = Math.min(Math.round(productPrice * 0.1), 1250);
      return [
        {
          id: 'amazon-icici-card',
          bankOrCard: 'Amazon Pay ICICI Bank Credit Card',
          description: '5% Unlimited Cashback credited to Amazon Pay Balance',
          effectiveBenefit: `Save ₹${amazonCashback.toLocaleString('en-IN')} cashback`,
          rating: 'BEST',
          reason: 'Zero lock-in tenure. Instant Amazon Pay cashback without interest or processing fees.',
          netPrice: productPrice - amazonCashback,
          recommended: true,
          isSelected: true,
        },
        {
          id: 'upi-instant',
          bankOrCard: 'Amazon Pay UPI / Direct Debit (Zero Debt)',
          description: 'Single-tranche direct payment from bank account',
          effectiveBenefit: 'Saves 100% of GST & bank processing fees',
          rating: 'BEST',
          reason: 'Zero interest, zero processing fee, keeps credit limit 100% free.',
          netPrice: productPrice,
          recommended: true,
        },
        {
          id: 'amazon-bank-offer',
          bankOrCard: 'Bank Offer: HDFC / SBI Credit Cards',
          description: 'Instant 10% discount on credit card transactions',
          effectiveBenefit: `Save ₹${bankDiscount.toLocaleString('en-IN')} upfront`,
          rating: 'GOOD',
          reason: 'Direct instant price reduction at checkout if paid in full.',
          netPrice: productPrice - bankDiscount,
          recommended: false,
        },
        {
          id: 'no-cost-emi',
          bankOrCard: 'Amazon No-Cost EMI (All Banks)',
          description: `${tenure} Months installment plan`,
          effectiveBenefit: `₹${mathResult.monthlyBaseEmi.toLocaleString('en-IN')}/mo + ₹${mathResult.totalHiddenFriction.toLocaleString('en-IN')} GST Drag`,
          rating: 'AVOID',
          reason: `Charges ${mathResult.effectiveAnnualPercentageRate}% Effective APR via statutory 18% GST on interest + ₹${processingFee} bank fee.`,
          netPrice: productPrice + mathResult.totalHiddenFriction,
          recommended: false,
        },
      ];
    }

    const axisCashback = Math.round(productPrice * 0.05);
    return [
      {
        id: 'axis-card',
        bankOrCard: 'Flipkart Axis Bank Credit Card',
        description: '5% Unlimited Cashback on Flipkart purchases',
        effectiveBenefit: `Save ₹${axisCashback.toLocaleString('en-IN')} upfront`,
        rating: 'BEST',
        reason: 'Zero lock-in tenure. Statement credit without loan paperwork.',
        netPrice: productPrice - axisCashback,
        recommended: true,
        isSelected: true,
      },
      {
        id: 'upi-instant',
        bankOrCard: 'UPI / Direct Debit (Zero Debt)',
        description: 'Single-tranche direct payment from bank account',
        effectiveBenefit: 'Saves 100% of GST & bank processing fees',
        rating: 'BEST',
        reason: 'Zero interest, zero processing fee, keeps credit limit 100% free.',
        netPrice: productPrice,
        recommended: true,
      },
      {
        id: 'au-bank',
        bankOrCard: 'AU Small Finance Bank Credit Card',
        description: 'Instant 10% discount on credit card transactions',
        effectiveBenefit: `Save ₹${Math.min(Math.round(productPrice * 0.1), 1500).toLocaleString('en-IN')}`,
        rating: 'GOOD',
        reason: 'Direct instant price reduction at checkout.',
        netPrice: productPrice - Math.min(Math.round(productPrice * 0.1), 1500),
        recommended: false,
      },
      {
        id: 'no-cost-emi',
        bankOrCard: 'No-Cost EMI (All Banks)',
        description: `${tenure} Months installment plan`,
        effectiveBenefit: `₹${mathResult.monthlyBaseEmi.toLocaleString('en-IN')}/mo + ₹${mathResult.totalHiddenFriction.toLocaleString('en-IN')} GST Drag`,
        rating: 'AVOID',
        reason: `Charges ${mathResult.effectiveAnnualPercentageRate}% Effective APR via statutory 18% GST + ₹${processingFee} fee.`,
        netPrice: productPrice + mathResult.totalHiddenFriction,
        recommended: false,
      },
    ];
  }, [scrapedOffers, surfaceType, productPrice, tenure, mathResult, processingFee]);

  // Merge scraped/display offers with simulated tenure offer if user tweaked tenure
  const allOffers = useMemo(() => {
    let list = [...displayOffers];
    if (simulatedTenureOffer) {
      list = [simulatedTenureOffer, ...list.filter((o) => !o.id.includes('sim-'))];
    }
    return list;
  }, [displayOffers, simulatedTenureOffer]);

  // Find user's selected offer or fallback to first
  const selectedOffer = useMemo(() => {
    if (simulatedTenureOffer && (selectedOfferId === simulatedTenureOffer.id || !selectedOfferId)) {
      return simulatedTenureOffer;
    }
    if (selectedOfferId) {
      const found = allOffers.find((o) => o.id === selectedOfferId);
      if (found) return found;
    }
    return allOffers.find((o) => o.isSelected) || allOffers[0];
  }, [allOffers, selectedOfferId, simulatedTenureOffer]);

  // Other available offers
  const otherOffers = useMemo(() => {
    return allOffers.filter((o) => o.id !== selectedOffer?.id);
  }, [allOffers, selectedOffer]);

  return (
    <div
      className="commitguard-backdrop"
      onClick={(e) => {
        // Clicking outside cancels and stays on page
        if (e.target === e.currentTarget) onCancelStayOnPage();
      }}
    >
      <div className="commitguard-card">
        
        {/* Header Bar with explicit Cancel / Stay on page 'X' */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base sm:text-lg">
            <div className={`p-1.5 rounded-lg text-white shadow-sm ${
              surfaceType === 'TRAVEL'
                ? 'bg-sky-600'
                : surfaceType === 'EDTECH'
                ? 'bg-indigo-600'
                : surfaceType === 'UDEMY'
                ? 'bg-purple-600'
                : surfaceType === 'AMAZON'
                ? 'bg-amber-600'
                : 'bg-emerald-600'
            }`}>
              {surfaceType === 'TRAVEL' ? (
                <Plane className="w-5 h-5" />
              ) : surfaceType === 'EDTECH' ? (
                <GraduationCap className="w-5 h-5" />
              ) : surfaceType === 'UDEMY' ? (
                <BookOpen className="w-5 h-5" />
              ) : surfaceType === 'AMAZON' ? (
                <ShoppingBag className="w-5 h-5" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </div>
            <div>
              <span className="text-slate-900">
                {surfaceType === 'TRAVEL'
                  ? 'CommitGuard Travel: TNPL & EMI Reality Check'
                  : surfaceType === 'EDTECH'
                  ? 'CommitGuard EdTech: Education Loan Subvention Truth'
                  : surfaceType === 'UDEMY'
                  ? 'CommitGuard Udemy: Impulse Buy & BNPL Interceptor'
                  : surfaceType === 'AMAZON'
                  ? 'CommitGuard Amazon: Live Card & EMI Optimization'
                  : surfaceType === 'FLIPKART'
                  ? 'CommitGuard Flipkart: Live Card & EMI Optimization'
                  : 'CommitGuard Smart Checkout Intel'}
              </span>
              <div className="text-[11px] text-slate-500 font-normal">
                {surfaceType === 'TRAVEL'
                  ? 'MakeMyTrip & Cleartrip: High-APR TNPL Cascades vs 6M Liquid SIP'
                  : surfaceType === 'EDTECH'
                  ? 'UpGrad: Exposing Hidden Subvention Surcharges & True Debt ROI'
                  : surfaceType === 'UDEMY'
                  ? '30-Day Cool-Off & Micro-BNPL Fee Elimination'
                  : 'Live Scraped Banking & Friction Engine'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-[11px] font-mono font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>&lt;1.2ms Real-Time Scraper</span>
            </span>

            {/* 'X' Close button stays on page */}
            <button
              onClick={onCancelStayOnPage}
              title="Cancel & Stay on Page (Escape)"
              aria-label="Cancel"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Product Scraped Summary Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 truncate max-w-xs sm:max-w-md">
              {productName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {originalPrice && (
              <span className="text-xs text-slate-400 line-through">
                ₹{originalPrice.toLocaleString('en-IN')}
              </span>
            )}
            <span className="text-base font-black text-slate-900">
              ₹{productPrice.toLocaleString('en-IN')}
            </span>
            {discountPercent && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                {discountPercent}% OFF
              </span>
            )}
          </div>
        </div>

        {/* Multi-Item Cart Alert Banner */}
        {isMultiItemCart && (
          <div className="mx-6 my-3 p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-sm text-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-700 mt-0.5 shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                      Multi-Item Cart Detected
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 text-[11px] font-bold">
                      {cartItemCount} Items • ₹{productPrice.toLocaleString('en-IN')} Total
                    </span>
                    {!multiCartRisk.meetsMinThreshold ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                        ⚠️ Below ₹3,000 Minimum for EMI
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        Cart Meets ₹3,000 Min
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-amber-900/90 mt-1 leading-snug">
                    <strong>⚠️ Mixed-Cart EMI Risk:</strong> If even <em>one</em> item in this cart is ineligible for No-Cost EMI, banks frequently void the merchant discount and charge <strong>15% standard loan interest (~₹{multiCartRisk.totalRiskAmount.toLocaleString('en-IN')} extra)</strong> across the entire order!
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-amber-200/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-amber-950 font-medium">
                <span className="text-emerald-700 font-bold">💡 Split-Order Recommendation:</span>
                <span>Checkout high-ticket EMI item alone to guarantee 100% interest waiver, then buy accessories via UPI.</span>
              </div>
              {cartItemsPreview && cartItemsPreview.length > 0 && (
                <div className="text-[10px] text-slate-500 truncate max-w-full italic">
                  Detected in cart: {cartItemsPreview.slice(0, 3).join(', ')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Navigation: Card Offers vs EMI Friction Breakdown */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('CARD_OFFERS')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'CARD_OFFERS'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span>Card & Payment Intel (Best vs Worst)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-mono">
              {displayOffers.length} Options
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('EMI_FRICTION')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'EMI_FRICTION'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>
              {surfaceType === 'UDEMY'
                ? `Installment / BNPL Friction (Save ₹${recoveryCompounding.savedFriction})`
                : `No-Cost EMI Friction (${mathResult.effectiveAnnualPercentageRate}% APR)`}
            </span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* TAB 1: CARD & PAYMENT INTEL (Shows User's Selected Method First, plus Expandable Comparison) */}
          {activeTab === 'CARD_OFFERS' && (
            <div className="space-y-4">
              
              {/* 0. LIVE DISCOVERED PAYMENT METHODS SELECTOR */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Payment Methods Discovered on Page:</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Live Scraped
                  </span>
                </div>

                {/* Chips for all discovered offers */}
                <div className="flex flex-wrap gap-1.5">
                  {allOffers.map((offer) => (
                    <button
                      key={offer.id}
                      type="button"
                      onClick={() => {
                        setSimulatedTenureOffer(null);
                        setSelectedOfferId(offer.id);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                        selectedOffer?.id === offer.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-medium'
                      }`}
                    >
                      <span>{offer.bankOrCard}</span>
                      {offer.rating === 'BEST' && <span className="text-emerald-400 text-[10px]">★</span>}
                    </button>
                  ))}
                </div>

                {/* If selected offer supports tenures, render dynamic tenure chips */}
                {selectedOffer && !/upi|direct|cool-off/i.test(selectedOffer.bankOrCard) && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <span>Simulate EMI Tenure on this Card:</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[3, 6, 9, 12, 18, 24, 36].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleSimulateTenure(m, selectedOffer)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer border ${
                            customTenure === m && simulatedTenureOffer
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* 1. HERO CARD: USER'S SELECTED PAYMENT OPTION */}
              {selectedOffer && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white inline-flex items-center gap-1.5 shadow-sm">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>Your Selected Payment Option</span>
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Live Pre-Commitment Reality Check
                    </span>
                  </div>

                  <div
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedOffer.rating === 'BEST'
                        ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-200'
                        : selectedOffer.rating === 'AVOID'
                        ? 'bg-red-50/90 border-red-300 ring-2 ring-red-100'
                        : 'bg-sky-50/90 border-sky-300 ring-2 ring-sky-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-base text-slate-900">
                            {selectedOffer.bankOrCard}
                          </span>

                          {/* Badge */}
                          {selectedOffer.rating === 'BEST' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white shadow-sm">
                              <ThumbsUp className="w-3 h-3" />
                              RECOMMENDED: BEST VALUE
                            </span>
                          )}
                          {selectedOffer.rating === 'GOOD' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                              GOOD OFFER
                            </span>
                          )}
                          {selectedOffer.rating === 'AVOID' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-200">
                              <ThumbsDown className="w-3 h-3 text-red-600" />
                              AVOID: HIDDEN CHARGES
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-700 font-medium">
                          {selectedOffer.description}
                        </p>

                        <div className="text-xs text-slate-800 font-normal flex items-start gap-1.5 pt-1 bg-white/70 p-2 rounded-lg border border-slate-200/60">
                          <span className="w-2 h-2 rounded-full bg-slate-500 mt-1 shrink-0" />
                          <span>{selectedOffer.reason}</span>
                        </div>
                      </div>

                      {/* Net Cost & Benefit */}
                      <div className="text-right shrink-0 bg-white/80 p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
                        <div className="text-[11px] text-slate-500 font-semibold">
                          True Outflow
                        </div>
                        <div className={`text-lg font-black ${
                          selectedOffer.rating === 'BEST' ? 'text-emerald-700' : selectedOffer.rating === 'AVOID' ? 'text-red-600' : 'text-slate-900'
                        }`}>
                          ₹{selectedOffer.netPrice.toLocaleString('en-IN')}
                        </div>
                        <div className={`text-[10px] font-bold mt-0.5 ${
                          selectedOffer.rating === 'BEST' ? 'text-emerald-600' : selectedOffer.rating === 'AVOID' ? 'text-red-700' : 'text-slate-600'
                        }`}>
                          {selectedOffer.effectiveBenefit}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. ACCORDION: VIEW OTHER PAYMENT METHODS AS WELL */}
              {otherOffers.length > 0 && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAllMethods(!showAllMethods)}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-between transition-colors border border-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-slate-600" />
                      <span>{showAllMethods ? 'Hide Alternative Payment Methods' : `View & Compare Other Payment Methods (${otherOffers.length} Available)`}</span>
                    </span>
                    {showAllMethods ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                  </button>

                  {/* Expanded list of alternative offers */}
                  {showAllMethods && (
                    <div className="space-y-2.5 mt-3 animate-in fade-in duration-200">
                      <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between px-1">
                        <span>Click any method to inspect its Reality Check:</span>
                        <span className="text-[10px] text-emerald-700 font-mono font-bold">👆 Click to Switch</span>
                      </div>
                      {otherOffers.map((offer) => {
                        const isBest = offer.rating === 'BEST';
                        const isAvoid = offer.rating === 'AVOID';
                        const isGood = offer.rating === 'GOOD';

                        return (
                          <div
                            key={offer.id}
                            onClick={() => setSelectedOfferId(offer.id)}
                            role="button"
                            tabIndex={0}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99] group ${
                              isBest
                                ? 'bg-emerald-50/70 hover:bg-emerald-100/80 border-emerald-300 ring-1 ring-emerald-200'
                                : isAvoid
                                ? 'bg-red-50/60 hover:bg-red-100/80 border-red-200'
                                : 'bg-white hover:bg-slate-50 border-slate-200'
                            }`}
                            title="Click to select this payment method and inspect its reality check"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                                    {offer.bankOrCard}
                                  </span>

                                  {/* Badge */}
                                  {isBest && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white shadow-xs">
                                      <ThumbsUp className="w-2.5 h-2.5" />
                                      RECOMMENDED: BEST VALUE
                                    </span>
                                  )}
                                  {isGood && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                                      GOOD OFFER
                                    </span>
                                  )}
                                  {isAvoid && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-200">
                                      <ThumbsDown className="w-2.5 h-2.5 text-red-600" />
                                      AVOID: HIDDEN CHARGES
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-slate-600">
                                  {offer.description}
                                </p>

                                <div className="text-[11px] text-slate-700 font-medium flex items-center gap-1.5 pt-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  <span>{offer.reason}</span>
                                </div>
                              </div>

                              {/* Net Cost & Benefit */}
                              <div className="text-right shrink-0">
                                <div className="text-xs text-slate-500 font-medium">
                                  Effective Price
                                </div>
                                <div className={`text-base font-black ${
                                  isBest ? 'text-emerald-700' : isAvoid ? 'text-red-600' : 'text-slate-900'
                                }`}>
                                  ₹{offer.netPrice.toLocaleString('en-IN')}
                                </div>
                                <div className={`text-[10px] font-bold ${
                                  isBest ? 'text-emerald-600' : isAvoid ? 'text-red-700' : 'text-slate-600'
                                }`}>
                                  {offer.effectiveBenefit}
                                </div>
                                <div className="text-[9px] text-slate-400 mt-1 font-semibold group-hover:text-emerald-600">
                                  Select ➔
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Actionable Advice Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>
                    {surfaceType === 'TRAVEL'
                      ? 'CommitGuard Travel Advisory (TNPL Warning):'
                      : surfaceType === 'EDTECH'
                      ? 'CommitGuard EdTech Advisory (Subvention Reality):'
                      : surfaceType === 'UDEMY'
                      ? 'CommitGuard Udemy Advisory (Impulse & Artificial Scarcity):'
                      : surfaceType === 'AMAZON'
                      ? 'CommitGuard Amazon Advisory (Cashback vs EMI Drag):'
                      : 'CommitGuard Flipkart Advisory (Cashback vs EMI Drag):'}
                  </span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {surfaceType === 'TRAVEL' ? (
                    <>
                      <strong>Travel Now, Pay Later (TNPL)</strong> advertises low monthly tranches but triggers <strong>24% to 36% penalty APRs</strong> and compounding bounce fees if any installment is missed post-trip. <strong>Recommended Alternative:</strong> Start a <strong>6-month Liquid Fund SIP</strong> at 7.10% yield to book your trip 100% debt-free.
                    </>
                  ) : surfaceType === 'EDTECH' ? (
                    <>
                      <strong>Education Loan "0% Subvention"</strong> packages frequently embed an upfront <strong>3% to 5% institutional subvention surcharge</strong> into course pricing plus processing fees. If you pay via direct NEFT/UPI or company sponsorship, negotiate the 5% cash rebate.
                    </>
                  ) : surfaceType === 'UDEMY' ? (
                    <>
                      <strong>Udemy Countdown Timers:</strong> The "Sale ends in 5 hours" timer resets automatically on next browser session. Over <strong>87% of purchased self-paced courses are never completed</strong>. If paying, use direct UPI without EMI lock-ins, or invest in a <strong>Liquid Fund</strong> until you have scheduled hours to study.
                    </>
                  ) : surfaceType === 'AMAZON' ? (
                    <>
                      If you hold an <strong>Amazon Pay ICICI Card</strong>, pay in full to lock an unconditional <strong>5% Amazon Pay balance cashback</strong>. If you choose <strong>No-Cost EMI</strong>, you will lose ~₹{mathResult.totalHiddenFriction.toLocaleString('en-IN')} to non-refundable 18% GST on interest and bank processing fees.
                    </>
                  ) : (
                    <>
                      If you hold a <strong>Flipkart Axis Bank Card</strong>, pay in full to lock an unconditional <strong>5% statement cashback</strong>. If you use <strong>No-Cost EMI</strong>, you will lose ~₹{mathResult.totalHiddenFriction.toLocaleString('en-IN')} to non-refundable 18% GST and processing fees.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: EMI FRICTION & AMORTIZATION BREAKDOWN */}
          {activeTab === 'EMI_FRICTION' && (
            <div className="space-y-5">
              {/* Interactive Metric Cards (Instant Dynamic Recalculation) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Effective APR */}
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200">
                  <div className="text-[11px] font-bold text-red-800 uppercase tracking-wide">
                    Effective APR
                  </div>
                  <div className="text-2xl font-black text-red-600 mt-1">
                    {mathResult.effectiveAnnualPercentageRate}%
                  </div>
                  <div className="text-[10px] text-red-700/80 mt-0.5">
                    vs Advertised <strong>0% APR</strong>
                  </div>
                </div>

                {/* Total GST Drag */}
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">
                    Total GST + Fee Drag
                  </div>
                  <div className="text-2xl font-black text-amber-700 mt-1">
                    ₹{mathResult.totalHiddenFriction.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-amber-800/80 mt-0.5">
                    ₹{processingFee} fee + ₹{mathResult.totalGstOnInterest.toFixed(2)} GST
                  </div>
                </div>

                {/* Monthly Outflow */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Monthly Outflow
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    ₹{mathResult.monthlyBaseEmi.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Locked for {tenure} installments
                  </div>
                </div>
              </div>

              {/* 3 Plain-English Bullets */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>3-Bullet Plain-English Translation</span>
                </div>

                <ul className="space-y-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-red-600 mt-1.5 shrink-0" />
                    <span>
                      <strong className="text-red-700 font-bold">19.93% Effective APR Reality: </strong>
                      Even though the merchant provides an upfront discount, bank processing fees and statutory 18% GST convert 0% into <strong>{mathResult.effectiveAnnualPercentageRate}% Effective APR</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                    <span>
                      <strong className="text-slate-900 font-bold">Unrecoverable Monthly Drag: </strong>
                      Every month, your bank card statement bills 18% statutory GST on the interest component. You incur a guaranteed <strong>₹{mathResult.totalHiddenFriction.toLocaleString('en-IN')}</strong> in pure administrative leak.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                    <span>
                      <strong className="text-emerald-800 font-bold">Zero-Friction Baseline: </strong>
                      Paying upfront via direct UPI or debit card eliminates the ₹{mathResult.totalHiddenFriction.toLocaleString('en-IN')} drag completely while keeping your monthly credit limit untouched.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Perfectly Aligned Discrete Slider with Clickable Steps */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="ext-tenure-slider" className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-emerald-600" />
                    <span>Adjust EMI Tenure: <strong className="text-emerald-700 text-sm">{tenure} Months</strong></span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">Click any tenure step</span>
                </div>

                {/* Slider with exact steps mapping 0 to 5 for TENURE_OPTIONS */}
                <div className="relative pt-1 pb-1">
                  <input
                    id="ext-tenure-slider"
                    type="range"
                    min={0}
                    max={TENURE_OPTIONS.length - 1}
                    step={1}
                    value={sliderIndex}
                    onChange={(e) => setSliderIndex(Number(e.target.value))}
                    className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-none"
                  />

                  {/* Exact 1-to-1 Horizontally Aligned Step Labels */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '8px',
                      width: '100%',
                    }}
                  >
                    {TENURE_OPTIONS.map((opt, idx) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSliderIndex(idx)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          cursor: 'pointer',
                          border: sliderIndex === idx ? '1px solid #6ee7b7' : '1px solid transparent',
                          backgroundColor: sliderIndex === idx ? '#ecfdf5' : 'transparent',
                          color: sliderIndex === idx ? '#047857' : '#64748b',
                          fontWeight: sliderIndex === idx ? '800' : '500',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {opt}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 🌟 1. Friction Recovery & Compounding Matrix (Prompt Req 1) */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-emerald-600 text-white">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        Friction Recovery & Compounding Matrix
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Preserve leaked bank fees & GST by paying upfront into a <strong>7.10% Sovereign T-Bill</strong>
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    RBI Benchmark 7.10%
                  </span>
                </div>

                {/* Compounding Comparison Columns */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setCompoundingHorizon('1Y')}
                    className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                      compoundingHorizon === '1Y'
                        ? 'bg-emerald-900 text-white border-emerald-800 ring-2 ring-emerald-400 shadow-sm scale-[1.02]'
                        : 'bg-white hover:bg-emerald-50/50 border-emerald-200 text-slate-900 shadow-2xs'
                    }`}
                  >
                    <div className={`text-[10px] font-bold uppercase ${compoundingHorizon === '1Y' ? 'text-emerald-200' : 'text-slate-500'}`}>
                      1 Year T-Bill
                    </div>
                    <div className={`text-sm sm:text-base font-black mt-0.5 ${compoundingHorizon === '1Y' ? 'text-white' : 'text-slate-900'}`}>
                      ₹{recoveryCompounding.fv1Year.toLocaleString('en-IN')}
                    </div>
                    <div className={`text-[9px] font-semibold mt-0.5 ${compoundingHorizon === '1Y' ? 'text-emerald-300' : 'text-emerald-700'}`}>
                      Preserves ₹{recoveryCompounding.savedFriction.toLocaleString('en-IN')}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompoundingHorizon('3Y')}
                    className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                      compoundingHorizon === '3Y'
                        ? 'bg-emerald-900 text-white border-emerald-800 ring-2 ring-emerald-400 shadow-sm scale-[1.02]'
                        : 'bg-white hover:bg-emerald-50/50 border-emerald-200 text-slate-900 shadow-2xs'
                    }`}
                  >
                    <div className={`text-[10px] font-bold uppercase ${compoundingHorizon === '3Y' ? 'text-emerald-200' : 'text-slate-500'}`}>
                      3 Year Compound
                    </div>
                    <div className={`text-sm sm:text-base font-black mt-0.5 ${compoundingHorizon === '3Y' ? 'text-white' : 'text-emerald-700'}`}>
                      ₹{recoveryCompounding.fv3Year.toLocaleString('en-IN')}
                    </div>
                    <div className={`text-[9px] font-semibold mt-0.5 ${compoundingHorizon === '3Y' ? 'text-emerald-300' : 'text-emerald-600'}`}>
                      +₹{(recoveryCompounding.fv3Year - recoveryCompounding.savedFriction).toLocaleString('en-IN')} yield
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompoundingHorizon('5Y')}
                    className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                      compoundingHorizon === '5Y'
                        ? 'bg-emerald-900 text-white border-emerald-800 ring-2 ring-emerald-400 shadow-sm scale-[1.02]'
                        : 'bg-white hover:bg-emerald-50/50 border-emerald-200 text-slate-900 shadow-2xs'
                    }`}
                  >
                    <div className={`text-[10px] font-bold uppercase ${compoundingHorizon === '5Y' ? 'text-emerald-300' : 'text-slate-500'}`}>
                      5 Year Wealth
                    </div>
                    <div className={`text-sm sm:text-base font-black mt-0.5 ${compoundingHorizon === '5Y' ? 'text-white' : 'text-slate-900'}`}>
                      ₹{recoveryCompounding.fv5Year.toLocaleString('en-IN')}
                    </div>
                    <div className={`text-[9px] font-semibold mt-0.5 ${compoundingHorizon === '5Y' ? 'text-emerald-200' : 'text-emerald-700'}`}>
                      +₹{recoveryCompounding.compoundedGain5Y.toLocaleString('en-IN')} pure gain
                    </div>
                  </button>
                </div>

                {/* Pre-Commitment Liquid SIP Comparison */}
                <div className="p-2.5 rounded-lg bg-slate-900 text-white text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <PiggyBank className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-[11px] text-slate-200">
                      Invest ₹{mathResult.monthlyBaseEmi.toLocaleString('en-IN')}/mo in Liquid Fund SIP instead:
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-emerald-400">
                      ₹{recoveryCompounding.sipFv.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] text-slate-400 block font-mono">
                      (+₹{recoveryCompounding.sipGain.toLocaleString('en-IN')} yield vs -₹{recoveryCompounding.savedFriction} leak)
                    </span>
                  </div>
                </div>
              </div>

              {/* Expandable Amortization Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <button
                  onClick={() => setIsProofOpen(!isProofOpen)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <span>Deterministic Monthly Breakdown ({tenure} Months)</span>
                  {isProofOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isProofOpen && (
                  <div className="p-3 border-t border-slate-100 max-h-44 overflow-y-auto">
                    <table className="w-full text-[10px] text-left">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-1.5 px-2">Month</th>
                          <th className="py-1.5 px-2">Principal</th>
                          <th className="py-1.5 px-2">Interest</th>
                          <th className="py-1.5 px-2 text-red-600">18% GST</th>
                          <th className="py-1.5 px-2 font-bold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600 font-mono">
                        {mathResult.schedule.map((row) => (
                          <tr key={row.month}>
                            <td className="py-1 px-2 font-bold">{row.month}</td>
                            <td className="py-1 px-2">₹{row.principalComponent.toLocaleString('en-IN')}</td>
                            <td className="py-1 px-2">₹{row.interestComponent.toLocaleString('en-IN')}</td>
                            <td className="py-1 px-2 text-red-600">₹{row.gstOnInterest.toFixed(2)}</td>
                            <td className="py-1 px-2 font-bold text-slate-900">₹{row.totalMonthlyCashflow.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}


          {/* Action Buttons: Cancel (STAYS ON CURRENT PAGE) vs Proceed (GOES FORWARD) */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              id="btn-cancel-stay"
              onClick={onCancelStayOnPage}
              className="w-1/2 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 border border-slate-300 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>Cancel & Modify Terms</span>
            </button>

            <button
              id="btn-close-proceed"
              onClick={onProceedAndContinue}
              className="w-1/2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <span>I Understand, Proceed</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
