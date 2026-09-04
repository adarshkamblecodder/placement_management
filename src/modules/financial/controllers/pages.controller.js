/**
 * Public Supporting & Marketing Pages Controller
 */

function getAwardsPage(req, res) {
  const awards = [
    { title: "Best Boutique Wealth Advisory India 2025", issuer: "National Wealth Forum", year: "2025", desc: "Recognized for exemplary risk-adjusted returns and client fiduciary excellence." },
    { title: "Top 10 Retirement Planning Firm", issuer: "Financial Leadership Summit", year: "2024", desc: "Honored for innovative multi-asset longevity models and retirement calculators." },
    { title: "Excellence in Digital Advisory & AI Innovation", issuer: "FinTech India Expo", year: "2024", desc: "Awarded for transparent investor tools and automated portfolio analysis." },
  ];
  res.render("financial/pages/awards.html", { title: "Awards & Industry Accolades — Wealth Management", awards });
}

function getTestimonialsPage(req, res) {
  const testimonials = [
    { name: "Dr. Rajesh Kulkarni", role: "Chief of Surgery, Mumbai", rating: 5, quote: "Their retirement planner accurately projected my post-retirement healthcare inflation. My portfolio transitioned smoothly into tax-efficient debt funds.", tag: "Retirement Planning" },
    { name: "Meera & Sunil Sengupta", role: "Tech Executives, Bengaluru", rating: 5, quote: "The goal-based SIP strategy enabled us to fund our daughter's overseas education without touching our core retirement nest egg.", tag: "Goal Planning" },
    { name: "Anil Mittal", role: "Business Owner, Delhi NCR", rating: 5, quote: "Transparent fiduciary advisory with zero hidden distribution commissions. Fully compliant with SEBI norms.", tag: "Wealth Advisory" },
  ];
  res.render("financial/pages/testimonials.html", { title: "Client Testimonials & Investor Reviews", testimonials });
}

function getGalleryPage(req, res) {
  const galleryItems = [
    { title: "Annual Investor Awareness Program 2025", location: "Mumbai Convention Center", date: "Jan 2025", category: "Seminars" },
    { title: "Retirement Longevity Workshop", location: "Bengaluru Tech Hub", date: "Nov 2024", category: "Workshops" },
    { title: "National Wealth Summit Awards Ceremony", location: "New Delhi", date: "Aug 2024", category: "Awards" },
  ];
  res.render("financial/pages/gallery.html", { title: "Media & Investor Event Gallery", galleryItems });
}

function getTermsPage(req, res) {
  res.render("financial/pages/terms.html", { title: "Terms & Conditions — Advisory Scope & Engagement" });
}

function getPrivacyPage(req, res) {
  res.render("financial/pages/privacy.html", { title: "Privacy Policy & Client Data Confidentiality" });
}

function getDisclosurePage(req, res) {
  res.render("financial/pages/disclosure.html", {
    title: "SEBI, AMFI & IRDAI Regulatory Registration Disclosure",
    sebiRegNo: "INA000012345",
    amfiArn: "ARN-98765",
    irdaiCode: "CA0876",
  });
}

// Service Sub-pages (SEO-optimized separate routes)
function getServiceWealthPage(req, res) {
  res.render("financial/services/wealth.html", { title: "Wealth & Portfolio Management Services India" });
}

function getServiceRetirementPage(req, res) {
  res.render("financial/services/retirement.html", { title: "Retirement Planning & Pension Advisory India" });
}

function getServiceTaxPage(req, res) {
  res.render("financial/services/tax.html", { title: "Tax Optimization & Section 80C Advisory India" });
}

function getServiceEstatePage(req, res) {
  res.render("financial/services/estate.html", { title: "Estate Planning & Family Trust Advisory India" });
}

function getServiceInsurancePage(req, res) {
  res.render("financial/services/insurance.html", { title: "Risk Management & Term Insurance Advisory India" });
}

module.exports = {
  getAwardsPage,
  getTestimonialsPage,
  getGalleryPage,
  getTermsPage,
  getPrivacyPage,
  getDisclosurePage,
  getServiceWealthPage,
  getServiceRetirementPage,
  getServiceTaxPage,
  getServiceEstatePage,
  getServiceInsurancePage,
};
