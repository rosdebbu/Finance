'use client';

import React from 'react';
import {
  ShieldCheck,
  Bike,
  Gauge,
  Zap,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingUp,
  Fuel,
  Award,
} from 'lucide-react';

interface VehicleCatalogPageProps {
  onCalculateLoan: () => void;
  isLoanAuthorized: boolean;
  onReset: () => void;
}

export const VehicleCatalogPage: React.FC<VehicleCatalogPageProps> = ({
  onCalculateLoan,
  isLoanAuthorized,
  onReset,
}) => {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in duration-200">
      
      {/* Vehicle Product Presentation Hero */}
      <div className="glass-obsidian rounded-3xl p-6 sm:p-10 border border-white/10 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left Column: Visual Mock & Badge (6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative rounded-2xl bg-gradient-to-br from-obsidian-950 via-obsidian-900 to-obsidian-950 p-8 text-white aspect-[4/3] flex flex-col justify-between overflow-hidden shadow-2xl border border-white/10">
            
            {/* Top Badges */}
            <div className="flex items-center justify-between z-10">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[11px] font-black tracking-wider uppercase shadow-glow">
                HyperSport 2026 Edition
              </span>
              <span className="text-xs text-slate-300 font-mono flex items-center gap-1.5 bg-obsidian-850/80 px-2.5 py-1 rounded-full border border-white/10">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Verified Dealership
              </span>
            </div>

            {/* Center Vehicle Emblem / Graphic */}
            <div className="my-auto flex flex-col items-center justify-center space-y-2 z-10">
              <div className="w-24 h-24 rounded-full bg-obsidian-800/90 backdrop-blur-md border border-white/15 flex items-center justify-center text-amber-400 shadow-2xl">
                <Bike className="w-14 h-14" />
              </div>
              <div className="text-center">
                <div className="text-xl font-black text-white tracking-tight">Panigale V4 R Superbike</div>
                <div className="text-xs text-slate-400 font-mono">998cc Desmosedici Stradale • 218 HP</div>
              </div>
            </div>

            {/* Spec Ribbon */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10 text-center z-10">
              <div>
                <div className="text-xs font-bold text-amber-400 font-mono">2.8s</div>
                <div className="text-[10px] text-slate-400">0-100 km/h</div>
              </div>
              <div>
                <div className="text-xs font-bold text-amber-400 font-mono">315 km/h</div>
                <div className="text-[10px] text-slate-400">Top Speed</div>
              </div>
              <div>
                <div className="text-xs font-bold text-amber-400 font-mono">167 kg</div>
                <div className="text-[10px] text-slate-400">Dry Weight</div>
              </div>
            </div>

            {/* Background Sunset Glow */}
            <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="flex items-center gap-1">
              <Award className="w-4 h-4 text-amber-400" />
              Euro 5+ Homologated
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Fuel className="w-4 h-4 text-amber-400" />
              16L Carbon Fuel Cell
            </span>
            <span>•</span>
            <span className="text-emerald-400 font-medium">Zero Odometer</span>
          </div>
        </div>

        {/* Right Column: Pricing & Financing Action (6 Cols) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider">
              <span>Apex Performance Series</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Apex V4 R Carbon Superbike
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Factory racing setup with titanium Akrapovič exhaust, dry slipper clutch, and forged Marchesini magnesium wheels.
            </p>
          </div>

          {/* Pricing Box */}
          <div className="p-6 rounded-2xl glass-obsidian-sunset border border-amber-500/30 space-y-4 shadow-glow">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">Ex-Showroom Price</span>
                <div className="text-3xl sm:text-4xl font-black text-white font-mono">
                  ₹15,00,000.00
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                Financing Available
              </span>
            </div>

            <div className="pt-3 border-t border-white/10 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400">Advertised Loan Rate:</span>
                <div className="font-bold text-amber-400 font-mono">10.0% Flat APR</div>
              </div>
              <div>
                <span className="text-slate-400">Standard Tenure:</span>
                <div className="font-bold text-white">36 Months (3 Years)</div>
              </div>
            </div>
          </div>

          {/* Point-of-Sale Hook Notice */}
          <div className="p-4 rounded-xl bg-obsidian-800/80 border border-white/10 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-white">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span>CommitGuard Behavioral "Time vs. Debt" Hook</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Clicking below halts the financing flow to compare the total wealth loss of borrowing ₹15L today versus compounding an inflation-adjusted purchase goal.
            </p>
          </div>

          {/* Primary Action Button: "Calculate Auto Loan" */}
          <div className="space-y-2">
            <button
              id="btn-calculate-auto-loan"
              onClick={onCalculateLoan}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white text-sm font-black shadow-glow hover:shadow-glow-sunset transition-all flex items-center justify-center gap-2 group active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <Zap className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
              <span>Calculate Auto Loan & Financing Terms</span>
              <ArrowRight className="w-4 h-4 ml-1 text-white group-hover:translate-x-1 transition-transform" />
            </button>
            <div className="text-center text-[10px] text-slate-400">
              Triggers the CommitGuard Pre-Commitment Interceptor before loan authorization.
            </div>
          </div>

        </div>

      </div>

      {/* Confirmation State if user proceeded */}
      {isLoanAuthorized && (
        <div className="max-w-xl mx-auto p-8 rounded-3xl glass-obsidian border border-emerald-500/30 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-glow-emerald">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-white">
            Vehicle Financing Simulation Reviewed
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            The customer was presented with the full <strong className="text-red-400">₹2.42L Interest Burn</strong> trade-off vs <strong className="text-emerald-400">Sovereign/Equity Compounding</strong> before committing capital.
          </p>
          <button
            onClick={onReset}
            className="mt-3 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs sm:text-sm font-bold shadow-glow hover:shadow-glow-sunset transition-all"
          >
            Reset Vehicle Simulation
          </button>
        </div>
      )}

    </div>
  );
};
