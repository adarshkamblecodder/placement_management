const {
  calculateSIP,
  calculateRetirement,
  calculateGoal,
  generatePlainEnglishSummary,
} = require("../services/calculators.service");

function getSIPCalculatorPage(req, res) {
  res.render("financial/calculators/sip.html", {
    title: "SIP Calculator India — Calculate Mutual Fund SIP Returns Online",
    calculatorType: "sip",
  });
}

function getRetirementCalculatorPage(req, res) {
  res.render("financial/calculators/retirement.html", {
    title: "Retirement Calculator India — Calculate Retirement Corpus & Monthly Pension",
    calculatorType: "retirement",
  });
}

function getGoalCalculatorPage(req, res) {
  res.render("financial/calculators/goal.html", {
    title: "Goal-Based Investment Calculator — Plan Education, Home, Wealth Targets",
    calculatorType: "goal",
  });
}

function apiCalculate(req, res) {
  const { type, inputs } = req.body;
  let result = null;

  if (type === "sip") {
    result = calculateSIP(inputs || {});
  } else if (type === "retirement") {
    result = calculateRetirement(inputs || {});
  } else if (type === "goal") {
    result = calculateGoal(inputs || {});
  } else {
    return res.status(400).json({ success: false, error: "Invalid calculator type" });
  }

  const plainExplanation = generatePlainEnglishSummary(type, result);
  return res.json({ success: true, result, explanation: plainExplanation });
}

module.exports = {
  getSIPCalculatorPage,
  getRetirementCalculatorPage,
  getGoalCalculatorPage,
  apiCalculate,
};
