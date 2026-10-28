/* ------------------------------------------------------------------ */
/* Finance / Reports deferral ledger (M10, D5-F4)                       */
/*                                                                      */
/* D6 / I2 (DECISIONS §19) still defers Reports, financial analytics,     */
/* and report exports. Invoice v1 was separately authorized in §40–41:    */
/* the client/API composition has a real invoice repository, while demo   */
/* mode keeps its honest unavailable state. This ledger classifies the   */
/* dissolved fixture exports and the still-deferred Reports surface; it  */
/* does not claim that invoice operations are absent or that report APIs  */
/* exist. No fabricated revenue/payment figures are allowed. Every        */
/* fixture-backed export formerly read by Finance/Reports is classified  */
/* individually with its disposition. This manifest is a closed-world   */
/* honesty ledger, not a data module or generic exemption list;            */
/* src/__tests__/m10Boundary.test.ts consumes it to protect that boundary. */
/* ------------------------------------------------------------------ */

export const FINANCE_REPORTS_DEFERRAL = {
  decision: "D6",
  workItem: "I2",
  // Finance left this list with the v1 invoice slice (DECISIONS §40): the
  // client composition serves it through the finance domain, so the view
  // reads a repository — while the demo composition keeps the honest
  // deferral in the same file's fallback branch (pinned by
  // noSuccessWithoutWrite). Reports stays: no reports domain exists.
  surfaces: ["src/views/Reports.tsx"],
  entries: [
    {
      export: "invoices",
      source: "src/data/records.ts",
      classification: "demo-record",
      disposition:
        "Legitimate demo seed records remain in DemoDataset.invoices and are covered by the backup contract; the client Finance surface does not read these demo rows. Client/API mode reads invoices through ApiFinanceRepository under DECISIONS.md §§40–41; demo mode deliberately shows the unavailable state. The invoice API does not authorize Reports or analytics.",
    },
    {
      export: "payments",
      source: "src/data/records.ts",
      classification: "demo-record",
      disposition:
        "Demo payments remain seed/backup content and are not the source for the client invoice API. Invoice v1 payment confirmation is persisted through the server contract in DECISIONS.md §41; demo mode remains unavailable and Reports stays deferred.",
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
        "Status vocabulary, not invoice persistence. It remains in src/lib/financeVocabulary.ts for the legacy Student.payment field; invoice v1 owns its own domain status type. This classification does not defer the authorized invoice API or authorize Reports.",
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
