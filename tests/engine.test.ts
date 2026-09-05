/**
 * CommitGuard - Automated Engine Verification Suite
 * Verifies mathematical formulas, IRR calculations, GST compounding, and anti-advisory guardrails.
 */

import assert from 'assert';
import {
  calculateNoCostEmiDrag,
  calculateLockInVsLiquidity,
  calculatePostTaxRealYield,
  calculateOpportunityCost,
  evaluateMultiCartEmiRisk,
} from '../src/lib/financial-engine';
import { validateAntiAdvisoryGuardrail } from '../src/lib/llm-guardrail';
import { evaluatePolicyAlerts } from '../src/lib/policy-alerts';

console.log('🧪 Starting CommitGuard Deterministic Engine Test Suite...\n');

// -------------------------------------------------------------
// Test 1: No-Cost EMI Effective APR & GST Drag
// -------------------------------------------------------------
console.log('Test 1: Verifying No-Cost EMI Calculation (₹80,000 Laptop, 12 Months)...');
const emiInput = {
  type: 'NO_COST_EMI' as const,
  productName: 'Laptop',
  productPrice: 80000,
  tenureMonths: 12,
  advertisedRate: 0,
  bankProcessingFee: 199,
  bankNominalInterestRate: 15.0,
};

const emiResult = calculateNoCostEmiDrag(emiInput);

console.log(`  -> Effective APR Computed: ${emiResult.effectiveAnnualPercentageRate}%`);
console.log(`  -> Upfront Fee + GST: ₹${emiResult.totalUpfrontCashOutflow}`);
console.log(`  -> Total GST on Monthly Interest: ₹${emiResult.totalGstOnInterest}`);
console.log(`  -> Total Hidden Friction: ₹${emiResult.totalHiddenFriction}`);

assert(emiResult.effectiveAnnualPercentageRate >= 14.0 && emiResult.effectiveAnnualPercentageRate <= 21.0,
  `Effective APR should be between 14% and 21% due to processing fee and GST compounding, got ${emiResult.effectiveAnnualPercentageRate}%`);
assert(emiResult.totalHiddenFriction > 1000, 'Total friction should exceed ₹1000');
assert.strictEqual(emiResult.schedule.length, 12, 'Amortization schedule should have exactly 12 months');
console.log('✅ Test 1 Passed: No-Cost EMI mathematical proof verified.\n');

// -------------------------------------------------------------
// Test 2: Lock-In vs Liquidity Trap & Premature Break Penalty
// -------------------------------------------------------------
console.log('Test 2: Verifying FD Premature Penalty vs Zero-Penalty Liquid Fund (₹5,00,000 at Month 6)...');
const lockInInput = {
  type: 'FD_LOCKIN' as const,
  institutionName: 'Bank FD',
  principalAmount: 500000,
  contractedTenureMonths: 12,
  contractedRate: 7.10,
  prematurePenaltyRate: 1.00,
  completedMonthsBeforeExit: 6,
  applicableCompletedRate: 5.50,
  liquidFundRateBenchmark: 6.75,
  investorTaxSlabPercent: 30,
};

const lockInResult = calculateLockInVsLiquidity(lockInInput);
console.log(`  -> Penalized Rate: ${lockInResult.penalizedRate}% (Base 5.50% - 1.00% penalty)`);
console.log(`  -> FD Premature Payout: ₹${lockInResult.fdPrematurePayout}`);
console.log(`  -> Zero-Penalty Liquid Payout: ₹${lockInResult.liquidFundPayout}`);
console.log(`  -> Net Rupee Loss vs Liquid: ₹${lockInResult.netLossVsLiquid}`);
console.log(`  -> Is Liquidity Trap: ${lockInResult.isLiquidityTrap}`);

assert.strictEqual(lockInResult.penalizedRate, 4.5, 'Penalized rate must be exactly 4.50%');
assert(lockInResult.isLiquidityTrap, 'Premature exit at month 6 must trigger Liquidity Trap condition');
assert(lockInResult.liquidFundPayout > lockInResult.fdPrematurePayout, 'Liquid fund payout must exceed premature FD payout');
console.log('✅ Test 2 Passed: Liquidity Trap and penal rate logic verified.\n');

