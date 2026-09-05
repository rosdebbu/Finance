/**
 * CommitGuard - Deterministic Financial Engine
 * 100% pure mathematical implementations. Sub-5ms latency. Zero LLM hallucinations.
 * Matching formulas specified in docs/PRD.md & docs/SYSTEM_WORKING_BLUEPRINT.md
 */

import {
  EmiCommitmentInput,
  EmiTradeoffResult,
  MonthlyAmortizationSchedule,
  LockInCommitmentInput,
  LockInTradeoffResult,
  RealYieldResult,
  OpportunityCostResult,
  MultiCartEmiRiskResult,
} from './types';

const GST_RATE = 0.18; // 18% statutory GST

/**
 * 1. Calculate true Effective APR and hidden friction on "No-Cost" EMI
 * Solves monthly IRR using Newton-Raphson method and annualizes to Effective APR.
 */
export function calculateNoCostEmiDrag(input: EmiCommitmentInput): EmiTradeoffResult {
  const price = input.productPrice;
  const n = input.tenureMonths;
  const nominalAnnualRate = input.bankNominalInterestRate / 100;
  const r_monthly = nominalAnnualRate / 12;

  // Step 1: Upfront cash outflow at t=0
  const processingFee = input.bankProcessingFee;
  const gstOnFee = Number((processingFee * GST_RATE).toFixed(2));
  const totalUpfrontOutflow = Number((processingFee + gstOnFee).toFixed(2));

  // Step 2: In retail No-Cost EMI, merchant gives discount equal to nominal interest charged by bank.
  // Standard EMI formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
  // Here merchant discount D makes base EMI * n - D = Product Price, or Bank calculates EMI such that net financed = Price - D.
  // In standard Indian banking No-Cost EMI (Amazon/Flipkart):
  // Financed Principal P_net is discounted so that total monthly EMI sum = Product Price.
  // i.e., monthly EMI = Price / n.
  // P_net = (Price / n) * ((1+r)^n - 1) / (r * (1+r)^n)
  const monthlyBaseEmi = Number((price / n).toFixed(2));
  const factor = Math.pow(1 + r_monthly, n);
  const borrowedPrincipal = Number(((monthlyBaseEmi * (factor - 1)) / (r_monthly * factor)).toFixed(2));
  const merchantDiscount = Number((price - borrowedPrincipal).toFixed(2));

  // Step 3: Compute monthly amortization schedule with 18% GST on interest
  let balance = borrowedPrincipal;
  const schedule: MonthlyAmortizationSchedule[] = [];
  let totalInterest = 0;
  let totalGstOnInterest = 0;

  for (let month = 1; month <= n; month++) {
    const opening = Number(balance.toFixed(2));
    const interest = Number((opening * r_monthly).toFixed(2));
    const principal = Number((monthlyBaseEmi - interest).toFixed(2));
    const gstOnInt = Number((interest * GST_RATE).toFixed(2));
    const totalCashflow = Number((monthlyBaseEmi + gstOnInt).toFixed(2));
    balance = Math.max(0, opening - principal);

    totalInterest += interest;
    totalGstOnInterest += gstOnInt;

    schedule.push({
      month,
      openingBalance: opening,
      principalComponent: principal,
      interestComponent: interest,
      gstOnInterest: gstOnInt,
      totalMonthlyCashflow: totalCashflow,
      closingBalance: Number(balance.toFixed(2)),
    });
  }

  totalInterest = Number(totalInterest.toFixed(2));
  totalGstOnInterest = Number(totalGstOnInterest.toFixed(2));
  const totalTrueCashOutflow = Number((price + totalUpfrontOutflow + totalGstOnInterest).toFixed(2));
  const totalHiddenFriction = Number((totalUpfrontOutflow + totalGstOnInterest).toFixed(2));

  // Step 4: Solve for internal rate of return (IRR) via Newton-Raphson
  // Net financed capital received at t=0: borrowedPrincipal - totalUpfrontOutflow
  // Monthly repayments at t=1..n: schedule[k].totalMonthlyCashflow
  const cashflows: number[] = [-(borrowedPrincipal - totalUpfrontOutflow)];
  for (const s of schedule) {
    cashflows.push(s.totalMonthlyCashflow);
  }

  const monthlyIrr = solveNewtonRaphsonIrr(cashflows, r_monthly);
  // Annualize to Effective APR: ((1 + r_irr)^12 - 1) * 100
  const effectiveApr = Number((((Math.pow(1 + monthlyIrr, 12) - 1) * 100)).toFixed(2));

  return {
    productPrice: price,
    upfrontProcessingFee: processingFee,
    upfrontGstOnFee: gstOnFee,
    totalUpfrontCashOutflow: totalUpfrontOutflow,
    merchantDiscount,
    borrowedPrincipal,
    monthlyBaseEmi,
    totalInterestCharged: totalInterest,
    totalGstOnInterest,
    totalTrueCashOutflow,
    totalHiddenFriction,
    effectiveAnnualPercentageRate: effectiveApr,
    schedule,
  };
}

