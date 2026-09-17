/* ------------------------------------------------------------------ */
/* Finance-related vocabulary (M10)                                     */
/*                                                                      */
/* `PaymentStatus` is a value type anchored by the student entity       */
/* (`Student.payment`) and shared by the seeded demo invoices;          */
/* `paymentLabel` renders it. `Subscription*` is the subscription       */
/* vocabulary: its data rows were fixture-only and retired at M10 (the  */
/* deferral is recorded in `src/domains/deferred.ts`), while the        */
/* vocabulary remains here for surfaces that may honestly render it.    */
/*                                                                      */
/* D6 / I2 (DECISIONS §19) keep the finance and reports domains         */
/* *planned*, so there is deliberately no domain to own these: D5's     */
/* rule is the smallest canonical NON-domain owner, and this module is  */
/* it. It carries status vocabulary and nothing else — no amounts, no   */
/* KPIs, no series, no fabricated measurements.                         */
/* ------------------------------------------------------------------ */

export type PaymentStatus = "paid" | "due" | "overdue";
export const paymentLabel: Record<PaymentStatus, string> = { paid: "تسویه", due: "در انتظار", overdue: "سررسید گذشته" };

export type SubscriptionStatus = "active" | "paused" | "expiring";
export const subscriptionStatusLabel: Record<SubscriptionStatus, string> = { active: "فعال", paused: "متوقف", expiring: "در حال اتمام" };

export interface Subscription {
  id: string;
  studentId: string;
  plan: string;
  term: string;
  amount: number; // per period, Toman
  nextBilling: string;
  since: string;
  status: SubscriptionStatus;
  method: string;
}