// -------------------------------------------------------------
// Test 3: Post-Tax Real Yield under Inflation Drag
// -------------------------------------------------------------
console.log('Test 3: Verifying Post-Tax Real Yield (7.20% yield, 30% tax slab, 5.50% inflation)...');
const realYield = calculatePostTaxRealYield(7.20, 30, 5.50);
console.log(`  -> Post-Tax Nominal Yield: ${realYield.postTaxNominalRate}%`);
console.log(`  -> Post-Tax Real Yield: ${realYield.postTaxRealYield}%`);

assert(realYield.postTaxNominalRate < 7.20, 'Post-tax rate must be reduced by tax slab');
assert(realYield.postTaxRealYield < 2.0, 'Real yield adjusted for inflation must be under 2.0%');
console.log('✅ Test 3 Passed: Post-tax real yield verified.\n');

// -------------------------------------------------------------
// Test 4: Macro Policy Alert Triggers
// -------------------------------------------------------------
console.log('Test 4: Verifying Regulatory Policy Rules (Section 50AA Debt MF)...');
const alerts = evaluatePolicyAlerts({
  commitmentType: 'DEBT_MF',
  equityAllocationPercent: 10,
  tenureMonths: 18,
});

assert(alerts.some(a => a.policyId === 'PR-1'), 'Must trigger PR-1 Section 50AA Indexation Removal alert');
console.log(`  -> Triggered Alerts: ${alerts.map(a => a.clauseTitle).join(', ')}`);
console.log('✅ Test 4 Passed: Contextual macro triggers verified.\n');

// -------------------------------------------------------------
// Test 5: Anti-Advisory LLM Guardrail Regex Filter
// -------------------------------------------------------------
console.log('Test 5: Verifying Anti-Advisory Heuristic Scanner...');
assert.strictEqual(validateAntiAdvisoryGuardrail('We recommend choosing Bank A over Bank B'), false,
  'Must block "recommend" keyword');
assert.strictEqual(validateAntiAdvisoryGuardrail('You should buy this item upfront'), false,
  'Must block "you should" keyword');
assert.strictEqual(validateAntiAdvisoryGuardrail('This is a bad deal compared to market rates'), false,
  'Must block "bad deal" keyword');
assert.strictEqual(validateAntiAdvisoryGuardrail('Statutory 18% GST applies to monthly interest charges of ₹143.80.'), true,
  'Must permit neutral factual arithmetic statements');
console.log('✅ Test 5 Passed: Heuristic safe-harbor guardrails verified.\n');

// -------------------------------------------------------------
// Test 6: Multi-Item Cart EMI Risk & Disqualification Evaluator
// -------------------------------------------------------------
console.log('Test 6: Verifying Multi-Item Cart EMI Risk Evaluator...');
const singleItem = evaluateMultiCartEmiRisk(2500, 1, 6);
assert.strictEqual(singleItem.isMultiItem, false);
assert.strictEqual(singleItem.meetsMinThreshold, false, '₹2,500 must fail ₹3,000 threshold');
assert.strictEqual(singleItem.totalRiskAmount, 0, 'Single item has no mixed cart risk');

const multiCart = evaluateMultiCartEmiRisk(45000, 3, 6, 15.0);
console.log(`  -> Multi-Item Cart (3 items, ₹45,000): Meets Min = ${multiCart.meetsMinThreshold}`);
console.log(`  -> Potential Interest Leakage: ₹${multiCart.potentialInterestLeak}`);
console.log(`  -> Potential GST Drag: ₹${multiCart.potentialGstLeak}`);
console.log(`  -> Total Risk: ₹${multiCart.totalRiskAmount}`);

assert.strictEqual(multiCart.isMultiItem, true);
assert.strictEqual(multiCart.meetsMinThreshold, true);
assert(multiCart.potentialInterestLeak > 3000, 'Interest leak for ₹45k @ 15% 6m should exceed ₹3,000');
assert(multiCart.totalRiskAmount > 3500, 'Total risk including GST should exceed ₹3,500');
console.log('✅ Test 6 Passed: Multi-Cart EMI Risk & Threshold logic verified.\n');

console.log('🎉 All 6 Test Suites Passed with 100% Deterministic Precision!');
