import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/domains/auth/AuthContext";
import { ROLES, roleLabels, rolePermissions, type RoleId } from "@/domains/auth/permissions";
import { useUsers } from "@/domains/auth/useUsers";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, StatusBadge } from "@/components/ds/primitives";
import { Avatar, Field, ListRow, Panel, inputCls } from "@/components/ds/patterns";
import { EmptyState, LoadingState } from "@/components/ds/states";
import { cn } from "@/utils/cn";

/** Real user + role administration, backed by the UserRepository. */
export function UsersPanel() {
  const { notify } = useApp();
  const { can, user: currentUser } = useAuth();
  const users = useUsers();
  const mayWrite = can("users.write");

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ name: string; email: string; role: RoleId }>({ name: "", email: "", role: "staff" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = await users.create(draft);
    if (error) {
      setFieldErrors(error.fields ?? {});
      notify({ tone: "warning", title: "کاربر ساخته نشد", detail: error.message });
      return;
    }
    setFieldErrors({});
    setDraft({ name: "", email: "", role: "staff" });
    setAdding(false);
    notify({ tone: "success", title: "کاربر جدید افزوده شد" });
  };

  const changeRole = async (id: string, role: RoleId) => {
    const error = await users.update(id, { role });
    notify(
      error
        ? { tone: "warning", title: "تغییر نقش انجام نشد", detail: error.message }
        : { tone: "success", title: "نقش کاربر به‌روزرسانی شد" },
    );
  };

  const toggleStatus = async (id: string, next: "active" | "disabled") => {
    const error = await users.setStatus(id, next);
    notify(
      error
        ? { tone: "warning", title: "تغییر وضعیت انجام نشد", detail: error.message }
        : { tone: "success", title: next === "active" ? "کاربر فعال شد" : "کاربر غیرفعال شد" },
    );
  };

  const removeUser = async (id: string, name: string) => {
    const error = await users.remove(id);
    notify(
      error
        ? { tone: "warning", title: "حذف انجام نشد", detail: error.message }
        : { tone: "success", title: `${name} حذف شد` },
    );
  };

  return (
    <>
      <Panel
        title="کاربران"
        kicker="حساب‌هایی که می‌توانند وارد سامانه شوند"
        aside={<StatusBadge tone="neutral" label={`${faNum(users.users.length)} کاربر`} />}
        action={mayWrite ? (adding ? "انصراف" : "افزودن کاربر") : undefined}
        onAction={mayWrite ? () => setAdding((v) => !v) : undefined}
      >
        {adding && mayWrite && (
          <form onSubmit={submit} className="mb-4 grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 sm:grid-cols-3">
            <Field label="نام">
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                aria-invalid={Boolean(fieldErrors.name) || undefined}
                className={cn(inputCls, fieldErrors.name && "border-danger-500/60")}
              />
            </Field>
            <Field label="ایمیل">
              <input
                dir="ltr"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                aria-invalid={Boolean(fieldErrors.email) || undefined}
                className={cn(inputCls, "text-left", fieldErrors.email && "border-danger-500/60")}
              />
            </Field>
            <Field label="نقش">
              <select
                value={draft.role}
                onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value as RoleId }))}
                className={inputCls}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r]}
                  </option>
                ))}
              </select>
            </Field>
            {(fieldErrors.name || fieldErrors.email) && (
              <p className="text-[11px] text-danger-400 sm:col-span-3">{fieldErrors.name?.[0] ?? fieldErrors.email?.[0]}</p>
            )}
            <div className="sm:col-span-3">
              <Button type="submit" size="sm" variant="primary" disabled={users.saving}>
                <Plus className="size-3.5" /> ثبت کاربر
              </Button>
            </div>
          </form>
        )}

        {users.loading ? (
          <LoadingState label="در حال بارگذاری کاربران…" />
        ) : users.users.length === 0 ? (
          <EmptyState title="کاربری وجود ندارد" description="هنوز هیچ حساب کاربری در محیط دمو ساخته نشده است." />
        ) : (
          <ul className="space-y-2">
            {users.users.map((u) => {
              const self = u.id === currentUser?.id;
              return (
                <li key={u.id}>
                  <ListRow
                    lead={<Avatar name={u.name} size="sm" />}
                    title={u.name}
                    meta={u.email}
                    end={
                      <>
                        {mayWrite ? (
                          <select
                            value={u.role}
                            aria-label={`نقش ${u.name}`}
                            disabled={users.saving}
                            onChange={(e) => void changeRole(u.id, e.target.value as RoleId)}
                            className="h-8 rounded-lg border border-white/[0.08] bg-ink-850 px-2 text-[11.5px] text-ink-100"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {roleLabels[r]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[11px] text-ink-400">{roleLabels[u.role]}</span>
                        )}
                        <StatusBadge tone={u.status === "active" ? "ok" : "neutral"} label={u.status === "active" ? "فعال" : "غیرفعال"} />
                        {mayWrite && !self && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={users.saving}
                              onClick={() => void toggleStatus(u.id, u.status === "active" ? "disabled" : "active")}
                            >
                              {u.status === "active" ? "غیرفعال‌سازی" : "فعال‌سازی"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`حذف ${u.name}`}
                              disabled={users.saving}
                              className="text-danger-400"
                              onClick={() => void removeUser(u.id, u.name)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="نقش‌ها و دسترسی‌ها" kicker="ماتریس مرکزی دسترسی — مبنای کنترل نمایش در رابط کاربری">
        <ul className="space-y-2">
          {ROLES.map((role) => (
            <ListRow
              key={role}
              title={roleLabels[role]}
              meta={`${faNum(rolePermissions[role].length)} دسترسی · ${faNum(users.users.filter((u) => u.role === role).length)} کاربر`}
              end={<StatusBadge tone={role === "administrator" ? "warn" : "neutral"} label={role === "administrator" ? "دسترسی کامل" : "محدود"} />}
            />
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
          کنترل دسترسی در سمت مرورگر فقط برای تجربهٔ کاربری است. اعمال واقعی مجوزها باید در سرور انجام شود.
        </p>
      </Panel>
    </>
  );
}
