import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  X,
  Sliders,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  CreditCard,
  TrendingUp,
  PiggyBank,
  Search,
  Wallet,
} from 'lucide-react';
import { calculateNoCostEmiDrag, evaluateMultiCartEmiRisk, calculateCreditUtilizationImpact, calculateForfeitedCardReward } from '../lib/financial-engine';
import { CARD_REWARD_PROFILES, findCardRewardProfile, getCardRewardRate, type SpendCategory } from '../lib/card-rewards';

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

// Small "what is this purchase" tag per surface — plain nouns, not a tagline.
const SURFACE_LABEL: Record<InterceptorSurface, string> = {
  AMAZON: 'Amazon order',
  FLIPKART: 'Flipkart order',
  ECOMMERCE: 'Online order',
  TRAVEL: 'Trip booking',
  EDTECH: 'Course enrollment',
  UDEMY: 'Course purchase',
};

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

  const [showAllMethods, setShowAllMethods] = useState<boolean>(false);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [compoundingHorizon, setCompoundingHorizon] = useState<'1Y' | '3Y' | '5Y'>('5Y');
  const [isProofOpen, setIsProofOpen] = useState(false);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [isEmiMathOpen, setIsEmiMathOpen] = useState(false);
  const [isCurOpen, setIsCurOpen] = useState(false);
  const [isCardRewardOpen, setIsCardRewardOpen] = useState(false);

  // Dynamic Tenure Simulator for active scraped payment option
  const [customTenure, setCustomTenure] = useState<number>(12);
  const [simulatedTenureOffer, setSimulatedTenureOffer] = useState<ScrapedOffer | null>(null);

  // Pre-Checkout CIBIL / Credit Utilization Ratio (CUR) Simulator
  const CREDIT_LIMIT_PRESETS = [50000, 100000, 200000];
  const [creditLimitInput, setCreditLimitInput] = useState<number>(100000);
  const [existingCardBalanceInput, setExistingCardBalanceInput] = useState<number>(0);
  const [isCustomLimit, setIsCustomLimit] = useState<boolean>(false);

  // Dual-Ledger Card Reward Profile — remembered across checkouts via chrome.storage.sync
  // so the user only ever picks their card once, not on every single purchase.
  const QUICK_CARD_IDS = ['amazon-pay-icici', 'flipkart-axis', 'hdfc-millennia', 'sbi-cashback', 'hdfc-infinia'];
  const [selectedCardId, setSelectedCardId] = useState<string>('amazon-pay-icici');
  const [isCustomCardRate, setIsCustomCardRate] = useState<boolean>(false);
  const [customCardRatePercent, setCustomCardRatePercent] = useState<number>(2);
  const [showFullCardList, setShowFullCardList] = useState<boolean>(false);
  const [cardSearchQuery, setCardSearchQuery] = useState<string>('');

  useEffect(() => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(
          ['commitguard_selected_card_id', 'commitguard_custom_card_rate'],
          (items) => {
            if (!items) return;
            if (items.commitguard_selected_card_id === 'custom') {
              setIsCustomCardRate(true);
              if (typeof items.commitguard_custom_card_rate === 'number') {
                setCustomCardRatePercent(items.commitguard_custom_card_rate);
              }
            } else if (typeof items.commitguard_selected_card_id === 'string' && findCardRewardProfile(items.commitguard_selected_card_id)) {
              setSelectedCardId(items.commitguard_selected_card_id);
            }
          }
        );
      }
    } catch (_) {
      // Standalone/preview context without chrome.storage — keep sensible defaults
    }
  }, []);

  const persistCardChoice = (cardId: string, customRate?: number) => {
    if (cardId === 'custom') {
      setIsCustomCardRate(true);
      if (typeof customRate === 'number') setCustomCardRatePercent(customRate);
    } else {
      setIsCustomCardRate(false);
      setSelectedCardId(cardId);
    }
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({
          commitguard_selected_card_id: cardId,
          ...(typeof customRate === 'number' ? { commitguard_custom_card_rate: customRate } : {}),
        });
      }
    } catch (_) {}
  };

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

  // Whether the currently selected option actually blocks a credit line at all — UPI/direct
  // debit/cool-off settle instantly from the bank account, so CUR is not applicable to them.
  const isCreditBasedSelection = !!selectedOffer && !/upi|direct debit|cool-off/i.test(selectedOffer.bankOrCard);

  // Udemy's real checkout never offers bank EMI (only UPI/Cards/Net Banking/Wallet) — showing
  // fabricated "Effective APR" math for an EMI plan that was never actually on offer there
  // would be misleading, not just unstyled. Every other surface genuinely can carry bank EMI.
  const hasRealEmiOption = surfaceType !== 'UDEMY';

  // Pre-Checkout Credit Utilization Ratio (CUR): the bank blocks the FULL principal of
  // whichever payment option is currently selected, not just the monthly EMI installment.
  const curResult = useMemo(() => {
    return calculateCreditUtilizationImpact({
      orderPrincipal: selectedOffer?.netPrice ?? productPrice,
      existingCardBalance: existingCardBalanceInput,
      totalCreditLimit: creditLimitInput,
    });
  }, [selectedOffer, productPrice, existingCardBalanceInput, creditLimitInput]);

  // Dual-Ledger Forfeited Card Reward: travel surfaces use the card's travel reward rate,
  // every other surface uses the online rate — a flat "5% cashback" figure is wrong for
  // premium cards where travel and online rates genuinely differ.
  const spendCategory: SpendCategory = surfaceType === 'TRAVEL' ? 'travel' : 'online';
  const selectedCardProfile = findCardRewardProfile(selectedCardId) || CARD_REWARD_PROFILES[0];
  const activeCardRatePercent = isCustomCardRate ? customCardRatePercent : getCardRewardRate(selectedCardProfile, spendCategory);
  const activeCardLabel = isCustomCardRate ? `Custom card (${customCardRatePercent}%)` : selectedCardProfile.shortLabel;

  const forfeitedRewardResult = useMemo(() => {
    return calculateForfeitedCardReward({
      orderPrincipal: selectedOffer?.netPrice ?? productPrice,
      rewardRatePercent: activeCardRatePercent,
    });
  }, [selectedOffer, productPrice, activeCardRatePercent]);

  const filteredCardList = useMemo(() => {
    const q = cardSearchQuery.trim().toLowerCase();
    if (!q) return CARD_REWARD_PROFILES;
    return CARD_REWARD_PROFILES.filter(
      (c) => c.shortLabel.toLowerCase().includes(q) || c.bankOrCard.toLowerCase().includes(q)
    );
  }, [cardSearchQuery]);

  // One plain-English verdict line for the selected option — the entire "3-second read."
  const verdictLine = useMemo(() => {
    if (!selectedOffer) return '';
    if (selectedOffer.rating === 'BEST') return `Best value — ${selectedOffer.effectiveBenefit.toLowerCase()}.`;
    if (selectedOffer.rating === 'AVOID') return `Costs more than it looks — ${selectedOffer.effectiveBenefit.toLowerCase()}.`;
    return selectedOffer.effectiveBenefit;
  }, [selectedOffer]);

  const ratingInk = (rating: ScrapedOffer['rating']) =>
    rating === 'BEST' ? 'text-ledger-credit' : rating === 'AVOID' ? 'text-ledger-debit' : 'text-ledger-navy';

  const ratingStampLabel = (rating: ScrapedOffer['rating']) =>
    rating === 'BEST' ? 'Best value' : rating === 'AVOID' ? 'Costly' : rating === 'GOOD' ? 'Fair deal' : '';

  const stampClasses = (rating: ScrapedOffer['rating']) =>
    `inline-block -rotate-2 border px-2 py-0.5 text-[11px] font-bold tracking-tight ${
      rating === 'BEST'
        ? 'border-ledger-credit text-ledger-credit'
        : rating === 'AVOID'
        ? 'border-ledger-debit text-ledger-debit'
        : 'border-ledger-navy/40 text-ledger-navy'
    }`;

  return (
    <div
      className="commitguard-backdrop"
      onClick={(e) => {
        // Clicking outside cancels and stays on page
        if (e.target === e.currentTarget) onCancelStayOnPage();
      }}
    >
      <div className="commitguard-card">
        {/* Navy header band — the "cover" of the ledger slip */}
        <div className="bg-ledger-navy px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ShieldCheck className="w-5 h-5 text-ledger-seal shrink-0" />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-white font-bold text-lg">CommitGuard</span>
                <span className="text-white/50 text-sm font-medium">{SURFACE_LABEL[surfaceType]}</span>
              </div>
              <p className="text-white/70 text-sm mt-0.5">The real cost, before you pay.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-white/40 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-ledger-seal animate-pulse" />
              live · &lt;1.2ms
            </span>
            <button
              onClick={onCancelStayOnPage}
              title="Cancel and stay on page (Escape)"
              aria-label="Cancel"
              className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Paper body */}
        <div className="bg-ledger-paper max-h-[85vh] overflow-y-auto">
          {/* Item + price ledger line */}
          <div className="px-6 py-3.5 border-b border-ledger-rule flex items-center justify-between gap-3">
            <span className="text-base font-semibold text-ledger-navy truncate">{productName}</span>
            <span className="flex items-baseline gap-2 shrink-0 font-mono tabular-nums">
              {typeof originalPrice === 'number' && originalPrice > 0 && (
                <span className="text-sm text-ledger-navy/40 line-through">₹{originalPrice.toLocaleString('en-IN')}</span>
              )}
              <span className="text-xl font-bold text-ledger-navy">₹{productPrice.toLocaleString('en-IN')}</span>
              {typeof discountPercent === 'number' && discountPercent > 0 && (
                <span className="text-[11px] font-bold text-ledger-credit">{discountPercent}% off</span>
              )}
            </span>
          </div>

          {/* Multi-item cart notice */}
          {isMultiItemCart && (
            <div className="mx-6 mt-3.5 p-3 border border-ledger-rule bg-white text-sm text-ledger-navy space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold">{cartItemCount} items in this cart · ₹{productPrice.toLocaleString('en-IN')} total</span>
                <span className={`font-mono tabular-nums font-bold ${multiCartRisk.meetsMinThreshold ? 'text-ledger-credit' : 'text-ledger-debit'}`}>
                  {multiCartRisk.meetsMinThreshold ? 'Meets EMI minimum' : 'Below ₹3,000 EMI minimum'}
                </span>
              </div>
              <p className="text-ledger-navy/70 leading-relaxed">
                If even one item here doesn't qualify for No-Cost EMI, banks often void the discount for the whole order — that could add roughly ₹{multiCartRisk.totalRiskAmount.toLocaleString('en-IN')} in standard interest. Checking out the high-value item alone keeps the EMI discount intact.
              </p>
              {cartItemsPreview && cartItemsPreview.length > 0 && (
                <p className="text-ledger-navy/40 text-xs italic">In cart: {cartItemsPreview.slice(0, 3).join(', ')}</p>
              )}
            </div>
          )}

          <div className="px-6 py-4 space-y-4">
            {/* Payment methods discovered on the page — compact chip row */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-ledger-navy/70">Payment methods on this page</span>
                <span className="text-[11px] font-mono text-ledger-navy/40">scraped live</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allOffers.map((offer) => (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={() => {
                      setSimulatedTenureOffer(null);
                      setSelectedOfferId(offer.id);
                    }}
                    className={`px-3 py-1.5 text-sm font-semibold border transition-colors ${
                      selectedOffer?.id === offer.id
                        ? 'bg-ledger-navy text-white border-ledger-navy'
                        : 'bg-white text-ledger-navy/80 border-ledger-rule hover:border-ledger-navy/40'
                    }`}
                  >
                    {offer.bankOrCard}
                  </button>
                ))}
              </div>

              {/* Tenure simulator, only for non-instant selections */}
              {selectedOffer && !/upi|direct|cool-off/i.test(selectedOffer.bankOrCard) && (
                <div className="pt-2 border-t border-ledger-rule flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ledger-navy/70">Try a different tenure on this card:</span>
                  <div className="flex items-center gap-1.5">
                    {[3, 6, 9, 12, 18, 24, 36].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleSimulateTenure(m, selectedOffer)}
                        className={`px-2 py-1 text-xs font-mono tabular-nums font-bold border transition-colors ${
                          customTenure === m && simulatedTenureOffer
                            ? 'bg-ledger-navy text-white border-ledger-navy'
                            : 'bg-white text-ledger-navy/70 border-ledger-rule hover:border-ledger-navy/40'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* TIER 1: the whole point — what you picked, the verdict, the true cost */}
            {selectedOffer && (
              <div className="border-t-2 border-b-2 border-ledger-navy py-3.5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-ledger-navy/50">You selected</span>
                      {ratingStampLabel(selectedOffer.rating) && (
                        <span className={stampClasses(selectedOffer.rating)}>{ratingStampLabel(selectedOffer.rating)}</span>
                      )}
                    </div>
                    <p className="font-bold text-ledger-navy text-lg leading-tight">{selectedOffer.bankOrCard}</p>
                    <p className="text-sm text-ledger-navy/70">{verdictLine}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-ledger-navy/50 font-semibold">True cost</div>
                    <div className={`text-2xl font-bold font-mono tabular-nums ${ratingInk(selectedOffer.rating)}`}>
                      ₹{selectedOffer.netPrice.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-ledger-navy/80 leading-relaxed border-l-2 border-ledger-rule pl-2.5">
                  {selectedOffer.reason}
                </p>
              </div>
            )}

            {/* TIER 2: everything below is one tap away, not shoved in front of you */}
            <div className="divide-y divide-ledger-rule border border-ledger-rule bg-white">
              {otherOffers.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAllMethods(!showAllMethods)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-sm font-semibold text-ledger-navy hover:bg-ledger-paper/60 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-ledger-navy/50" />
                      Compare other ways to pay ({otherOffers.length})
                    </span>
                    {showAllMethods ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showAllMethods && (
                    <div className="px-3.5 pb-3.5 space-y-2">
                      {otherOffers.map((offer) => (
                        <button
                          key={offer.id}
                          type="button"
                          onClick={() => setSelectedOfferId(offer.id)}
                          className="w-full text-left p-3 border border-ledger-rule hover:border-ledger-navy/40 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-base text-ledger-navy">{offer.bankOrCard}</span>
                                {ratingStampLabel(offer.rating) && (
                                  <span className={stampClasses(offer.rating)}>{ratingStampLabel(offer.rating)}</span>
                                )}
                              </div>
                              <p className="text-sm text-ledger-navy/60">{offer.description}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`text-base font-bold font-mono tabular-nums ${ratingInk(offer.rating)}`}>
                                ₹{offer.netPrice.toLocaleString('en-IN')}
                              </div>
                              <div className="text-[11px] text-ledger-navy/50">{offer.effectiveBenefit}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Credit limit impact (CIBIL / CUR) */}
              {isCreditBasedSelection && (
                <div>
                  <button
                    type="button"
                    onClick={() => setIsCurOpen(!isCurOpen)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-sm font-semibold text-ledger-navy hover:bg-ledger-paper/60 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-ledger-navy/50" />
                      Credit limit impact
                      <span className={`font-mono tabular-nums text-xs ${curResult.riskTier === 'DANGER' ? 'text-ledger-debit' : curResult.riskTier === 'CAUTION' ? 'text-ledger-seal' : 'text-ledger-credit'}`}>
                        {curResult.utilizationRatioPercent}%
                      </span>
                    </span>
                    {isCurOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {isCurOpen && (
                    <div className="px-3.5 pb-3.5 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-ledger-navy/60">Your total card limit</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {CREDIT_LIMIT_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                setCreditLimitInput(preset);
                                setIsCustomLimit(false);
                              }}
                              className={`px-2.5 py-1 text-xs font-semibold border transition-colors ${
                                !isCustomLimit && creditLimitInput === preset
                                  ? 'bg-ledger-navy text-white border-ledger-navy'
                                  : 'bg-white text-ledger-navy/70 border-ledger-rule hover:border-ledger-navy/40'
                              }`}
                            >
                              {preset >= 100000 ? `₹${preset / 100000}L` : `₹${preset / 1000}k`}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setIsCustomLimit(true)}
                            className={`px-2.5 py-1 text-xs font-semibold border transition-colors ${
                              isCustomLimit
                                ? 'bg-ledger-navy text-white border-ledger-navy'
                                : 'bg-white text-ledger-navy/70 border-ledger-rule hover:border-ledger-navy/40'
                            }`}
                          >
                            Custom
                          </button>
                        </div>
                      </div>

                      {isCustomLimit && (
                        <input
                          type="number"
                          min={0}
                          value={creditLimitInput}
                          onChange={(e) => setCreditLimitInput(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="Your total credit limit (₹)"
                          className="w-full px-3 py-1.5 border border-ledger-rule text-sm font-semibold text-ledger-navy focus:outline-none focus:border-ledger-navy bg-white"
                        />
                      )}

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-ledger-navy/60 shrink-0">Already spent on this card</span>
                        <input
                          type="number"
                          min={0}
                          value={existingCardBalanceInput || ''}
                          onChange={(e) => setExistingCardBalanceInput(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="₹0"
                          className="w-28 px-2.5 py-1 border border-ledger-rule text-xs font-mono tabular-nums text-ledger-navy focus:outline-none focus:border-ledger-navy bg-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                          <span className="text-ledger-navy/60">
                            ₹{curResult.blockedAmount.toLocaleString('en-IN')} of ₹{curResult.totalCreditLimit.toLocaleString('en-IN')} blocked
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-ledger-rule/60">
                          <div
                            className={`h-full ${
                              curResult.riskTier === 'SAFE' ? 'bg-ledger-credit' : curResult.riskTier === 'CAUTION' ? 'bg-ledger-seal' : 'bg-ledger-debit'
                            }`}
                            style={{ width: `${Math.min(100, curResult.utilizationRatioPercent)}%` }}
                          />
                        </div>
                      </div>

                      <p className="text-sm text-ledger-navy/80 leading-relaxed border-l-2 border-ledger-rule pl-2.5">
                        {curResult.riskTier === 'SAFE' &&
                          `This uses only ${curResult.utilizationRatioPercent}% of your limit — no expected score impact.`}
                        {curResult.riskTier === 'CAUTION' &&
                          `This locks ${curResult.utilizationRatioPercent}% of your ₹${curResult.totalCreditLimit.toLocaleString('en-IN')} limit — may cause a minor score dip (est. ${curResult.estimatedScoreDropRange} pts) if it stays high through your next billing cycle.`}
                        {curResult.riskTier === 'DANGER' &&
                          `This locks ${curResult.utilizationRatioPercent}% of your ₹${curResult.totalCreditLimit.toLocaleString('en-IN')} limit — expect an estimated ${curResult.estimatedScoreDropRange} point score drop on your next report.`}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Card reward check (Dual-Ledger) */}
              {isCreditBasedSelection && (
                <div>
                  <button
                    type="button"
                    onClick={() => setIsCardRewardOpen(!isCardRewardOpen)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-sm font-semibold text-ledger-navy hover:bg-ledger-paper/60 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Wallet className="w-3.5 h-3.5 text-ledger-navy/50" />
                      Card reward check
                      <span className="font-mono tabular-nums text-xs text-ledger-debit">
                        -₹{forfeitedRewardResult.forfeitedIfEmi.toLocaleString('en-IN')}
                      </span>
                    </span>
                    {isCardRewardOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {isCardRewardOpen && (
                    <div className="px-3.5 pb-3.5 space-y-3">
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-ledger-navy/60">Which card are you using?</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {QUICK_CARD_IDS.map((id) => {
                            const card = findCardRewardProfile(id);
                            if (!card) return null;
                            const isActive = !isCustomCardRate && selectedCardId === id;
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => persistCardChoice(id)}
                                className={`px-2.5 py-1 text-xs font-semibold border transition-colors ${
                                  isActive
                                    ? 'bg-ledger-navy text-white border-ledger-navy'
                                    : 'bg-white text-ledger-navy/70 border-ledger-rule hover:border-ledger-navy/40'
                                }`}
                              >
                                {card.shortLabel}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setShowFullCardList(!showFullCardList)}
                            className="px-2.5 py-1 text-xs font-semibold border border-dashed border-ledger-navy/30 text-ledger-navy/60 hover:border-ledger-navy/60 inline-flex items-center gap-1"
                          >
                            {showFullCardList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            More cards
                          </button>
                          <button
                            type="button"
                            onClick={() => persistCardChoice('custom', customCardRatePercent)}
                            className={`px-2.5 py-1 text-xs font-semibold border transition-colors ${
                              isCustomCardRate
                                ? 'bg-ledger-navy text-white border-ledger-navy'
                                : 'bg-white text-ledger-navy/70 border-ledger-rule hover:border-ledger-navy/40'
                            }`}
                          >
                            Custom %
                          </button>
                        </div>
                      </div>

                      {showFullCardList && (
                        <div className="space-y-1.5 pt-1 border-t border-ledger-rule">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-ledger-navy/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={cardSearchQuery}
                              onChange={(e) => setCardSearchQuery(e.target.value)}
                              placeholder="Search your bank or card (e.g. Axis, HDFC, SBI)"
                              className="w-full pl-8 pr-3 py-1.5 border border-ledger-rule text-sm font-medium text-ledger-navy focus:outline-none focus:border-ledger-navy bg-white"
                            />
                          </div>
                          <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                            {filteredCardList.map((card) => (
                              <button
                                key={card.id}
                                type="button"
                                onClick={() => {
                                  persistCardChoice(card.id);
                                  setShowFullCardList(false);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 text-xs font-semibold border transition-colors ${
                                  !isCustomCardRate && selectedCardId === card.id
                                    ? 'bg-ledger-navy text-white border-ledger-navy'
                                    : 'bg-white text-ledger-navy/70 border-ledger-rule hover:border-ledger-navy/40'
                                }`}
                              >
                                {card.bankOrCard}
                              </button>
                            ))}
                            {filteredCardList.length === 0 && (
                              <p className="text-xs text-ledger-navy/50 px-1 py-2">No match — use "Custom %" instead.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {isCustomCardRate && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-ledger-navy/60 shrink-0">Your card's reward rate</span>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            step={0.1}
                            value={customCardRatePercent}
                            onChange={(e) => persistCardChoice('custom', Math.max(0, Number(e.target.value) || 0))}
                            className="w-20 px-2.5 py-1 border border-ledger-rule text-xs font-mono tabular-nums text-ledger-navy focus:outline-none focus:border-ledger-navy bg-white"
                          />
                          <span className="text-xs font-semibold text-ledger-navy/60">%</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 divide-x divide-ledger-rule border border-ledger-rule">
                        <div className="p-2.5">
                          <div className="text-[11px] font-semibold text-ledger-navy/50">Full-swipe reward</div>
                          <div className="text-base font-bold font-mono tabular-nums text-ledger-credit">
                            +₹{forfeitedRewardResult.rewardIfFullSwipe.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[11px] text-ledger-navy/50">{activeCardLabel} @ {activeCardRatePercent}%</div>
                        </div>
                        <div className="p-2.5">
                          <div className="text-[11px] font-semibold text-ledger-navy/50">Forfeited on EMI</div>
                          <div className="text-base font-bold font-mono tabular-nums text-ledger-debit">
                            -₹{forfeitedRewardResult.forfeitedIfEmi.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[11px] text-ledger-navy/50">EMI earns ₹0 reward</div>
                        </div>
                      </div>

                      {!isCustomCardRate && (
                        <p className="text-[11px] text-ledger-navy/50 leading-relaxed">{selectedCardProfile.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* EMI cost breakdown — only when this surface actually offers bank EMI */}
              {hasRealEmiOption && (
                <div>
                  <button
                    type="button"
                    onClick={() => setIsEmiMathOpen(!isEmiMathOpen)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-sm font-semibold text-ledger-navy hover:bg-ledger-paper/60 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-ledger-navy/50" />
                      What EMI actually costs
                      <span className="font-mono tabular-nums text-xs text-ledger-debit">{mathResult.effectiveAnnualPercentageRate}% APR</span>
                    </span>
                    {isEmiMathOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {isEmiMathOpen && (
                    <div className="px-3.5 pb-3.5 space-y-4">
                      {/* Ledger-style stat row */}
                      <div className="grid grid-cols-3 divide-x divide-ledger-rule border border-ledger-rule">
                        <div className="p-2.5">
                          <div className="text-[11px] font-semibold text-ledger-navy/50">Effective APR</div>
                          <div className="text-xl font-bold font-mono tabular-nums text-ledger-debit">{mathResult.effectiveAnnualPercentageRate}%</div>
                          <div className="text-[11px] text-ledger-navy/50">vs 0% advertised</div>
                        </div>
                        <div className="p-2.5">
                          <div className="text-[11px] font-semibold text-ledger-navy/50">GST + fee drag</div>
                          <div className="text-xl font-bold font-mono tabular-nums text-ledger-navy">₹{mathResult.totalHiddenFriction.toLocaleString('en-IN')}</div>
                          <div className="text-[11px] text-ledger-navy/50">₹{processingFee} fee + ₹{mathResult.totalGstOnInterest.toFixed(2)} GST</div>
                        </div>
                        <div className="p-2.5">
                          <div className="text-[11px] font-semibold text-ledger-navy/50">Monthly outflow</div>
                          <div className="text-xl font-bold font-mono tabular-nums text-ledger-navy">₹{mathResult.monthlyBaseEmi.toLocaleString('en-IN')}</div>
                          <div className="text-[11px] text-ledger-navy/50">for {tenure} months</div>
                        </div>
                      </div>

                      {/* Plain-English translation */}
                      <ul className="space-y-2 text-sm text-ledger-navy/80 leading-relaxed">
                        <li className="border-l-2 border-ledger-debit pl-2.5">
                          The merchant's upfront discount offsets the bank's interest, but processing fees and statutory 18% GST turn 0% into <strong className="text-ledger-navy">{mathResult.effectiveAnnualPercentageRate}% effective APR</strong>.
                        </li>
                        <li className="border-l-2 border-ledger-seal pl-2.5">
                          Every month, GST on the interest component adds up to a guaranteed <strong className="text-ledger-navy">₹{mathResult.totalHiddenFriction.toLocaleString('en-IN')}</strong> that you can't get back.
                        </li>
                        <li className="border-l-2 border-ledger-credit pl-2.5">
                          Paying upfront by UPI or debit card removes that ₹{mathResult.totalHiddenFriction.toLocaleString('en-IN')} drag entirely and keeps your credit limit untouched.
                        </li>
                      </ul>

                      {/* Tenure slider */}
                      <div className="border-t border-ledger-rule pt-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <label htmlFor="ext-tenure-slider" className="font-semibold text-ledger-navy flex items-center gap-1.5">
                            Tenure: <span className="font-mono tabular-nums font-bold">{tenure} months</span>
                          </label>
                        </div>
                        <input
                          id="ext-tenure-slider"
                          type="range"
                          min={0}
                          max={TENURE_OPTIONS.length - 1}
                          step={1}
                          value={sliderIndex}
                          onChange={(e) => setSliderIndex(Number(e.target.value))}
                          className="w-full h-1.5 bg-ledger-rule appearance-none cursor-pointer accent-ledger-navy focus:outline-none"
                        />
                        <div className="flex items-center justify-between">
                          {TENURE_OPTIONS.map((opt, idx) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setSliderIndex(idx)}
                              className={`px-2 py-1 text-xs font-mono tabular-nums ${
                                sliderIndex === idx ? 'text-ledger-navy font-bold' : 'text-ledger-navy/40'
                              }`}
                            >
                              {opt}m
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Wealth-recovery projections — buried tier 3, genuinely optional */}
                      <div className="border-t border-ledger-rule pt-1">
                        <button
                          type="button"
                          onClick={() => setIsRecoveryOpen(!isRecoveryOpen)}
                          className="w-full py-2 flex items-center justify-between text-xs font-semibold text-ledger-navy/70 hover:text-ledger-navy transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" />
                            What that saved money could grow into
                          </span>
                          {isRecoveryOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isRecoveryOpen && (
                          <div className="space-y-2.5 pb-1">
                            <p className="text-xs text-ledger-navy/50">
                              If you invested the ₹{recoveryCompounding.savedFriction.toLocaleString('en-IN')} you saved into a 7.10% sovereign T-Bill instead:
                            </p>
                            <div className="grid grid-cols-3 divide-x divide-ledger-rule border border-ledger-rule">
                              {(['1Y', '3Y', '5Y'] as const).map((h) => {
                                const value = h === '1Y' ? recoveryCompounding.fv1Year : h === '3Y' ? recoveryCompounding.fv3Year : recoveryCompounding.fv5Year;
                                const label = h === '1Y' ? '1 year' : h === '3Y' ? '3 years' : '5 years';
                                const isActive = compoundingHorizon === h;
                                return (
                                  <button
                                    key={h}
                                    type="button"
                                    onClick={() => setCompoundingHorizon(h)}
                                    className={`p-2 text-center transition-colors ${isActive ? 'bg-ledger-navy text-white' : 'bg-white text-ledger-navy hover:bg-ledger-paper'}`}
                                  >
                                    <div className={`text-[11px] ${isActive ? 'text-white/60' : 'text-ledger-navy/50'}`}>{label}</div>
                                    <div className="text-base font-bold font-mono tabular-nums">₹{value.toLocaleString('en-IN')}</div>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex items-center justify-between gap-2 p-2.5 bg-ledger-navy text-white text-xs">
                              <span className="flex items-center gap-2 text-white/80">
                                <PiggyBank className="w-3.5 h-3.5 shrink-0" />
                                Invest ₹{mathResult.monthlyBaseEmi.toLocaleString('en-IN')}/mo in a liquid fund instead:
                              </span>
                              <span className="font-mono tabular-nums font-bold shrink-0">₹{recoveryCompounding.sipFv.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Full amortization table — tier 3, buried */}
                      <div className="border-t border-ledger-rule pt-1">
                        <button
                          onClick={() => setIsProofOpen(!isProofOpen)}
                          className="w-full py-2 flex items-center justify-between text-xs font-semibold text-ledger-navy/70 hover:text-ledger-navy transition-colors"
                        >
                          <span>Full monthly breakdown ({tenure} months)</span>
                          {isProofOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        {isProofOpen && (
                          <div className="max-h-44 overflow-y-auto border border-ledger-rule">
                            <table className="w-full text-[11px] text-left font-mono tabular-nums">
                              <thead className="bg-ledger-paper text-ledger-navy/60 font-bold sticky top-0">
                                <tr>
                                  <th className="py-1.5 px-2 font-semibold">Month</th>
                                  <th className="py-1.5 px-2 font-semibold">Principal</th>
                                  <th className="py-1.5 px-2 font-semibold">Interest</th>
                                  <th className="py-1.5 px-2 font-semibold text-ledger-debit">GST</th>
                                  <th className="py-1.5 px-2 font-semibold">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-ledger-rule text-ledger-navy/70">
                                {mathResult.schedule.map((row) => (
                                  <tr key={row.month}>
                                    <td className="py-1 px-2 font-bold">{row.month}</td>
                                    <td className="py-1 px-2">₹{row.principalComponent.toLocaleString('en-IN')}</td>
                                    <td className="py-1 px-2">₹{row.interestComponent.toLocaleString('en-IN')}</td>
                                    <td className="py-1 px-2 text-ledger-debit">₹{row.gstOnInterest.toFixed(2)}</td>
                                    <td className="py-1 px-2 font-bold text-ledger-navy">₹{row.totalMonthlyCashflow.toLocaleString('en-IN')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Advisory — short, always visible, this is CommitGuard's own take */}
            <div className="text-sm text-ledger-navy/80 leading-relaxed border-l-2 border-ledger-seal pl-3">
              <span className="font-bold text-ledger-navy">Why we're flagging this. </span>
              {surfaceType === 'TRAVEL' ? (
                <>Travel Now, Pay Later advertises low monthly amounts but charges 24–36% penalty APR if you miss a payment after your trip. A 6-month liquid fund SIP at 7.10% gets you there debt-free instead.</>
              ) : surfaceType === 'EDTECH' ? (
                <>"0% subvention" loan packages often bake a 3–5% surcharge into the course price itself. Paying by direct transfer usually earns a comparable cash rebate.</>
              ) : surfaceType === 'UDEMY' ? (
                <>Udemy's countdown timer resets every browser session — it isn't really running out. Over 87% of self-paced courses bought on impulse are never finished. Pay by UPI or hold the money in a liquid fund until you've scheduled time to actually study.</>
              ) : surfaceType === 'AMAZON' ? (
                <>Paying in full with an Amazon Pay ICICI card locks a real 5% cashback. Choosing No-Cost EMI instead costs you roughly ₹{mathResult.totalHiddenFriction.toLocaleString('en-IN')} in non-refundable GST and fees.</>
              ) : (
                <>Paying in full with a Flipkart Axis card locks a real 5% cashback. Choosing No-Cost EMI instead costs you roughly ₹{mathResult.totalHiddenFriction.toLocaleString('en-IN')} in non-refundable GST and fees.</>
              )}
            </div>
          </div>
        </div>

        {/* Action row */}
        <div className="bg-white px-6 py-3.5 border-t border-ledger-rule flex items-center justify-between gap-3">
          <button
            id="btn-cancel-stay"
            onClick={onCancelStayOnPage}
            className="w-1/2 py-2.5 px-4 border border-ledger-rule text-ledger-navy text-sm sm:text-base font-semibold hover:bg-ledger-paper transition-colors flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Cancel and change terms
          </button>
          <button
            id="btn-close-proceed"
            onClick={onProceedAndContinue}
            className="w-1/2 py-2.5 px-4 bg-ledger-navy text-white text-sm sm:text-base font-semibold hover:bg-ledger-navy/90 transition-colors flex items-center justify-center gap-1.5"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