/**
 * Newton-Raphson solver for Internal Rate of Return (IRR)
 */
function solveNewtonRaphsonIrr(cashflows: number[], initialGuess = 0.01): number {
  let r = initialGuess;
  const maxIterations = 100;
  const tolerance = 1e-7;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;

    for (let t = 0; t < cashflows.length; t++) {
      const discount = Math.pow(1 + r, t);
      npv += cashflows[t] / discount;
      if (t > 0) {
        dnpv -= (t * cashflows[t]) / Math.pow(1 + r, t + 1);
      }
    }

    if (Math.abs(npv) < tolerance) {
      return r;
    }

    if (dnpv === 0) {
      break;
    }

    const nextR = r - npv / dnpv;
    if (Math.abs(nextR - r) < tolerance) {
      return nextR;
    }
    r = nextR;
  }

  return r;
}

/**
 * 2. Lock-In vs. Liquidity & Premature Exit Penalty
 * Evaluates what happens if a Fixed Deposit is broken early vs. keeping funds in a zero-penalty Liquid Fund.
 */
export function calculateLockInVsLiquidity(input: LockInCommitmentInput): LockInTradeoffResult {
  const P = input.principalAmount;
  const contractedMonths = input.contractedTenureMonths;
  const exitMonth = input.completedMonthsBeforeExit;
  const penalty = input.prematurePenaltyRate; // e.g. 1.00%
  const baseCompletedRate = input.applicableCompletedRate; // e.g. 5.50%
  const liquidRate = input.liquidFundRateBenchmark; // e.g. 6.75%

  // Penalized rate on completed tenure
  const penalizedRate = Math.max(0, baseCompletedRate - penalty);

  // FD quarterly compounding payout on premature break
  // Payout = P * (1 + r / 400)^(4 * (t / 12))
  const fdPrematurePayout = Number(
    (P * Math.pow(1 + penalizedRate / 400, (4 * exitMonth) / 12)).toFixed(2)
  );

  // FD maturity if held for full contracted tenure
  const fdMaturityIfHeld = Number(
    (P * Math.pow(1 + input.contractedRate / 400, (4 * contractedMonths) / 12)).toFixed(2)
  );

  // Liquid Fund with daily compounding and zero exit penalty:
  // Payout = P * (1 + r / 36500)^(365 * (t / 12))
  const liquidFundPayout = Number(
    (P * Math.pow(1 + liquidRate / 36500, (365 * exitMonth) / 12)).toFixed(2)
  );

  const netLossVsLiquid = Number((liquidFundPayout - fdPrematurePayout).toFixed(2));
  const isLiquidityTrap = liquidFundPayout > fdPrematurePayout;

  // Sec 194A TDS: 10% TDS if interest earned > 40,000 in fiscal year
  const interestEarned = fdPrematurePayout - P;
  const tdsDeductionAmount = interestEarned > 40000 ? Number((interestEarned * 0.10).toFixed(2)) : 0;

  return {
    principalAmount: P,
    contractedTenureMonths: contractedMonths,
    contractedRate: input.contractedRate,
    prematureExitMonth: exitMonth,
    penalizedRate,
    fdPrematurePayout,
    fdMaturityIfHeld,
    liquidFundPayout,
    netLossVsLiquid,
    isLiquidityTrap,
    tdsDeductionAmount,
  };
}

