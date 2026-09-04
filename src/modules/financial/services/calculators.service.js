/**
 * Financial Calculators Engine
 * Implements high-precision financial formulas for SIP, Retirement, and Goal-Based Planning
 */

function calculateSIP({ monthlyInvestment, expectedReturnRate, durationYears }) {
  const P = Number(monthlyInvestment) || 0;
  const annualRate = Number(expectedReturnRate) || 0;
  const years = Number(durationYears) || 0;

  const i = (annualRate / 100) / 12;
  const n = years * 12;

  const totalInvested = P * n;
  let maturityValue = 0;

  if (i > 0) {
    maturityValue = P * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
  } else {
    maturityValue = totalInvested;
  }

  const estimatedReturns = Math.max(0, maturityValue - totalInvested);

  // Generate year-by-year trajectory for charts
  const yearlyBreakdown = [];
  for (let y = 1; y <= years; y++) {
    const months = y * 12;
    const investedSoFar = P * months;
    let valueSoFar = 0;
    if (i > 0) {
      valueSoFar = P * ((Math.pow(1 + i, months) - 1) / i) * (1 + i);
    } else {
      valueSoFar = investedSoFar;
    }
    yearlyBreakdown.push({
      year: y,
      invested: Math.round(investedSoFar),
      returns: Math.round(Math.max(0, valueSoFar - investedSoFar)),
      totalValue: Math.round(valueSoFar),
    });
  }

  return {
    monthlyInvestment: P,
    expectedReturnRate: annualRate,
    durationYears: years,
    totalInvested: Math.round(totalInvested),
    estimatedReturns: Math.round(estimatedReturns),
    maturityValue: Math.round(maturityValue),
    yearlyBreakdown,
  };
}

function calculateRetirement({ currentAge, retirementAge, currentMonthlyExpenses, expectedInflation, expectedReturn }) {
  const cAge = Number(currentAge) || 30;
  const rAge = Number(retirementAge) || 60;
  const monthlyExp = Number(currentMonthlyExpenses) || 50000;
  const inflation = Number(expectedInflation) || 6.0;
  const returns = Number(expectedReturn) || 12.0;

  const yearsToRetire = Math.max(1, rAge - cAge);
  const yearsInRetirement = 25; // Standard longevity assumption

  // Monthly expense at retirement adjusted for inflation
  const futureMonthlyExp = monthlyExp * Math.pow(1 + inflation / 100, yearsToRetire);
  const futureAnnualExp = futureMonthlyExp * 12;

  // Real rate of return post-retirement (assuming conservative 8% returns post retirement with inflation)
  const postRetirementRealRate = (8.0 - inflation) / 100;
  let corpusRequired = 0;
  if (postRetirementRealRate > 0) {
    corpusRequired = futureAnnualExp * ((1 - Math.pow(1 + postRetirementRealRate, -yearsInRetirement)) / postRetirementRealRate);
  } else {
    corpusRequired = futureAnnualExp * yearsInRetirement;
  }

  // Monthly SIP required today to accumulate that corpus
  const monthlyRate = (returns / 100) / 12;
  const totalMonths = yearsToRetire * 12;
  let monthlySIPRequired = 0;
  if (monthlyRate > 0) {
    monthlySIPRequired = (corpusRequired * monthlyRate) / ((Math.pow(1 + monthlyRate, totalMonths) - 1) * (1 + monthlyRate));
  } else {
    monthlySIPRequired = corpusRequired / totalMonths;
  }

  return {
    currentAge: cAge,
    retirementAge: rAge,
    yearsToRetire,
    currentMonthlyExpenses: monthlyExp,
    futureMonthlyExpenses: Math.round(futureMonthlyExp),
    corpusRequired: Math.round(corpusRequired),
    monthlySIPRequired: Math.round(monthlySIPRequired),
  };
}

function calculateGoal({ goalAmount, targetYears, expectedReturn }) {
  const target = Number(goalAmount) || 1000000;
  const years = Number(targetYears) || 5;
  const annualRate = Number(expectedReturn) || 12.0;

  const i = (annualRate / 100) / 12;
  const n = years * 12;

  let monthlySIPRequired = 0;
  if (i > 0) {
    monthlySIPRequired = (target * i) / ((Math.pow(1 + i, n) - 1) * (1 + i));
  } else {
    monthlySIPRequired = target / n;
  }

  const totalInvested = monthlySIPRequired * n;
  const wealthGained = Math.max(0, target - totalInvested);

  return {
    goalAmount: Math.round(target),
    targetYears: years,
    expectedReturn: annualRate,
    monthlySIPRequired: Math.round(monthlySIPRequired),
    totalInvested: Math.round(totalInvested),
    wealthGained: Math.round(wealthGained),
  };
}

function generatePlainEnglishSummary(type, result) {
  if (type === "sip") {
    return `By investing ₹${result.monthlyInvestment?.toLocaleString("en-IN")} monthly over ${result.durationYears} years at an expected return of ${result.expectedReturnRate}%, your total principal invested will be ₹${result.totalInvested?.toLocaleString("en-IN")}. Compounding generates an estimated wealth addition of ₹${result.estimatedReturns?.toLocaleString("en-IN")}, bringing your total projected maturity value to ₹${result.maturityValue?.toLocaleString("en-IN")}.`;
  }
  if (type === "retirement") {
    return `To sustain your current monthly lifestyle of ₹${result.currentMonthlyExpenses?.toLocaleString("en-IN")} when you retire at age ${result.retirementAge}, inflation will push your required monthly expenditure to ₹${result.futureMonthlyExpenses?.toLocaleString("en-IN")}. You will need an accumulated retirement nest egg of approximately ₹${(result.corpusRequired / 10000000).toFixed(2)} Crores (₹${result.corpusRequired?.toLocaleString("en-IN")}). Starting today, a monthly disciplined SIP of ₹${result.monthlySIPRequired?.toLocaleString("en-IN")} bridges this goal.`;
  }
  if (type === "goal") {
    return `To achieve your targeted corpus of ₹${result.goalAmount?.toLocaleString("en-IN")} in ${result.targetYears} years at an anticipated growth rate of ${result.expectedReturn}%, you need a monthly systematic contribution of ₹${result.monthlySIPRequired?.toLocaleString("en-IN")}. Your personal investment will be ₹${result.totalInvested?.toLocaleString("en-IN")}, with market compounding contributing ₹${result.wealthGained?.toLocaleString("en-IN")}.`;
  }
  return "Calculation completed successfully.";
}

module.exports = {
  calculateSIP,
  calculateRetirement,
  calculateGoal,
  generatePlainEnglishSummary,
};
