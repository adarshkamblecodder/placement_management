/**
 * AI Advisory & RAG Pipeline Service
 * Provides context-grounded financial Q&A across services, calculators, and regulatory frameworks.
 */

const KNOWLEDGE_BASE = [
  {
    topic: "Retirement Planning",
    category: "Services",
    content: "Retirement planning in India must factor in 6-7% healthcare and lifestyle inflation. Creating a multi-asset corpus using Equity Mutual Funds (for growth during accumulation), Debt Funds, NPS, and EPF ensures longevity protection for 25+ years post-retirement.",
    keywords: ["retirement", "pension", "nps", "corpus", "old age", "retire"],
  },
  {
    topic: "SIP Compounding & Equity Funds",
    category: "Calculators",
    content: "Systematic Investment Plans (SIPs) allow rupee-cost averaging, mitigating market volatility. Over 10-15 year horizons, Indian diversified equity mutual funds have historically delivered 12-14% CAGR, generating significant wealth multiplier effects.",
    keywords: ["sip", "mutual fund", "compounding", "returns", "equity", "investment"],
  },
  {
    topic: "Tax Optimization & Section 80C/New Tax Regime",
    category: "Services",
    content: "Under the New Tax Regime, tax slabs are streamlined up to ₹3 Lakhs nil. For Old Regime, ELSS (Section 80C), NPS Tier-1 (80CCD 1B up to ₹50,000), Health Insurance (80D up to ₹25,000/₹50,000 for senior citizens), and Home Loan interest (Section 24) reduce taxable liability.",
    keywords: ["tax", "80c", "elss", "tax regime", "save tax", "80d", "deductions"],
  },
  {
    topic: "Regulatory Registrations & Investor Protection",
    category: "Compliance",
    content: "Our advisory adheres to SEBI (Investment Advisers) Regulations, AMFI ARN code of conduct, and IRDAI corporate agency guidelines. Client funds are never pooled; investments are routed directly via BSE StAR MF / NSE NMF II to AMC depository escrows.",
    keywords: ["sebi", "amfi", "arn", "irdai", "license", "regulations", "safety", "legit"],
  },
  {
    topic: "Goal-Based Wealth Planning",
    category: "Services",
    content: "Goal-based financial planning defines dedicated portfolios for discrete time horizons: Short-term (<3 yrs: Liquid/Ultra-short Debt), Medium-term (3-7 yrs: Balanced Advantage / Hybrid Funds), and Long-term (>7 yrs: Mid/Large/Flexicap Equities).",
    keywords: ["goal", "child education", "house purchase", "wealth creation", "horizon"],
  },
];

function retrieveContext(query) {
  const q = String(query || "").toLowerCase();
  const scored = KNOWLEDGE_BASE.map((item) => {
    let score = 0;
    for (const kw of item.keywords) {
      if (q.includes(kw)) score += 3;
    }
    const words = item.topic.toLowerCase().split(" ");
    for (const w of words) {
      if (q.includes(w)) score += 2;
    }
    return { ...item, score };
  });

  const relevant = scored.filter((i) => i.score > 0).sort((a, b) => b.score - a.score);
  return relevant.length > 0 ? relevant.slice(0, 2) : [KNOWLEDGE_BASE[0], KNOWLEDGE_BASE[1]];
}

async function generateAdvisoryResponse(userQuery, conversationHistory = []) {
  const query = String(userQuery || "").trim();
  const contextChunks = retrieveContext(query);
  const contextText = contextChunks.map((c) => `[${c.topic}]: ${c.content}`).join("\n\n");

  // Determine lead intent classification from query
  let intentCategory = "General";
  const qLower = query.toLowerCase();
  if (qLower.includes("retire") || qLower.includes("pension") || qLower.includes("age")) {
    intentCategory = "Retirement Planning";
  } else if (qLower.includes("tax") || qLower.includes("80c") || qLower.includes("regime")) {
    intentCategory = "Tax Planning";
  } else if (qLower.includes("insurance") || qLower.includes("term") || qLower.includes("health")) {
    intentCategory = "Insurance";
  } else if (qLower.includes("sip") || qLower.includes("fund") || qLower.includes("invest") || qLower.includes("share")) {
    intentCategory = "Investments";
  }

  let answer = "";

  if (qLower.includes("sip") || qLower.includes("how much to invest")) {
    answer = `Based on historical financial planning benchmarks, starting an early SIP harnesses exponential compounding. For instance, an investment of ₹10,000/month for 15 years at 12% annual return can grow to over ₹50 Lakhs. You can test your customized numbers on our [SIP Calculator](/calculators/sip).`;
  } else if (qLower.includes("retire") || qLower.includes("corpus")) {
    answer = `Retirement planning requires building a corpus that counters lifestyle inflation post-retirement. A practical rule of thumb is accumulating 25x to 30x your annual expenses by age 60. Check our interactive [Retirement Calculator](/calculators/retirement) to calculate your exact monthly requirement.`;
  } else if (qLower.includes("tax") || qLower.includes("save tax")) {
    answer = `Tax optimization combines choosing the right tax regime (Old vs. New) and leveraging instruments like ELSS mutual funds, NPS (additional ₹50,000 deduction under 80CCD 1B), and health insurance. Our advisors can run a comprehensive tax audit for your income bracket.`;
  } else if (qLower.includes("safe") || qLower.includes("sebi") || qLower.includes("license")) {
    answer = `We operate strictly within SEBI and AMFI regulatory frameworks. All client capital remains in your own depository / AMC account with zero custodial risk. Details are disclosed on our [Regulatory Disclosure](/regulatory-disclosure) page.`;
  } else {
    answer = `Thank you for your query. For long-term financial security, our advisory focuses on strategic asset allocation, compounding growth through disciplined SIPs, and periodic portfolio rebalancing. Relevant guidance: ${contextChunks[0]?.content}`;
  }

  const disclaimer = `\n\n*Disclaimer: This is an AI assistant for general educational guidance. For personalized investment advice aligned with your risk profile, please book a consultation with our licensed financial advisors.*`;

  return {
    response: answer + disclaimer,
    intentCategory,
    sources: contextChunks.map((c) => c.topic),
  };
}

module.exports = {
  retrieveContext,
  generateAdvisoryResponse,
};
