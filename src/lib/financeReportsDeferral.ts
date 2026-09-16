/* ------------------------------------------------------------------ */
/* Finance / Reports deferral ledger (M10, D5-F4)                       */
/*                                                                      */
/* D6 / I2 (DECISIONS §19) keep the finance and reports DOMAIN planned  */
/* — M10 builds no repository, no read seam and no domain for them, and */
/* invents, fabricates or recomputes no revenue/payment figures. Every  */
/* fixture-backed export the two views (`src/views/Finance.tsx`,        */
/* `src/views/Reports.tsx`) used to read is classified below,           */
/* individually, with its disposition. This manifest is the DEFERRAL:   */
/* explicit, named, work-item-owned — not a data module. It carries no  */
/* rows; a deferred item must never "return" as an untracked fixture    */
/* replacement, and src/__tests__/m10Boundary.test.ts consumes this      */
/* ledger to prove that. It is a closed world, never a generic          */
/* exemption list.                                                      */
/* ------------------------------------------------------------------ */

export const FINANCE_REPORTS_DEFERRAL = {
  decision: "D6",
  workItem: "I2",
  surfaces: ["src/views/Finance.tsx", "src/views/Reports.tsx"],
  entries: [
    {
      export: "invoices",
      source: "src/data/records.ts",
      classification: "demo-record",
      disposition:
        "Legitimate seeded demo records: relocated byte-identical to the demo seed (src/domains/demo/academySeed.ts), persisted in DemoDataset.invoices and validated by the backup contract. READING them in a view is deferred: no invoice repository exists (D6/I2), so Finance renders the deferred state instead.",
    },
    {
      export: "payments",
      source: "src/data/records.ts",
      classification: "demo-record",
      disposition: "Same as invoices — seeded demo records (DemoDataset.payments); no view read until I2 designs the read seam.",
    },
    {
      export: "Invoice",
      source: "src/data/records.ts",
      classification: "demo-record",
      disposition: "Dataset contract type; owned by src/domains/demo/types.ts (the DemoDataset envelope).",
    },
    {
      export: "studentById",
      source: "src/data/records.ts",
      classification: "presentation-config",
      disposition: "Seed resolver helper used to join the demo rows; relocated with the seed collections. Not a product read.",
    },
    {
      export: "teachers",
      source: "src/data/records.ts",
      classification: "demo-record",
      disposition: "Seeded demo records (Reports rp3 rendered their stored utilization). The collection is seed-owned; the fabricated REPORT is removed.",
    },
    {
      export: "paymentLabel",
      source: "src/data/records.ts",
      classification: "vocabulary",
      disposition:
        "Status vocabulary, not data. D6/I2 keep a finance domain planned, so the smallest canonical NON-domain owner holds it: src/lib/financeVocabulary.ts (the deferral is documented there). Live consumers keep working (Student.payment).",
    },
    {
      export: "PaymentStatus",
      source: "src/data/records.ts",
      classification: "vocabulary",
      disposition: "Same owner as paymentLabel (src/lib/financeVocabulary.ts); anchored by the student entity's payment field.",
    },
    {
      export: "subscriptions",
      source: "src/data/records.ts",
      classification: "deferred-reading",
      disposition:
        "Fixture-only demo rows with NO persistence semantics (not in the dataset, not in any backup envelope): removed at M10, explicitly — not silently. I2 will design the subscription model with its repository; the rows will be re-created from that design, not resurrected from the fixture.",
    },
    {
      export: "Subscription",
      source: "src/data/records.ts",
      classification: "deferred-reading",
      disposition: "Contract shape kept as Vocabulary in src/lib/financeVocabulary.ts (smallest non-domain owner, D6/I2 documented); its instances are deferred per the subscriptions entry.",
    },
    {
      export: "subscriptionStatusLabel",
      source: "src/data/records.ts",
      classification: "vocabulary",
      disposition: "Status vocabulary with no current consumer; owned by src/lib/financeVocabulary.ts under the documented D6/I2 deferral.",
    },
    {
      export: "SubscriptionStatus",
      source: "src/data/records.ts",
      classification: "vocabulary",
      disposition: "Same owner as subscriptionStatusLabel (src/lib/financeVocabulary.ts).",
    },
    {
      export: "financeKpis",
      source: "src/data/records.ts",
      classification: "fabricated-measurement",
      disposition: "Invented month revenue/target/averages — nobody measured them. REMOVED at M10; F4 forbids recomputation or replacement.",
    },
    {
      export: "revenueByStream",
      source: "src/data/records.ts",
      classification: "fabricated-measurement",
      disposition: "Invented revenue composition — REMOVED.",
    },
    {
      export: "revenueSeries",
      source: "src/data/academy.ts",
      classification: "fabricated-measurement",
      disposition: "Invented monthly revenue series — REMOVED (the M9 H4/I9 rule: a number the records do not support must not render).",
    },
    {
      export: "revenueTarget",
      source: "src/data/academy.ts",
      classification: "fabricated-measurement",
      disposition: "Invented revenue target — REMOVED (also one of M10's authorized dead exports).",
    },
    {
      export: "growthSeries",
      source: "src/data/academy.ts",
      classification: "fabricated-measurement",
      disposition: "Invented enrollment growth series — REMOVED.",
    },
    {
      export: "occupancy",
      source: "src/data/academy.ts",
      classification: "fabricated-measurement",
      disposition: "Invented room occupancy percentages — REMOVED.",
    },
    {
      export: "instruments",
      source: "src/data/academy.ts",
      classification: "fabricated-measurement",
      disposition: "Invented instrument share/count/delta statistics — REMOVED.",
    },
    {
      export: "attendanceByDay",
      source: "src/data/records.ts",
      classification: "fabricated-measurement",
      disposition: "Invented daily attendance counts — REMOVED.",
    },
    {
      export: "attendanceTrend",
      source: "src/data/records.ts",
      classification: "fabricated-measurement",
      disposition: "Invented weekly attendance trend — REMOVED (zero consumers).",
    },
    {
      export: "attentionQueue",
      source: "src/data/records.ts",
      classification: "fabricated-measurement",
      disposition: "An 'extended attention queue' written by hand — REMOVED; the dashboard derives attention from stored records (M9).",
    },
    {
      export: "AttentionRecord",
      source: "src/data/records.ts",
      classification: "fabricated-measurement",
      disposition: "The queue's type — REMOVED with it.",
    },
    {
      export: "reportCatalog",
      source: "src/data/records.ts",
      classification: "fabricated-measurement",
      disposition: "Six narrative 'reports' with invented headline numbers and findings — REMOVED; Reports renders the deferred state.",
    },
    {
      export: "ReportDef",
      source: "src/data/records.ts",
      classification: "fabricated-measurement",
      disposition: "The catalogue's type — REMOVED with it.",
    },
  ],
} as const;

export type FinanceReportsDeferralEntry = (typeof FINANCE_REPORTS_DEFERRAL.entries)[number];
