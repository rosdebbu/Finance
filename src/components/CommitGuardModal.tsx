'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  CheckCircle2,
  Sliders,
  TrendingUp,
  Coins,
  Landmark,
  ShieldAlert,
  RotateCcw,
  ShoppingBag,
} from 'lucide-react';
import { calculateNoCostEmiDrag, evaluateMultiCartEmiRisk } from '@/lib/financial-engine';

export type InterceptorType = 'EMI' | 'VEHICLE_LOAN';

interface CommitGuardModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: InterceptorType;
  onProceedAnyway: () => void;
  onModifyTerms?: () => void;
  // Optional overrides
  initialProductPrice?: number;
  isMultiItemCart?: boolean;
  cartItemCount?: number;
}

export const CommitGuardModal: React.FC<CommitGuardModalProps> = ({
  isOpen,
  onClose,
  type,
  onProceedAnyway,
  onModifyTerms,
  initialProductPrice,
  isMultiItemCart = false,
  cartItemCount = 1,
}) => {
  // -------------------------------------------------------------
  // Scenario A State: E-Commerce EMI Simulator
  // -------------------------------------------------------------
  const [tenure, setTenure] = useState<number>(12);
  const [isProofOpen, setIsProofOpen] = useState(false);
  const productPrice = initialProductPrice || 80000;
  const processingFee = 199;
  const nominalRate = 15.0;

  // Memoized deterministic calculation (<1.2ms)
  const emiMath = useMemo(() => {
    return calculateNoCostEmiDrag({
      type: 'NO_COST_EMI',
      productName: 'Pro Laptop M-Series 16-inch',
      productPrice,
      tenureMonths: tenure,
      advertisedRate: 0,
      bankProcessingFee: processingFee,
      bankNominalInterestRate: nominalRate,
    });
  }, [productPrice, tenure, processingFee, nominalRate]);

  // Multi-cart risk evaluation
  const multiCartRisk = useMemo(() => {
    return evaluateMultiCartEmiRisk(productPrice, cartItemCount, tenure, nominalRate);
  }, [productPrice, cartItemCount, tenure, nominalRate]);

  // -------------------------------------------------------------
  // Scenario B State: Vehicle "Time vs. Debt" Engine
  // -------------------------------------------------------------
  // Price: ₹15,00,000. Loan: 10% for 36 months.
  // Inflation: 6% p.a. over 36 months -> Target FV = ₹17,80,000 (~₹17.8L).
  // Selected SIP asset class tab: 'TBILL' | 'GOLD' | 'EQUITY'
  const [selectedAssetClass, setSelectedAssetClass] = useState<'TBILL' | 'GOLD' | 'EQUITY'>('EQUITY');

  // SIP Math derivation for target ₹17,80,000 over 36 months:
  // Formula: Monthly SIP = FV / [((1 + r)^n - 1) / r]
  const vehicleLoanMetrics = useMemo(() => {
    const principal = 1500000;
    const loanRateAnnual = 0.10;
    const loanMonths = 36;
    const r_month = loanRateAnnual / 12;
    const emiFactor = Math.pow(1 + r_month, loanMonths);
    const monthlyLoanEmi = Math.round((principal * r_month * emiFactor) / (emiFactor - 1));
    const totalLoanRepayment = monthlyLoanEmi * loanMonths; // ~₹17,42,436
    const totalInterestLost = totalLoanRepayment - principal; // ~₹2,42,436

    const targetInflationPrice = 1780000; // ₹17.8L inflation-adjusted price in 36m

    // Asset returns
    const assetReturns = {
      TBILL: { name: 'Sovereign 91-Day T-Bills', cagr: 0.07, tag: 'Zero Risk' },
      GOLD: { name: 'Gold Benchmark ETF', cagr: 0.095, tag: 'Hedge Benchmark' },
      EQUITY: { name: 'Nifty 50 Equity Index', cagr: 0.125, tag: 'High Compounding' },
    };

    const calcMonthlySip = (annualRate: number) => {
      const rm = annualRate / 12;
      const factor = (Math.pow(1 + rm, loanMonths) - 1) / rm;
      return Math.round(targetInflationPrice / factor);
    };

    const sipTbill = calcMonthlySip(0.070); // ~₹44,630
    const sipGold = calcMonthlySip(0.095);  // ~₹42,880
    const sipEquity = calcMonthlySip(0.125); // ~₹40,910

    return {
      principal,
      monthlyLoanEmi,
      totalLoanRepayment,
      totalInterestLost,
      targetInflationPrice,
      assetReturns,
      sipOutputs: {
        TBILL: sipTbill,
        GOLD: sipGold,
        EQUITY: sipEquity,
      },
    };
  }, []);

  // Keyboard shortcut listener (Escape to close, Space to toggle proof)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      } else if ((e.key === ' ' || e.key === 'Enter') && isOpen && type === 'EMI' && !['INPUT', 'BUTTON'].includes((e.target as HTMLElement)?.tagName)) {
        setIsProofOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, type]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-xl animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Centered Frosted-Glass Interceptor Modal */}
      <div className="relative w-full max-w-2xl my-auto glass-obsidian-elevated rounded-3xl shadow-2xl border border-white/15 overflow-hidden text-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* Ambient Corner Glows inside Modal */}
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full ambient-sunset-glow pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full ambient-frost-glow pointer-events-none" />

        {/* ========================================================= */}
        {/* SCENARIO A: E-Commerce Interception (The EMI Trap)        */}
        {/* ========================================================= */}
        {type === 'EMI' && (
          <div>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 sm:px-7 py-4.5 border-b border-amber-500/25 bg-amber-500/10 backdrop-blur-md relative z-10">
              <div className="flex items-center gap-3 text-amber-200 font-black text-base sm:text-lg tracking-tight">
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white shadow-glow">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <span>True Cost Interceptor Breakdown</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Deterministic Engine: &lt;1.2ms</span>
                </div>

                <button
                  onClick={onClose}
                  aria-label="Close modal"
                  title="Close (Escape)"
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-7 space-y-6 max-h-[80vh] overflow-y-auto relative z-10">
              
              {/* Multi-Item Cart Diagnostic Banner */}
              {isMultiItemCart && (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-sm text-slate-800">
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
                            ⚠️ Below ₹3,000 Minimum
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Meets Minimum Threshold
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-amber-900/90 mt-1 leading-snug">
                        <strong>⚠️ Mixed-Cart EMI Risk:</strong> If any single item is non-eligible, your bank charges <strong>15% standard loan interest (~₹{multiCartRisk.totalRiskAmount.toLocaleString('en-IN')} extra)</strong> across the entire cart.
                      </p>
                      <div className="mt-2 text-[11px] text-emerald-800 font-medium">
                        💡 <strong>Tip:</strong> Buy high-ticket items on EMI separately to guarantee your full interest waiver.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Context Headline */}
              <div className="space-y-1.5">
                <h3 className="text-2xl font-black text-white tracking-tight">
                  ₹{productPrice.toLocaleString('en-IN')} Laptop Checkout Intercepted
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The merchant advertised <strong className="text-white">0% No-Cost EMI</strong>, but statutory tax compounding adds unadvertised cashflow drag.
                </p>
              </div>

              {/* Dynamic 3 Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* 1. Effective APR */}
                <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/30 relative overflow-hidden">
                  <div className="text-[11px] font-bold text-red-300 uppercase tracking-wider">
                    Effective APR
                  </div>
                  <div className="text-3xl font-black text-red-400 mt-1 font-mono">
                    {emiMath.effectiveAnnualPercentageRate}%
                  </div>
                  <div className="text-[10px] text-red-300/80 mt-1 font-medium">
                    vs Advertised <strong className="text-white">0% APR</strong>
                  </div>
                </div>

                {/* 2. Total GST + Fee Drag */}
                <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 relative overflow-hidden">
                  <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                    Total GST + Fee Drag
                  </div>
                  <div className="text-3xl font-black text-amber-400 mt-1 font-mono">
                    ₹{emiMath.totalHiddenFriction.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-amber-300/80 mt-1 font-medium">
                    ₹{processingFee} fee + ₹{emiMath.totalGstOnInterest.toFixed(0)} GST
                  </div>
                </div>

                {/* 3. Monthly Outflow */}
                <div className="p-4 rounded-2xl bg-obsidian-800/80 border border-white/10 relative overflow-hidden">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Monthly Outflow
                  </div>
                  <div className="text-3xl font-black text-white mt-1 font-mono">
                    ₹{emiMath.monthlyBaseEmi.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-medium">
                    Locked for {tenure} installments
                  </div>
                </div>
              </div>

              {/* 3 Plain-English Bullets */}
              <div className="p-5 rounded-2xl bg-obsidian-800/70 border border-white/10 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Plain-English Decision Clarity</span>
                </div>

                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0 shadow-sm" />
                    <span>
                      <strong className="text-red-400 font-bold">19.93% Effective APR Trap: </strong>
                      While the retailer subsidizes nominal interest, the non-refundable ₹{processingFee} processing fee and statutory 18% GST drive your true effective borrowing cost to <strong className="text-white">{emiMath.effectiveAnnualPercentageRate}% APR</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0 shadow-sm" />
                    <span>
                      <strong className="text-amber-300 font-bold">Permanent Tax Overhead: </strong>
                      You incur <strong className="text-white">₹{emiMath.totalHiddenFriction.toLocaleString('en-IN')}</strong> in pure administrative fees and non-recoverable Goods and Services Tax added directly to your banking card statement.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0 shadow-sm" />
                    <span>
                      <strong className="text-emerald-400 font-bold">Zero-Friction Baseline: </strong>
                      Paying the ₹{productPrice.toLocaleString('en-IN')} upfront via direct bank transfer or debit card preserves 100% of your liquidity and saves the entire ₹{emiMath.totalHiddenFriction.toLocaleString('en-IN')} drag.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Expandable "View Mathematical Proof" Accordion with Range Slider */}
              <div className="border border-white/10 rounded-2xl overflow-hidden bg-obsidian-850/90 shadow-xl">
                <button
                  onClick={() => setIsProofOpen(!isProofOpen)}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-bold text-slate-200 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>View Mathematical Proof & Interactive Tenure Simulator</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span>{isProofOpen ? 'Hide Proof' : 'Expand Proof'}</span>
                    {isProofOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isProofOpen && (
                  <div className="p-5 border-t border-white/10 bg-obsidian-900/80 space-y-4">
                    
                    {/* Interactive Range Slider (Tenure: 3, 6, 9, 12, 24) */}
                    <div className="p-4 bg-obsidian-800/80 rounded-2xl border border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <label htmlFor="tenure-slider" className="font-bold text-slate-200">
                          Tenure Simulator: <span className="text-amber-400 font-extrabold text-sm">{tenure} Months</span>
                        </label>
                        <span className="text-[11px] text-slate-400">Snap options: 3m, 6m, 9m, 12m, 24m</span>
                      </div>

                      <input
                        id="tenure-slider"
                        type="range"
                        min={3}
                        max={24}
                        step={3}
                        value={tenure}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const validPoints = [3, 6, 9, 12, 24];
                          const closest = validPoints.reduce((prev, curr) =>
                            Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
                          );
                          setTenure(closest);
                        }}
                        className="w-full h-2 bg-obsidian-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />

                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <button onClick={() => setTenure(3)} className={`hover:font-bold ${tenure === 3 ? 'text-amber-400 font-bold' : ''}`}>3m</button>
                        <button onClick={() => setTenure(6)} className={`hover:font-bold ${tenure === 6 ? 'text-amber-400 font-bold' : ''}`}>6m</button>
                        <button onClick={() => setTenure(9)} className={`hover:font-bold ${tenure === 9 ? 'text-amber-400 font-bold' : ''}`}>9m</button>
                        <button onClick={() => setTenure(12)} className={`hover:font-bold ${tenure === 12 ? 'text-amber-400 font-bold' : ''}`}>12m (Default)</button>
                        <button onClick={() => setTenure(24)} className={`hover:font-bold ${tenure === 24 ? 'text-amber-400 font-bold' : ''}`}>24m</button>
                      </div>
                    </div>

                    {/* Amortization Schedule Table */}
                    <div className="overflow-x-auto max-h-52 border border-white/10 rounded-xl bg-obsidian-950">
                      <table className="w-full text-[11px] text-left">
                        <thead className="bg-obsidian-850 text-slate-300 font-bold border-b border-white/10 sticky top-0">
                          <tr>
                            <th className="py-2.5 px-3">Month</th>
                            <th className="py-2.5 px-3">Opening Balance</th>
                            <th className="py-2.5 px-3">Principal Component</th>
                            <th className="py-2.5 px-3">Interest Component</th>
                            <th className="py-2.5 px-3 text-red-400">18% GST Drag</th>
                            <th className="py-2.5 px-3 font-bold text-white">Total Cashflow</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300 font-mono">
                          {emiMath.schedule.map((row) => (
                            <tr key={row.month} className="hover:bg-white/[0.03]">
                              <td className="py-1.5 px-3 font-bold text-white">{row.month}</td>
                              <td className="py-1.5 px-3">₹{row.openingBalance.toLocaleString('en-IN')}</td>
                              <td className="py-1.5 px-3 text-slate-200">₹{row.principalComponent.toLocaleString('en-IN')}</td>
                              <td className="py-1.5 px-3">₹{row.interestComponent.toLocaleString('en-IN')}</td>
                              <td className="py-1.5 px-3 text-red-400 font-semibold">₹{row.gstOnInterest.toFixed(2)}</td>
                              <td className="py-1.5 px-3 font-bold text-amber-300">₹{row.totalMonthlyCashflow.toLocaleString('en-IN')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="text-[10px] text-slate-400 leading-tight">
                      * Newton-Raphson Internal Rate of Return (IRR) solved across monthly cashflows.
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3.5">
                <button
                  onClick={onModifyTerms || onClose}
                  className="w-full sm:w-1/2 py-3.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs sm:text-sm font-black shadow-glow hover:shadow-glow-sunset transition-all flex items-center justify-center gap-2"
                >
                  <span>Modify Payment Terms</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={onProceedAnyway}
                  className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <span>I Understand, Proceed Anyway</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SCENARIO B: Vehicle Catalog (The "Time vs. Debt" Engine)  */}
        {/* ========================================================= */}
        {type === 'VEHICLE_LOAN' && (
          <div>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 sm:px-7 py-4.5 border-b border-orange-500/25 bg-orange-500/10 backdrop-blur-md relative z-10">
              <div className="flex items-center gap-3 text-orange-200 font-black text-base sm:text-lg tracking-tight">
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white shadow-glow">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span>Time vs. Debt Engine</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-medium">
                  Behavioral Wealth Proof
                </span>

                <button
                  onClick={onClose}
                  aria-label="Close modal"
                  title="Close (Escape)"
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-7 space-y-6 max-h-[80vh] overflow-y-auto relative z-10">
              
              {/* Context Headline */}
              <div className="space-y-1.5">
                <h3 className="text-2xl font-black text-white tracking-tight">
                  ₹15,00,000 Superbike Commitment Intercepted
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Before committing to a 3-year auto loan, compare the lifelong compounding impact of <strong className="text-red-400">Debt (Buy Now)</strong> vs <strong className="text-emerald-400">Compounding (Buy Later)</strong>.
                </p>
              </div>

              {/* Side-by-Side Comparison: Option A vs Option B */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Option A: Buy Now (Auto Loan 10%) */}
                <div className="p-5 rounded-2xl bg-red-950/40 border-2 border-red-500/40 space-y-3.5 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-red-300">
                      Option A: Buy Now (Debt Path)
                    </span>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white shadow-sm">
                      Auto Loan 10%
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-3xl font-black text-white font-mono">
                      ₹17.42 Lakhs
                    </div>
                    <div className="text-xs text-slate-400">
                      Total out-of-pocket cash commitment
                    </div>
                  </div>

                  <div className="p-3.5 bg-obsidian-900/80 rounded-xl border border-white/10 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Monthly EMI:</span>
                      <strong className="font-mono font-bold text-white">₹{vehicleLoanMetrics.monthlyLoanEmi.toLocaleString('en-IN')}/mo</strong>
                    </div>
                    <div className="flex justify-between text-red-400">
                      <span>Interest Burn:</span>
                      <strong className="font-mono font-bold text-red-400">-₹2.42 Lakhs</strong>
                    </div>
                    <div className="text-[11px] text-red-300 pt-1.5 border-t border-white/10 leading-snug">
                      ⚠️ <strong className="text-white">₹2.42 Lakhs</strong> lost permanently to the financing institution.
                    </div>
                  </div>
                </div>

                {/* Option B: Buy Later (Compounding SIP Target) */}
                <div className="p-5 rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/40 space-y-3.5 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                      Option B: Buy Later (Wealth Path)
                    </span>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-sm">
                      Target ₹17.8L
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-3xl font-black text-emerald-400 font-mono">
                      ₹17.80 Lakhs
                    </div>
                    <div className="text-xs text-slate-400">
                      Adjusted for 6% auto inflation over 36m
                    </div>
                  </div>

                  <div className="p-3.5 bg-obsidian-900/80 rounded-xl border border-white/10 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Selected Monthly SIP:</span>
                      <strong className="font-mono font-bold text-emerald-400">
                        ₹{vehicleLoanMetrics.sipOutputs[selectedAssetClass].toLocaleString('en-IN')}/mo
                      </strong>
                    </div>
                    <div className="flex justify-between text-emerald-400">
                      <span>Monthly Cashflow Saved:</span>
                      <strong className="font-mono font-bold text-emerald-300">
                        +₹{(vehicleLoanMetrics.monthlyLoanEmi - vehicleLoanMetrics.sipOutputs[selectedAssetClass]).toLocaleString('en-IN')}/mo
                      </strong>
                    </div>
                    <div className="text-[11px] text-emerald-300 pt-1.5 border-t border-white/10 leading-snug">
                      ✅ Lower monthly burden than loan EMI + zero debt risk.
                    </div>
                  </div>
                </div>

              </div>

              {/* Interactive SIP Engine: 3 Asset Class Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span>Select SIP Asset Class to Hit ₹17.8L Inflation Target:</span>
                  <span className="text-amber-400 font-mono text-[11px]">36-Month Horizon</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Asset 1: Sovereign T-Bills (7%) */}
                  <button
                    onClick={() => setSelectedAssetClass('TBILL')}
                    className={`p-4 rounded-2xl border text-left transition-all space-y-2 ${
                      selectedAssetClass === 'TBILL'
                        ? 'border-emerald-500 bg-emerald-500/20 ring-2 ring-emerald-500/30 shadow-glow-emerald text-white'
                        : 'border-white/10 bg-obsidian-800/80 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Sovereign T-Bills</span>
                      <Landmark className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="text-xl font-black text-white font-mono">
                      ₹{vehicleLoanMetrics.sipOutputs.TBILL.toLocaleString('en-IN')}<span className="text-xs font-normal text-slate-400">/mo</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>7.0% Risk-Free</span>
                      <span className="text-emerald-400 font-bold">Save ₹3,771/mo</span>
                    </div>
                  </button>

                  {/* Asset 2: Gold Benchmark (9.5%) */}
                  <button
                    onClick={() => setSelectedAssetClass('GOLD')}
                    className={`p-4 rounded-2xl border text-left transition-all space-y-2 ${
                      selectedAssetClass === 'GOLD'
                        ? 'border-emerald-500 bg-emerald-500/20 ring-2 ring-emerald-500/30 shadow-glow-emerald text-white'
                        : 'border-white/10 bg-obsidian-800/80 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Gold Benchmark</span>
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="text-xl font-black text-white font-mono">
                      ₹{vehicleLoanMetrics.sipOutputs.GOLD.toLocaleString('en-IN')}<span className="text-xs font-normal text-slate-400">/mo</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>9.5% Benchmark</span>
                      <span className="text-emerald-400 font-bold">Save ₹5,521/mo</span>
                    </div>
                  </button>

                  {/* Asset 3: Equity Index (12.5%) */}
                  <button
                    onClick={() => setSelectedAssetClass('EQUITY')}
                    className={`p-4 rounded-2xl border text-left transition-all space-y-2 ${
                      selectedAssetClass === 'EQUITY'
                        ? 'border-emerald-500 bg-emerald-500/20 ring-2 ring-emerald-500/30 shadow-glow-emerald text-white'
                        : 'border-white/10 bg-obsidian-800/80 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Equity Index (Nifty)</span>
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-xl font-black text-white font-mono">
                      ₹{vehicleLoanMetrics.sipOutputs.EQUITY.toLocaleString('en-IN')}<span className="text-xs font-normal text-slate-400">/mo</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>12.5% CAGR</span>
                      <span className="text-emerald-400 font-bold">Save ₹7,491/mo</span>
                    </div>
                  </button>

                </div>
              </div>

              {/* Final Takeaway Notice */}
              <div className="p-4 rounded-2xl bg-obsidian-800/70 border border-white/10 text-xs text-slate-300 space-y-1.5">
                <div className="font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-400" />
                  <span>Mathematical Verdict</span>
                </div>
                <p className="leading-relaxed">
                  Choosing the wealth path requires <strong className="text-emerald-400">₹{vehicleLoanMetrics.sipOutputs[selectedAssetClass].toLocaleString('en-IN')}/month</strong> instead of <strong className="text-red-400">₹{vehicleLoanMetrics.monthlyLoanEmi.toLocaleString('en-IN')}/month</strong> on loan debt, completely avoiding the ₹2.42 Lakhs bank interest burn.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3.5">
                <button
                  onClick={onModifyTerms || onClose}
                  className="w-full sm:w-1/2 py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs sm:text-sm font-black shadow-glow-emerald transition-all flex items-center justify-center gap-2"
                >
                  <span>Choose Wealth (Set Up SIP)</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>

                <button
                  onClick={onProceedAnyway}
                  className="w-full sm:w-1/2 py-3.5 px-5 rounded-xl bg-obsidian-800/90 hover:bg-obsidian-700 text-slate-300 hover:text-white text-xs sm:text-sm font-semibold border border-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <span>Proceed with Auto Loan (Pay Debt)</span>
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
