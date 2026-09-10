/**
 * CommitGuard - Shared Types & Data Models
 * Ground Truth Data Contracts matching docs/PRD.md & docs/SYSTEM_WORKING_BLUEPRINT.md
 */

// ==========================================
// 1. Commitment Types & Input Payloads
// ==========================================

export type CommitmentType = 'NO_COST_EMI' | 'FD_LOCKIN' | 'DEBT_MF';

export interface EmiCommitmentInput {
  type: 'NO_COST_EMI';
  productName: string;
  productPrice: number;            // e.g. 80000
  tenureMonths: number;            // e.g. 12
  advertisedRate: number;          // Typically 0
  bankProcessingFee: number;       // e.g. 199 or 299
  bankNominalInterestRate: number; // e.g. 15.0% (offset by merchant discount)
}

export interface LockInCommitmentInput {
  type: 'FD_LOCKIN';
  institutionName: string;
  principalAmount: number;         // e.g. 500000
  contractedTenureMonths: number;  // e.g. 12
  contractedRate: number;          // e.g. 7.10%
  prematurePenaltyRate: number;    // e.g. 1.00%
  completedMonthsBeforeExit: number; // e.g. 6
  applicableCompletedRate: number; // Rate for 6 months if contracted, e.g. 5.50%
  liquidFundRateBenchmark: number; // Zero-penalty Liquid Fund rate, e.g. 6.75%
  investorTaxSlabPercent: number;  // e.g. 30%
}

export interface DebtMfCommitmentInput {
  type: 'DEBT_MF';
  fundName: string;
  investmentAmount: number;        // e.g. 200000
  horizonMonths: number;           // e.g. 24
  expectedGrossYield: number;      // e.g. 7.20%
  equityAllocationPercent: number; // e.g. 10% (< 35% triggers Sec 50AA)
  investorTaxSlabPercent: number;  // e.g. 30%
  expectedInflationPercent: number;// e.g. 5.50%
}

// ==========================================
// 2. Deterministic Calculation Output Models
// ==========================================

export interface MonthlyAmortizationSchedule {
  month: number;
  openingBalance: number;
  principalComponent: number;
  interestComponent: number;
  gstOnInterest: number;           // 18% on interestComponent
  totalMonthlyCashflow: number;     // principal + interest + gst
  closingBalance: number;
}

export interface EmiTradeoffResult {
  productPrice: number;
  upfrontProcessingFee: number;
  upfrontGstOnFee: number;
  totalUpfrontCashOutflow: number;
  merchantDiscount: number;
  borrowedPrincipal: number;
  monthlyBaseEmi: number;
  totalInterestCharged: number;
  totalGstOnInterest: number;
  totalTrueCashOutflow: number;
  totalHiddenFriction: number;     // Processing fees + GST on fee + GST on interest
  effectiveAnnualPercentageRate: number; // True IRR-based Effective APR (e.g. 15.24%)
  schedule: MonthlyAmortizationSchedule[];
}

export interface LockInTradeoffResult {
  principalAmount: number;
  contractedTenureMonths: number;
  contractedRate: number;
  prematureExitMonth: number;
  penalizedRate: number;           // max(0, applicableCompletedRate - prematurePenaltyRate)
  fdPrematurePayout: number;
  fdMaturityIfHeld: number;
  liquidFundPayout: number;
  netLossVsLiquid: number;         // liquidFundPayout - fdPrematurePayout
  isLiquidityTrap: boolean;
  tdsDeductionAmount: number;      // Sec 194A 10% TDS if interest > 40k
}

export interface RealYieldResult {
  nominalYield: number;
  marginalTaxSlab: number;
  postTaxNominalRate: number;
  inflationRate: number;
  postTaxRealYield: number;        // ((1 + postTaxNominal) / (1 + inflation)) - 1
  isNegativeRealReturn: boolean;
}

export interface OpportunityCostResult {
  commitmentYield: number;
  sovereignTBillRate: number;      // 91-day T-Bill (e.g. 6.85%)
  rbiRepoRate: number;             // RBI Repo Rate (e.g. 6.50%)
  yieldSpreadVsSovereign: number;  // commitmentYield - sovereignTBillRate
  rupeeOpportunityCost: number;    // Principal * (spread / 100) * (tenure / 12)
}

