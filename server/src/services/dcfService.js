/**
 * DCF (Discounted Cash Flow) Valuation Engine
 * Supports multi-stage growth model with sensitivity analysis
 */

/**
 * Run a full DCF valuation
 * @param {Object} params
 * @param {number} params.freeCashFlow - Base year FCF in GHS millions
 * @param {number} params.growthRateStage1 - High-growth phase rate (decimal, e.g. 0.15)
 * @param {number} params.growthRateStage2 - Stable/terminal growth rate (decimal, e.g. 0.04)
 * @param {number} params.stage1Years - Number of years for high-growth phase
 * @param {number} params.wacc - Weighted Average Cost of Capital (decimal)
 * @param {number} params.netDebt - Net debt in GHS millions (can be negative for net cash)
 * @param {number} params.sharesOutstanding - Shares outstanding in millions
 * @param {number} params.cashAndEquivalents - Cash in GHS millions
 * @returns {Object} DCF result with intrinsic value and sensitivity table
 */
function runDCF({
  freeCashFlow,
  growthRateStage1 = 0.12,
  growthRateStage2 = 0.04,
  stage1Years = 5,
  wacc = 0.18,
  netDebt = 0,
  sharesOutstanding = 100,
  cashAndEquivalents = 0,
}) {
  if (!freeCashFlow || freeCashFlow <= 0) {
    throw new Error('Free Cash Flow must be a positive number');
  }
  if (wacc <= growthRateStage2) {
    throw new Error('WACC must be greater than terminal growth rate to avoid infinite value');
  }

  const projections = [];
  let runningFCF = freeCashFlow;
  let pvSum = 0;

  // Stage 1: High-growth phase
  for (let year = 1; year <= stage1Years; year++) {
    runningFCF = runningFCF * (1 + growthRateStage1);
    const discountFactor = Math.pow(1 + wacc, year);
    const pv = runningFCF / discountFactor;
    pvSum += pv;
    projections.push({
      year,
      fcf: parseFloat(runningFCF.toFixed(2)),
      pv: parseFloat(pv.toFixed(2)),
      growthRate: growthRateStage1,
    });
  }

  // Terminal Value (Gordon Growth Model)
  const terminalFCF = runningFCF * (1 + growthRateStage2);
  const terminalValue = terminalFCF / (wacc - growthRateStage2);
  const pvTerminal = terminalValue / Math.pow(1 + wacc, stage1Years);
  pvSum += pvTerminal;

  // Enterprise Value
  const enterpriseValue = pvSum;
  // Equity Value
  const equityValue = enterpriseValue - netDebt + cashAndEquivalents;
  const intrinsicValuePerShare = sharesOutstanding > 0 ? equityValue / sharesOutstanding : 0;

  // Sensitivity Analysis: vary WACC and terminal growth rate
  const waccRange = [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03].map((d) => parseFloat((wacc + d).toFixed(4)));
  const tgrRange = [-0.02, -0.01, 0, 0.01, 0.02].map((d) => parseFloat((growthRateStage2 + d).toFixed(4)));

  const sensitivityTable = waccRange.map((w) => {
    const row = { wacc: (w * 100).toFixed(1) + '%' };
    tgrRange.forEach((tgr) => {
      if (w <= tgr) {
        row[`tgr_${(tgr * 100).toFixed(1)}`] = 'N/A';
        return;
      }
      const tv = (runningFCF * (1 + tgr)) / (w - tgr);
      const pvTv = tv / Math.pow(1 + w, stage1Years);
      // Recalculate stage 1 PV with this WACC
      let pv1Sum = 0;
      let fcf = freeCashFlow;
      for (let yr = 1; yr <= stage1Years; yr++) {
        fcf = fcf * (1 + growthRateStage1);
        pv1Sum += fcf / Math.pow(1 + w, yr);
      }
      const ev = pv1Sum + pvTv;
      const eq = ev - netDebt + cashAndEquivalents;
      const ivps = sharesOutstanding > 0 ? eq / sharesOutstanding : 0;
      row[`tgr_${(tgr * 100).toFixed(1)}`] = parseFloat(ivps.toFixed(4));
    });
    return row;
  });

  return {
    inputs: {
      freeCashFlow,
      growthRateStage1: (growthRateStage1 * 100).toFixed(1) + '%',
      growthRateStage2: (growthRateStage2 * 100).toFixed(1) + '%',
      stage1Years,
      wacc: (wacc * 100).toFixed(1) + '%',
      netDebt,
      sharesOutstanding,
      cashAndEquivalents,
    },
    projections,
    terminalValue: parseFloat(terminalValue.toFixed(2)),
    pvTerminalValue: parseFloat(pvTerminal.toFixed(2)),
    enterpriseValue: parseFloat(enterpriseValue.toFixed(2)),
    equityValue: parseFloat(equityValue.toFixed(2)),
    intrinsicValuePerShare: parseFloat(intrinsicValuePerShare.toFixed(4)),
    sensitivityTable,
    tgrLabels: tgrRange.map((t) => (t * 100).toFixed(1) + '%'),
  };
}

/**
 * Suggest DCF assumptions based on sector (Ghana-specific)
 */
function getSectorDefaults(sector) {
  const defaults = {
    Banking: { wacc: 0.20, growthRateStage1: 0.10, growthRateStage2: 0.04, stage1Years: 5 },
    Telecoms: { wacc: 0.17, growthRateStage1: 0.12, growthRateStage2: 0.04, stage1Years: 5 },
    'Oil & Gas': { wacc: 0.22, growthRateStage1: 0.08, growthRateStage2: 0.03, stage1Years: 5 },
    'Consumer Goods': { wacc: 0.18, growthRateStage1: 0.09, growthRateStage2: 0.04, stage1Years: 5 },
    Manufacturing: { wacc: 0.19, growthRateStage1: 0.08, growthRateStage2: 0.03, stage1Years: 5 },
    Technology: { wacc: 0.20, growthRateStage1: 0.18, growthRateStage2: 0.05, stage1Years: 7 },
  };
  return defaults[sector] || { wacc: 0.18, growthRateStage1: 0.10, growthRateStage2: 0.04, stage1Years: 5 };
}

module.exports = { runDCF, getSectorDefaults };