/**
 * 3. Post-Tax Real Yield Calculator
 * Real Yield = ((1 + Nominal * (1 - TaxSlab)) / (1 + Inflation)) - 1
 */
export function calculatePostTaxRealYield(
  nominalYieldPercent: number,
  taxSlabPercent: number,
  inflationPercent: number
): RealYieldResult {
  const nominal = nominalYieldPercent / 100;
  const tax = taxSlabPercent / 100;
  const inflation = inflationPercent / 100;

  const postTaxNominal = nominal * (1 - tax);
  const realYield = (1 + postTaxNominal) / (1 + inflation) - 1;

  const realYieldPercent = Number((realYield * 100).toFixed(2));
  const postTaxNominalPercent = Number((postTaxNominal * 100).toFixed(2));

  return {
    nominalYield: nominalYieldPercent,
    marginalTaxSlab: taxSlabPercent,
    postTaxNominalRate: postTaxNominalPercent,
    inflationRate: inflationPercent,
    postTaxRealYield: realYieldPercent,
    isNegativeRealReturn: realYieldPercent < 0,
  };
}

/**
 * 4. Sovereign Opportunity Cost Benchmarking
 * Benchmarks return against risk-free 91-Day Sovereign Treasury Bill (6.85%) and RBI Repo Rate (6.50%)
 */
export function calculateOpportunityCost(
  commitmentYieldPercent: number,
  principalAmount: number,
  tenureMonths: number,
  sovereignTBillRate = 6.85,
  rbiRepoRate = 6.50
): OpportunityCostResult {
  const spread = Number((commitmentYieldPercent - sovereignTBillRate).toFixed(2));
  const rupeeCost = Number((principalAmount * (spread / 100) * (tenureMonths / 12)).toFixed(2));

  return {
    commitmentYield: commitmentYieldPercent,
    sovereignTBillRate,
    rbiRepoRate,
    yieldSpreadVsSovereign: spread,
    rupeeOpportunityCost: rupeeCost,
  };
}

/**
 * 5. Multi-Item Cart EMI Risk & Disqualification Evaluator
 * Evaluates whether multi-item cart purchases meet platform minimum thresholds (₹3,000)
 * and calculates potential standard interest leakage if mixed eligibility voids No-Cost EMI.
 */
export function evaluateMultiCartEmiRisk(
  totalCartValue: number,
  itemCount: number = 1,
  selectedTenureMonths: number = 6,
  standardInterestRatePct: number = 15.0
): MultiCartEmiRiskResult {
  const minThresholdRequired = 3000;
  const meetsMinThreshold = totalCartValue >= minThresholdRequired;
  const isMultiItem = itemCount > 1;

  // If even 1 item is ineligible in a mixed cart, standard bank interest applies across the cart
  const potentialInterestLeak = isMultiItem
    ? Number((totalCartValue * (standardInterestRatePct / 100) * (selectedTenureMonths / 12)).toFixed(2))
    : 0;
  const potentialGstLeak = Number((potentialInterestLeak * GST_RATE).toFixed(2));
  const totalRiskAmount = Number((potentialInterestLeak + potentialGstLeak).toFixed(2));

  return {
    isMultiItem,
    itemCount,
    totalCartValue,
    meetsMinThreshold,
    minThresholdRequired,
    potentialInterestLeak,
    potentialGstLeak,
    totalRiskAmount,
  };
}
