/**
 * Target seam — natural-language command showcase (CLIENT composition target).
 *
 * The client build ships no demo content, so the showcase answers are honest
 * unavailables: the question is recognised, the result states that nothing is
 * measured in this deployment, and no rows are fabricated. (The palette still
 * lists the phrases — hiding a known question would make it look unknown.)
 *
 * `atRiskDemoRows` exists here only so both compositions satisfy the same
 * export surface for `commands.ts`; it is empty in the client.
 */
import type { Severity } from "@/lib/viewContracts";

export interface NlShowcaseAnswer {
  resultTitle: string;
  summary: string;
  rows: { title: string; meta: string; tone?: Severity }[];
}

export const atRiskDemoRows: { name: string; instrument: string; meta: string }[] = [];

const UNAVAILABLE: NlShowcaseAnswer = {
  resultTitle: "داده‌ای نیست",
  summary: "این پاسخ در نسخهٔ جاری از هیچ داده‌ای ساخته نمی‌شود؛ اندازه‌گیری مربوطه هنوز به سرور متصل نیست.",
  rows: [],
};

export const nlAnswers: Record<"n1" | "n2", NlShowcaseAnswer> = {
  n1: UNAVAILABLE,
  n2: UNAVAILABLE,
};
