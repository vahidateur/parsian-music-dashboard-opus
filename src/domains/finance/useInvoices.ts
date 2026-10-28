import { useCallback, useMemo, useState } from "react";
import { getFinanceRepository } from "@/domains/registry";
import { useResourceList } from "../shared/useResource";
import type { FinanceRepository } from "./repository";
import type { CreateInvoiceInput, Invoice, InvoiceListParams, PayInvoiceInput, UpdateInvoiceInput } from "./types";

/**
 * Invoice list + the three v1 verbs, adapter-agnostic: the active repository
 * is resolved from the registry, so this hook behaves identically in demo
 * (where every verb rejects DOMAIN_UNAVAILABLE) and API mode.
 *
 * THE WRITE RULE THIS HOOK INHERITS (M2, unchanged)
 *
 * Each wrapper awaits the repository and re-reads only AFTER it resolved.
 * Nothing is written optimistically and nothing is announced here: the caller
 * reports what the returned record actually says, and a refusal reaches it as
 * the repository's own `ApiError`, verbatim.
 */
export function useInvoices(params: InvoiceListParams = {}, repository?: FinanceRepository) {
  const [revision, setRevision] = useState(0);
  const resolved = useMemo(() => repository ?? getFinanceRepository(), [repository]);
  const list = useResourceList<Invoice, InvoiceListParams>(
    (p, signal) => resolved.list(p, signal),
    params,
    revision,
  );
  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  /** Domain verb: issue a due invoice to a student. */
  const create = useCallback(
    async (input: CreateInvoiceInput) => {
      const created = await resolved.create(input);
      refresh();
      return created;
    },
    [resolved, refresh],
  );

  /** Domain verb: edit a due invoice. Paid invoices refuse server-side. */
  const update = useCallback(
    async (id: string, input: UpdateInvoiceInput) => {
      const updated = await resolved.update(id, input);
      refresh();
      return updated;
    },
    [resolved, refresh],
  );

  /** Domain verb: discharge by the one accepted payment. Terminal. */
  const pay = useCallback(
    async (id: string, input: PayInvoiceInput) => {
      const paid = await resolved.pay(id, input);
      refresh();
      return paid;
    },
    [resolved, refresh],
  );

  return { ...list, refresh, create, update, pay };
}
