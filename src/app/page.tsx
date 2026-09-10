'use client';

import React, { useState } from 'react';
import {
  ShoppingBag,
  CreditCard,
  Truck,
  ShieldCheck,
  Lock,
  Laptop,
  CheckCircle2,
  Bike,
  Compass,
  RotateCcw,
} from 'lucide-react';
import { CommitGuardModal, InterceptorType } from '@/components/CommitGuardModal';
import { VehicleCatalogPage } from '@/components/VehicleCatalogPage';
import { NeutralDirectory } from '@/components/NeutralDirectory';
import { DemoController } from '@/components/DemoController';

type ActiveTab = 'TAB_ECOMMERCE' | 'TAB_VEHICLE' | 'TAB_DIRECTORY';

export default function HackathonJudgeWrapper() {
  // Scenario Switcher State
  const [activeTab, setActiveTab] = useState<ActiveTab>('TAB_ECOMMERCE');

  // Interceptor Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<InterceptorType>('EMI');

  // Transaction Authorization States
  const [isEcomOrderPlaced, setIsEcomOrderPlaced] = useState(false);
  const [isVehicleLoanAuthorized, setIsVehicleLoanAuthorized] = useState(false);

  // E-Commerce purchase details
  const ecomPrice = 80000;

  // Triggers
  const handleTriggerEcom = () => {
    setModalType('EMI');
    setIsModalOpen(true);
  };

  const handleTriggerVehicle = () => {
    setModalType('VEHICLE_LOAN');
    setIsModalOpen(true);
  };

  // Reset Hackathon Demo loop
  const handleResetDemo = () => {
    setIsModalOpen(false);
    setIsEcomOrderPlaced(false);
    setIsVehicleLoanAuthorized(false);
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col justify-between py-5 sm:py-7 px-4 sm:px-6 lg:px-8 relative selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Ambient Atmospheric Lighting Elements */}
      <div className="fixed -top-28 -right-28 w-[500px] h-[500px] rounded-full ambient-sunset-glow -z-10" />
      <div className="fixed -bottom-28 -left-28 w-[500px] h-[500px] rounded-full ambient-frost-glow -z-10" />

      {/* Persistent Top Navigation Bar: The Judge's Scenario Switcher */}
      <header className="max-w-6xl mx-auto w-full pb-6 border-b border-white/10 space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white flex items-center justify-center font-black tracking-tight text-lg shadow-glow border border-amber-300/30">
              CG
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-xl text-white tracking-tight">CommitGuard</span>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                  Embedded Pre-Commitment Interceptor
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Track 3: Payments & Embedded Finance • Finance Where the Decision Happens
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 bg-obsidian-850/80 px-3.5 py-1.5 rounded-full border border-white/10 shadow-sm backdrop-blur-md">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono text-[11px] text-slate-300">Point-of-Sale Non-Financial DOM Simulation</span>
          </div>
        </div>

        {/* 3 Distinct Navigation Tabs */}
        <nav aria-label="Scenario Tabs" className="grid grid-cols-3 gap-2 bg-obsidian-850/90 border border-white/10 p-1.5 rounded-2xl backdrop-blur-xl shadow-2xl">
          {/* Tab 1: E-Commerce EMI Checkout */}
          <button
            id="tab-ecommerce"
            onClick={() => {
              setActiveTab('TAB_ECOMMERCE');
              setIsModalOpen(false);
            }}
            className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'TAB_ECOMMERCE'
                ? 'bg-gradient-to-r from-amber-500/25 via-orange-500/15 to-transparent text-white shadow-glow border border-amber-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <ShoppingBag className={`w-4 h-4 ${activeTab === 'TAB_ECOMMERCE' ? 'text-amber-400' : 'text-slate-400'}`} />
            <span>1. E-Commerce EMI</span>
          </button>

          {/* Tab 2: Vehicle Catalog (Loan vs. SIP) */}
          <button
            id="tab-vehicle"
            onClick={() => {
              setActiveTab('TAB_VEHICLE');
              setIsModalOpen(false);
            }}
            className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'TAB_VEHICLE'
                ? 'bg-gradient-to-r from-amber-500/25 via-orange-500/15 to-transparent text-white shadow-glow border border-amber-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Bike className={`w-4 h-4 ${activeTab === 'TAB_VEHICLE' ? 'text-amber-400' : 'text-slate-400'}`} />
            <span>2. Vehicle Catalog (Loan vs SIP)</span>
          </button>

          {/* Tab 3: Neutral Reference Directory */}
          <button
            id="tab-directory"
            onClick={() => {
              setActiveTab('TAB_DIRECTORY');
              setIsModalOpen(false);
            }}
            className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'TAB_DIRECTORY'
                ? 'bg-gradient-to-r from-amber-500/25 via-orange-500/15 to-transparent text-white shadow-glow border border-amber-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Compass className={`w-4 h-4 ${activeTab === 'TAB_DIRECTORY' ? 'text-amber-400' : 'text-slate-400'}`} />
            <span>3. Neutral Directory</span>
          </button>
        </nav>

      </header>

      {/* Main Viewport Content Area */}
      <main className="max-w-6xl mx-auto w-full py-6 sm:py-8 flex-1">
        
        {/* ==================================================================== */}
        {/* SCENARIO A: E-Commerce EMI Checkout (The EMI Trap)                   */}
        {/* ==================================================================== */}
        {activeTab === 'TAB_ECOMMERCE' && (
          <div className="space-y-6">
            {isEcomOrderPlaced ? (
              <div className="max-w-xl mx-auto p-8 rounded-3xl glass-obsidian border border-emerald-500/30 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-glow-emerald">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-white">
                  Payment Authorized with Decision Clarity
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Order <strong className="text-white">#ORD-892410</strong> for <strong className="text-amber-400">₹80,000.00</strong> was authorized after the user understood the true <strong className="text-amber-400">19.93% Effective APR</strong>, ₹199 processing fee, and 18% statutory GST overhead.
                </p>
                <button
                  onClick={handleResetDemo}
                  className="mt-3 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs sm:text-sm font-bold shadow-glow hover:shadow-glow-sunset transition-all"
                >
                  Reset & Test Again
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Panel: Shopping Cart (₹80,000 Laptop) - 7 Columns */}
                <section aria-label="Shopping Cart" className="lg:col-span-7 space-y-5">
                  <div className="glass-obsidian rounded-3xl p-6 sm:p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <div className="flex items-center gap-2 font-bold text-white text-base">
                        <ShoppingBag className="w-5 h-5 text-amber-400" />
                        <span>Review Shopping Bag (1 Item)</span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-500/30">
                        Ready to Dispatch
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                      <div className="w-24 h-24 rounded-2xl bg-obsidian-800/90 border border-white/10 flex items-center justify-center shrink-0 shadow-inner text-amber-400">
                        <Laptop className="w-12 h-12" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-black text-xl text-white tracking-tight">
                            ProBook 16-inch M-Series Laptop
                          </h3>
                          <div className="text-right">
                            <div className="text-2xl font-black text-white font-mono">₹80,000.00</div>
                            <div className="text-xs text-slate-500 line-through font-mono">₹89,990.00</div>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Space Gray • 32GB Unified Memory • 1TB Superfast SSD • Liquid Retina XDR
                        </p>
                        <div className="flex items-center gap-3 pt-1 text-xs text-slate-400 font-medium">
                          <span>Qty: 1</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold">Free Express Shipping</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-obsidian-800/60 border border-white/5">
                        <Truck className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Delivers Tomorrow to Bangalore 560001</span>
                      </div>
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-obsidian-800/60 border border-white/5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>1-Year Comprehensive Warranty</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Right Panel: Hardcoded 0% No-Cost EMI & Place Order & Pay Button - 5 Columns */}
                <section aria-label="Payment Selection" className="lg:col-span-5 space-y-5">
                  <div className="glass-obsidian rounded-3xl p-6 sm:p-8 space-y-6">
                    <div>
                      <h3 className="font-black text-lg text-white tracking-tight">
                        Payment Selection
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Selected payment method intercepted for financial impact verification
                      </p>
                    </div>

                    {/* Hardcoded Selected Payment Method */}
                    <div className="glass-obsidian-sunset rounded-2xl p-5 border-2 border-amber-500/60 shadow-glow space-y-3.5 relative overflow-hidden">
                      <div className="absolute -top-12 -right-12 w-28 h-28 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
                      
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="payment_choice"
                            id="payment_nocost_emi_hardcoded"
                            checked={true}
                            readOnly
                            className="w-4 h-4 mt-1 text-amber-500 focus:ring-amber-400 accent-amber-500"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <label
                                htmlFor="payment_nocost_emi_hardcoded"
                                className="font-extrabold text-sm text-white cursor-pointer"
                              >
                                0% No-Cost EMI (12 Months)
                              </label>
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-gradient-to-r from-amber-500 to-orange-600 text-white uppercase tracking-wider shadow-sm">
                                Advertised 0%
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-1">
                              HDFC Bank Credit Card • <span className="font-mono text-amber-300 font-bold">₹6,667 / month</span>
                            </p>
                          </div>
                        </div>
                        <CreditCard className="w-5 h-5 text-amber-400 shrink-0" />
                      </div>

                      <div className="pt-2.5 border-t border-amber-500/20 flex items-center justify-between text-[11px] text-amber-200">
                        <span>Upfront Merchant Interest Subsidy:</span>
                        <strong className="font-mono font-bold text-amber-400">-₹6,400.00</strong>
                      </div>
                    </div>

                    {/* Order Summary */}
                    <div className="space-y-3 pt-2 border-t border-white/10 text-xs">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Product Subtotal</span>
                        <span className="font-mono font-semibold text-white">₹80,000.00</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Estimated Shipping</span>
                        <span className="font-bold text-emerald-400">FREE</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Advertised Interest</span>
                        <span className="font-mono font-semibold text-emerald-400">₹0.00 (0% EMI)</span>
                      </div>
                      
                      <div className="pt-3 border-t border-white/10 flex items-baseline justify-between">
                        <span className="text-sm font-bold text-slate-200">Order Total</span>
                        <span className="text-2xl font-black text-white font-mono">₹80,000.00</span>
                      </div>
                    </div>

                    {/* Prominent Action Button: Place Order & Pay */}
                    <button
                      id="btn-place-order-pay"
                      onClick={handleTriggerEcom}
                      className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white text-sm font-black shadow-glow hover:shadow-glow-sunset transition-all flex items-center justify-center gap-2.5 group active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <Lock className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                      <span>Place Order & Pay</span>
                    </button>

                    <div className="text-center text-[10px] text-slate-400">
                      Halts checkout instantly to compute deterministic Effective APR and statutory GST.
                    </div>
                  </div>
                </section>

              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* SCENARIO B: Vehicle Catalog (The "Time vs. Debt" Engine)             */}
        {/* ==================================================================== */}
        {activeTab === 'TAB_VEHICLE' && (
          <VehicleCatalogPage
            onCalculateLoan={handleTriggerVehicle}
            isLoanAuthorized={isVehicleLoanAuthorized}
            onReset={handleResetDemo}
          />
        )}

        {/* ==================================================================== */}
        {/* SCENARIO C: Neutral Reference Directory                             */}
        {/* ==================================================================== */}
        {activeTab === 'TAB_DIRECTORY' && (
          <NeutralDirectory />
        )}

      </main>

      {/* Unified CommitGuard Interceptor Modal */}
      <CommitGuardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        type={modalType}
        initialProductPrice={modalType === 'EMI' ? ecomPrice : 1500000}
        onProceedAnyway={() => {
          setIsModalOpen(false);
          if (modalType === 'EMI') setIsEcomOrderPlaced(true);
          if (modalType === 'VEHICLE_LOAN') setIsVehicleLoanAuthorized(true);
        }}
        onModifyTerms={() => setIsModalOpen(false)}
      />

      {/* Persistent Floating Demo Controller (Bottom Right) */}
      <DemoController
        onReset={handleResetDemo}
        isInterceptionActive={isModalOpen}
      />

    </div>
  );
}