// ==========================================
// 3. Macro & Regulatory Policy Alerts
// ==========================================

export type PolicySeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface PolicyAlert {
  policyId: string;
  clauseTitle: string;
  statuteReference: string;
  severity: PolicySeverity;
  headline: string;
  detailedNotice: string;
}

// ==========================================
// 4. Sandboxed Goal Volatility Schema
// ==========================================

export interface SandboxedGoal {
  id: string;
  title: string;
  targetAmount: number;
  targetHorizonMonths: number;
  earmarkedCapital: number;
  riskProfile: 'ZERO_CAPITAL_RISK' | 'MODERATE' | 'FLEXIBLE';
  updatedAt: string;
}

export interface GoalConflictEvaluation {
  hasConflict: boolean;
  conflictingGoal?: SandboxedGoal;
  warningMessage?: string;
}

// ==========================================
// 5. AI Guardrail Translator Schemas
// ==========================================

export interface NarratorSummary {
  bullet_1_hidden_friction: string;
  bullet_2_liquidity_horizon: string;
  bullet_3_neutral_baseline: string;
  status: 'GUARDRAIL_VERIFIED' | 'DETERMINISTIC_FALLBACK';
  executionTimeMs: number;
}

export interface ExplainRequestPayload {
  commitmentType: CommitmentType;
  productOrInstrumentName: string;
  principalOrPrice: number;
  tenureMonths: number;
  computedMetrics: Record<string, any>;
  policyAlerts: PolicyAlert[];
  goalConflict?: GoalConflictEvaluation;
}

// ==========================================
// 6. Neutral Directory Schema
// ==========================================

export interface DirectoryRateCard {
  id: string;
  institutionName: string;
  institutionType: 'PUBLIC_BANK' | 'PRIVATE_BANK' | 'SMALL_FINANCE_BANK' | 'SOVEREIGN';
  oneYearFdRate: number;
  twoYearFdRate: number;
  prematurePenaltyPercent: number;
  seniorCitizenBonusPercent: number;
  officialDirectPortalUrl: string;
  lastVerifiedDate: string;
}

// ==========================================
// 7. Multi-Item Cart EMI Risk Schema
// ==========================================

export interface MultiCartEmiRiskResult {
  isMultiItem: boolean;
  itemCount: number;
  totalCartValue: number;
  meetsMinThreshold: boolean;
  minThresholdRequired: number;
  potentialInterestLeak: number;
  potentialGstLeak: number;
  totalRiskAmount: number;
}

// ==========================================
// 8. Credit Utilization Ratio (CUR) / CIBIL Impact Schema
// ==========================================

export type CreditUtilizationRiskTier = 'SAFE' | 'CAUTION' | 'DANGER';

export interface CreditUtilizationInput {
  orderPrincipal: number;        // Full transaction principal blocked upfront (not just the EMI installment)
  existingCardBalance: number;   // Other spends already outstanding on the same card
  totalCreditLimit: number;      // User's total credit limit on that card
}

export interface CreditUtilizationResult {
  orderPrincipal: number;
  existingCardBalance: number;
  totalCreditLimit: number;
  blockedAmount: number;              // orderPrincipal + existingCardBalance
  utilizationRatioPercent: number;    // (blockedAmount / totalCreditLimit) * 100
  riskTier: CreditUtilizationRiskTier;
  estimatedScoreDropRange: string;    // e.g. "0", "5-15", "20-40"
}

// ==========================================
// 9. Dual-Ledger Forfeited Card Reward Schema
// ==========================================

export interface ForfeitedRewardInput {
  orderPrincipal: number;
  rewardRatePercent: number; // category-aware rate for the selected card + surface
}

export interface ForfeitedRewardResult {
  orderPrincipal: number;
  rewardRatePercent: number;
  rewardIfFullSwipe: number;    // reward earned paying in full, no EMI
  netCostIfFullSwipe: number;   // orderPrincipal - rewardIfFullSwipe
  forfeitedIfEmi: number;       // reward lost entirely by converting to EMI (MITC-verified: always 100%)
}
