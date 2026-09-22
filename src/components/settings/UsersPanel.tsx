/**
 * Users and access — Settings → کاربران و دسترسی.
 *
 * Two distinct things live here, and they used to be one blurred list:
 *
 *   1. PEOPLE. Accounts that can sign in: name, email, contact number, role,
 *      active/disabled, and the passphrase they sign in with. Every field is
 *      editable, because an academy that cannot correct a typo in someone's email
 *      is not administering its users.
 *
 *   2. ROLES. What each role may do. The matrix ships with sane defaults and an
 *      administrator (`roles.write`) adds or removes individual accesses per
 *      role — a head of department who needs financial read access, a reception
 *      account that must not see invoices. The edit is written through
 *      `RoleRepository` and reaches every signed-in session immediately
 *      (`useRolePolicySync`), not at the next login.
 *
 * ONE PERSON, ONE NAME. An account linked to a teacher record shows that link,
 * and the two records mirror each other on write — renaming the teacher renames
 * the account and the other way round, so this list can no longer disagree with
 * the teachers page.
 *
 * Credentials are a verb, not a field: `setPassword` writes to the auth
 * repository's own store, so a user record can be exported, backed up and
 * displayed without ever carrying a secret.
 */
import { useEffect, useState } from "react";
import { KeyRound, Pencil, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { useAuth } from "@/domains/auth/AuthContext";
import { PERMISSIONS, ROLES, roleLabel, type Permission, type RoleId } from "@/domains/auth/permissions";
import { useUsers } from "@/domains/auth/useUsers";
import { PERMISSION_GROUPS, PERMISSION_LABELS, useRoles } from "@/domains/auth/useRoles";
import { defaultRoleRecord } from "@/domains/auth/roleRepository";
import { MIN_PASSPHRASE_LENGTH } from "@/domains/auth/demoCredentials";
import { useTeachers } from "@/domains/teachers/useTeachers";
import type { AuthUser } from "@/domains/auth/types";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, StatusBadge } from "@/components/ds/primitives";
import { Avatar, Field, ListRow, Panel, Toggle, inputCls } from "@/components/ds/patterns";
import { Dialog } from "@/components/ds/patterns";
import { ConfirmDialog } from "@/components/ds/confirm";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { useEntityForm, type FieldErrors } from "@/domains/shared/useEntityForm";
import { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";
import { cn } from "@/utils/cn";

/** Rows per relation read. Stated, never inherited from the API default. */
const RELATIONS_PER_PAGE = 200;

interface UserDraft {
  name: string;
  email: string;
  phone: string;
  role: RoleId;
  active: boolean;
}

function toDraft(user: AuthUser | undefined): UserDraft {
  return {
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    role: user?.role ?? "staff",
    active: user ? user.status === "active" : true,
  };
}

function validateUser(draft: UserDraft): FieldErrors<UserDraft> {
  const errors: FieldErrors<UserDraft> = {};
  if (draft.name.trim().length < 2) errors.name = "نام باید حداقل ۲ نویسه باشد.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) errors.email = "ایمیل معتبر نیست.";
  if (draft.phone.trim() !== "" && !/^[0-9۰-۹+\-\s()]{6,20}$/.test(draft.phone.trim())) {
    errors.phone = "شمارهٔ تماس معتبر نیست.";
  }
  return errors;
}

/** Create/edit one account, including the passphrase it signs in with. */
function UserFormDialog({
  open,
  user,
  onClose,
  onSaved,
}: {
  open: boolean;
  user?: AuthUser;
  onClose: () => void;
  onSaved: (saved: AuthUser, mode: "create" | "edit", passwordNote: string | null) => void;
}) {
  const editing = user !== undefined;
  const users = useUsers();
  const demoEnvironment = useIsDemoEnvironment();
  const [passphrase, setPassphrase] = useState("");
  const [hasOwnPassword, setHasOwnPassword] = useState(false);
  const [passwordNote, setPasswordNote] = useState<string | null>(null);

  // The dialog answers "does this account already have its own passphrase?" when
  // it opens, so the operator is not guessing whether a reset is needed.
  useEffect(() => {
    if (!open) return;
    setPassphrase("");
    setPasswordNote(null);
    if (!editing) {
      setHasOwnPassword(false);
      return;
    }
    let active = true;
    void users.hasOwnPassword(user.id).then((answer) => {
      if (active) setHasOwnPassword(answer);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  const form = useEntityForm<UserDraft, AuthUser>({
    initial: toDraft(user),
    open,
    validate: validateUser,
    submit: async (draft) => {
      const payload = {
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        role: draft.role,
        status: draft.active ? ("active" as const) : ("disabled" as const),
      };
      // The refusal is thrown so the form renders the repository's own field
      // errors (a duplicate email, an invalid number) exactly like local ones.
      const result = editing ? await users.update(user.id, payload) : await users.create(payload);
      if (result.error) throw result.error;
      return result.value as AuthUser;
    },
    onSuccess: async (saved) => {
      // The credential write is separate and explicit: an empty field means
      // "leave the passphrase alone", not "clear it".
      let note: string | null = null;
      if (saved.id && passphrase.trim() !== "") {
        const outcome = await users.setPassword(saved.id, passphrase.trim());
        note = outcome.error ? outcome.error.message : "گذرواژهٔ ورود نیز تنظیم شد.";
      }
      onSaved(saved, editing ? "edit" : "create", note);
      onClose();
    },
  });

  if (!open) return null;
  const busy = form.submitting;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={editing ? `ویرایش ${user.name}` : "کاربر جدید"}
      description="نام، ایمیل، شمارهٔ تماس، نقش و گذرواژهٔ ورود یک حساب."
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void form.submit()} disabled={busy}>
            {busy ? "در حال ذخیره…" : editing ? "ذخیرهٔ تغییرات" : "افزودن کاربر"}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-3.5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void form.submit();
        }}
      >
        {form.formError && !Object.keys(form.errors).length && (
          <p
            role="alert"
            className="sm:col-span-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400"
          >
            {form.formError.message}
          </p>
        )}

        <Field label="نام و نام خانوادگی" error={form.errors.name} required>
          {(control) => (
            <input
              {...control}
              className={inputCls}
              value={form.draft.name}
              disabled={busy}
              onChange={(e) => form.set("name", e.target.value)}
            />
          )}
        </Field>

        <Field label="ایمیل" error={form.errors.email} hint="شناسهٔ ورود" required>
          {(control) => (
            <input
              {...control}
              dir="ltr"
              className={cn(inputCls, "text-left")}
              value={form.draft.email}
              disabled={busy}
              onChange={(e) => form.set("email", e.target.value)}
            />
          )}
        </Field>

        <Field label="شمارهٔ تماس" error={form.errors.phone} hint="اختیاری">
          {(control) => (
            <input
              {...control}
              dir="ltr"
              inputMode="tel"
              placeholder="09121234567"
              className={cn(inputCls, "nums text-left")}
              value={form.draft.phone}
              disabled={busy}
              onChange={(e) => form.set("phone", e.target.value)}
            />
          )}
        </Field>

        <Field label="نقش" error={form.errors.role} required>
          {(control) => (
            <select
              {...control}
              className={inputCls}
              value={form.draft.role}
              disabled={busy}
              onChange={(e) => form.set("role", e.target.value as RoleId)}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          label={editing ? "گذرواژهٔ جدید" : "گذرواژهٔ ورود"}
          hint={editing ? (hasOwnPassword ? "گذرواژهٔ اختصاصی دارد" : "خالی = بدون تغییر") : "خالی = گذرواژهٔ پیش‌فرض محیط"}
          className="sm:col-span-2"
        >
          {(control) => (
            <div className="flex items-center gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] text-ink-300">
                <KeyRound className="size-4" strokeWidth={1.8} />
              </span>
              <input
                {...control}
                dir="ltr"
                type="password"
                autoComplete="new-password"
                className={cn(inputCls, "nums text-left")}
                placeholder={`حداقل ${faNum(MIN_PASSPHRASE_LENGTH)} نویسه`}
                value={passphrase}
                disabled={busy}
                onChange={(e) => setPassphrase(e.target.value)}
              />
            </div>
          )}
        </Field>

        {passphrase.trim() !== "" && passphrase.trim().length < MIN_PASSPHRASE_LENGTH && (
          <p className="sm:col-span-2 text-[11px] text-danger-400">
            گذرواژه باید حداقل {faNum(MIN_PASSPHRASE_LENGTH)} نویسه باشد.
          </p>
        )}

        <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
          <div>
            <div className="text-[13px] text-ink-50">حساب فعال است</div>
            <div className="mt-0.5 text-[11px] text-ink-400">
              حساب غیرفعال نمی‌تواند وارد سامانه شود، اما سوابقش باقی می‌ماند.
            </div>
          </div>
          <Toggle checked={form.draft.active} onChange={(next) => form.set("active", next)} label="وضعیت حساب" />
        </div>

        <p className="sm:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-ink-400">
          {demoEnvironment
            ? "در محیط محلی، گذرواژه روی همین دستگاه نگه‌داری می‌شود و در فایل پشتیبان یا خروجی‌ها جایی ندارد؛ اعتبارسنجی واقعی ورود کار سرور است."
            : "گذرواژه به سرور فرستاده می‌شود و هرگز در رکورد کاربر ذخیره نمی‌شود."}
          {passwordNote && <span className="mt-1 block text-warn-400">{passwordNote}</span>}
        </p>
      </form>
    </Dialog>
  );
}

/** One role's access, edited by an administrator. */
function RoleMatrixDialog({
  role,
  onClose,
}: {
  role: RoleId | null;
  onClose: () => void;
}) {
  const { notify } = useApp();
  const roles = useRoles();
  const record = roles.roles.find((row) => row.id === role);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState("");
  const [granted, setGranted] = useState<Permission[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!role || !record) return;
    setLabel(record.label);
    setScope(record.scope);
    setGranted([...record.permissions]);
    setError(null);
  }, [role, record]);

  if (!role || !record) return null;
  const busy = roles.saving;
  const defaults = defaultRoleRecord(role);
  const isAdministratorRole = role === "administrator";

  const toggle = (permission: Permission) => {
    setError(null);
    setGranted((prev) => (prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission]));
  };

  const save = async () => {
    const failure = await roles.update(role, { label, scope, permissions: granted });
    if (failure) {
      setError(failure.fields?.permissions?.[0] ?? failure.fields?.label?.[0] ?? failure.message);
      return;
    }
    notify({
      tone: "success",
      title: `دسترسی‌های «${label.trim() || record.label}» به‌روزرسانی شد`,
      detail: "تغییر فوراً روی نشست‌های بازِ همین نقش اعمال می‌شود؛ نیازی به خروج و ورود دوباره نیست.",
    });
    onClose();
  };

  return (
    <Dialog
      open
      onClose={busy ? () => undefined : onClose}
      title={`دسترسی‌های ${record.label}`}
      description="هر دسترسی که بردارید، بخش مربوطه از منو و کنترل‌های نوشتن آن برای این نقش پنهان یا غیرفعال می‌شود."
      footer={
        <>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setLabel(defaults.label);
              setScope(defaults.scope);
              setGranted([...defaults.permissions]);
              setError(null);
            }}
          >
            بازنشانی به پیش‌فرض
          </Button>
          <span className="flex-1" />
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            انصراف
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy}>
            {busy ? "در حال ذخیره…" : "ذخیرهٔ دسترسی‌ها"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="نام نقش" required>
          {(control) => (
            <input
              {...control}
              className={inputCls}
              value={label}
              disabled={busy}
              onChange={(e) => setLabel(e.target.value)}
            />
          )}
        </Field>
        <Field label="شرح دامنهٔ مسئولیت">
          {(control) => (
            <input
              {...control}
              className={inputCls}
              value={scope}
              disabled={busy}
              onChange={(e) => setScope(e.target.value)}
            />
          )}
        </Field>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="mb-2 text-[11px] font-medium text-ink-300">{group.label}</div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {group.permissions.map((permission) => {
                const on = granted.includes(permission);
                const locked = isAdministratorRole && permission === "roles.write";
                return (
                  <button
                    key={permission}
                    type="button"
                    disabled={busy || locked}
                    onClick={() => toggle(permission)}
                    aria-pressed={on}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-right text-[11.5px] transition-colors",
                      on ? "border-gold-500/35 bg-gold-500/10 text-gold-200" : "border-white/[0.06] text-ink-400 hover:border-white/[0.14]",
                      locked && "cursor-not-allowed opacity-70",
                    )}
                  >
                    <span className="truncate">{PERMISSION_LABELS[permission] ?? permission}</span>
                    <span
                      className={cn(
                        "size-3.5 shrink-0 rounded-[5px] border",
                        on ? "border-gold-400 bg-gold-400" : "border-white/25",
                      )}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
        {faNum(granted.length)} دسترسی از {faNum(PERMISSIONS.length)} دسترسی سامانه.{" "}
        {isAdministratorRole && "نقش مدیر ارشد دسترسی «مدیریت نقش‌ها» را همیشه نگه می‌دارد تا راه بازگشت به این صفحه بسته نشود. "}
        کنترل دسترسی در مرورگر برای تجربهٔ کاربری است؛ اجرای واقعی مجوزها باید سمت سرور انجام شود.
      </p>
    </Dialog>
  );
}

/** Real user + role administration, backed by the UserRepository. */
export function UsersPanel() {
  const { notify } = useApp();
  const { can, user: currentUser } = useAuth();
  const users = useUsers();
  const roles = useRoles();
  const teachers = useTeachers({ per_page: RELATIONS_PER_PAGE });
  const demoEnvironment = useIsDemoEnvironment();
  const mayWrite = can("users.write");
  const mayEditRoles = can("roles.write");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AuthUser | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<AuthUser | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [matrixRole, setMatrixRole] = useState<RoleId | null>(null);

  const teacherName = (teacherId?: string) =>
    teacherId ? teachers.items.find((t) => t.id === teacherId)?.name ?? null : null;

  const changeRole = async (id: string, role: RoleId) => {
    const { error } = await users.update(id, { role });
    notify(
      error
        ? { tone: "warning", title: "تغییر نقش انجام نشد", detail: error.message }
        : { tone: "success", title: "نقش کاربر به‌روزرسانی شد" },
    );
  };

  const toggleStatus = async (id: string, next: "active" | "disabled") => {
    const { error } = await users.setStatus(id, next);
    notify(
      error
        ? { tone: "warning", title: "تغییر وضعیت انجام نشد", detail: error.message }
        : { tone: "success", title: next === "active" ? "کاربر فعال شد" : "کاربر غیرفعال شد" },
    );
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { error } = await users.remove(pendingDelete.id);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    notify({ tone: "success", title: `${pendingDelete.name} حذف شد`, detail: "حساب کاربری و گذرواژهٔ او برداشته شد." });
    setPendingDelete(null);
    setDeleteError(null);
  };

  return (
    <>
      <Panel
        title="کاربران"
        kicker="حساب‌هایی که می‌توانند وارد سامانه شوند — نام، ایمیل، شمارهٔ تماس، نقش و گذرواژه"
        aside={<StatusBadge tone="neutral" label={`${faNum(users.users.length)} کاربر`} />}
        action={mayWrite ? "افزودن کاربر" : undefined}
        onAction={
          mayWrite
            ? () => {
                setEditing(undefined);
                setFormOpen(true);
              }
            : undefined
        }
      >
        {users.loading ? (
          <LoadingState label="در حال بارگذاری کاربران…" />
        ) : users.error ? (
          <ErrorState title="بارگذاری کاربران ناموفق بود" description={users.error.message} onRetry={users.reload} />
        ) : users.users.length === 0 ? (
          <EmptyState
            title="کاربری وجود ندارد"
            description="هنوز هیچ حساب کاربری در این محیط ساخته نشده است."
            action={mayWrite ? "افزودن کاربر" : undefined}
            onAction={
              mayWrite
                ? () => {
                    setEditing(undefined);
                    setFormOpen(true);
                  }
                : undefined
            }
          />
        ) : (
          <ul className="space-y-2">
            {users.users.map((u) => {
              const self = u.id === currentUser?.id;
              const linked = teacherName(u.teacherId);
              return (
                <li key={u.id}>
                  <ListRow
                    lead={<Avatar name={u.name} size="sm" />}
                    title={
                      <span className="flex flex-wrap items-center gap-2">
                        <span>{u.name}</span>
                        {self && <StatusBadge tone="gold" label="شما" glyph={false} />}
                        {linked && <StatusBadge tone="violet" label={`مدرس: ${linked}`} glyph={false} />}
                      </span>
                    }
                    meta={
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span dir="ltr" className="nums">
                          {u.email}
                        </span>
                        {u.phone && (
                          <>
                            <span className="text-ink-600">·</span>
                            <span dir="ltr" className="nums">
                              {u.phone}
                            </span>
                          </>
                        )}
                      </span>
                    }
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
                                {roleLabel(r)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[11px] text-ink-400">{roleLabel(u.role)}</span>
                        )}
                        <StatusBadge tone={u.status === "active" ? "ok" : "neutral"} label={u.status === "active" ? "فعال" : "غیرفعال"} />
                        {mayWrite && (
                          <>
                            <Button
                              size="sm"
                              variant="subtle"
                              disabled={users.saving}
                              onClick={() => {
                                setEditing(u);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="size-3.5" /> ویرایش
                            </Button>
                            {!self && (
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
                                  onClick={() => {
                                    setDeleteError(null);
                                    setPendingDelete(u);
                                  }}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </>
                            )}
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

        <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
          حساب‌هایی که به پروندهٔ یک مدرس متصل‌اند، نام و شمارهٔ تماسشان با همان پرونده همگام می‌ماند: تغییر نام مدرس در
          صفحهٔ مدرسین، اینجا هم اعمال می‌شود و برعکس.
        </p>
      </Panel>

      <Panel
        title="نقش‌ها و دسترسی‌ها"
        kicker={
          mayEditRoles
            ? "ماتریس دسترسی — افزودن یا گرفتن دسترسی هر نقش، فوراً روی نشست‌های باز اعمال می‌شود"
            : "ماتریس دسترسی — برای تغییر آن به دسترسی «مدیریت نقش‌ها» نیاز دارید"
        }
        aside={
          roles.error ? <StatusBadge tone="warn" label="خواندن نقش‌ها ناموفق بود" glyph={false} /> : undefined
        }
      >
        {roles.loading ? (
          <LoadingState label="در حال بارگذاری نقش‌ها…" />
        ) : roles.roles.length === 0 ? (
          <EmptyState title="نقشی تعریف نشده" description="نقش‌ها از پیکربندی سامانه خوانده می‌شوند." />
        ) : (
          <ul className="space-y-2">
            {roles.roles.map((role) => (
              <li key={role.id}>
                <ListRow
                  lead={
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] text-gold-400">
                      <ShieldCheck className="size-4" strokeWidth={1.8} />
                    </span>
                  }
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      <span>{role.label}</span>
                      {role.customized && <StatusBadge tone="gold" label="ویرایش‌شده" glyph={false} />}
                    </span>
                  }
                  meta={
                    <span>
                      {role.scope} · {faNum(role.permissions.length)} دسترسی ·{" "}
                      {faNum(users.users.filter((u) => u.role === role.id).length)} کاربر
                    </span>
                  }
                  end={
                    <>
                      <StatusBadge
                        tone={role.id === "administrator" ? "warn" : "neutral"}
                        label={role.id === "administrator" ? "دسترسی کامل" : "محدود"}
                      />
                      {mayEditRoles && (
                        <Button size="sm" variant="subtle" onClick={() => setMatrixRole(role.id)}>
                          <UserCog className="size-3.5" /> ویرایش دسترسی‌ها
                        </Button>
                      )}
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
          کنترل دسترسی در سمت مرورگر فقط برای تجربهٔ کاربری است. اعمال واقعی مجوزها باید در سرور انجام شود
          {demoEnvironment ? "؛ در این محیط تغییرات نقش روی دادهٔ محلی ذخیره می‌شود." : "."}
        </p>
      </Panel>

      <UserFormDialog
        open={formOpen}
        user={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved, mode, passwordNote) =>
          notify({
            tone: passwordNote ? "warning" : "success",
            title: mode === "create" ? `${saved.name || "کاربر جدید"} افزوده شد` : `${saved.name} به‌روزرسانی شد`,
            detail: passwordNote ?? (demoEnvironment ? "تغییرات در دادهٔ محلی ذخیره شد." : "تغییرات ذخیره شد."),
          })
        }
      />

      <RoleMatrixDialog role={matrixRole} onClose={() => setMatrixRole(null)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        busy={users.saving}
        error={deleteError}
        title={`حذف ${pendingDelete?.name ?? ""}`}
        description="حساب کاربری برداشته می‌شود و دیگر نمی‌تواند وارد سامانه شود."
        consequences={[
          "نشست بازِ این حساب بلافاصله بی‌اعتبار می‌شود.",
          "گذرواژهٔ او نیز پاک می‌شود.",
          "پروندهٔ مدرس یا هنرجوی متصل به این حساب حذف نمی‌شود؛ فقط دسترسی ورودش برداشته می‌شود.",
        ]}
        confirmLabel="حذف حساب"
        onConfirm={() => void confirmDelete()}
        onClose={() => {
          if (!users.saving) setPendingDelete(null);
        }}
      />
    </>
  );
}
