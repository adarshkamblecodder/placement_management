const express = require("express");
const pagesCtrl = require("../controllers/pages.controller");
const calcCtrl = require("../controllers/calculators.controller");
const aiCtrl = require("../controllers/ai.controller");

const router = express.Router();

// ─── Supporting & Regulatory Pages ─────────────────────────────────────────
router.get("/awards", pagesCtrl.getAwardsPage);
router.get("/testimonials", pagesCtrl.getTestimonialsPage);
router.get("/gallery", pagesCtrl.getGalleryPage);
router.get("/terms", pagesCtrl.getTermsPage);
router.get("/privacy", pagesCtrl.getPrivacyPage);
router.get("/regulatory-disclosure", pagesCtrl.getDisclosurePage);

// ─── Service Sub-Pages (SEO-optimized) ─────────────────────────────────────
router.get("/services/wealth-management", pagesCtrl.getServiceWealthPage);
router.get("/services/retirement-planning", pagesCtrl.getServiceRetirementPage);
router.get("/services/tax-optimization", pagesCtrl.getServiceTaxPage);
router.get("/services/estate-planning", pagesCtrl.getServiceEstatePage);
router.get("/services/insurance-advisory", pagesCtrl.getServiceInsurancePage);

// ─── Planner / Calculators Suite ───────────────────────────────────────────
router.get("/calculators/sip", calcCtrl.getSIPCalculatorPage);
router.get("/calculators/retirement", calcCtrl.getRetirementCalculatorPage);
router.get("/calculators/goal-planning", calcCtrl.getGoalCalculatorPage);

// ─── Calculator & AI API Endpoints ─────────────────────────────────────────
router.post("/api/calculators/calculate", calcCtrl.apiCalculate);
router.post("/api/ai/chat", aiCtrl.apiChat);

module.exports = router;
