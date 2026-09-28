/**
 * Demo implementation of the user directory — DEMO DATA, isolated on purpose.
 *
 * Moved verbatim out of `./userRepository` so the SHARED file (input
 * validation + the REST implementation) no longer imports the demo store.
 * That import was not dead weight: the module-scope demo-store singleton made
 * every co-located importer pull the entire demo persistence graph — store,
 * seed, backup, showcase photographs — into the CLIENT bundle even when the
 * Demo class itself was tree-shaken. Composition isolation has to live at the
 * FILE boundary too, not only at the registry (Phase 2A §8).
 *
 * The validation/error helpers stay in `./userRepository` (single copies,
 * shared with the REST implementation) and are imported from there.
 */
import { demoStore, type DemoStore } from "@/services/demoStore";
import { demoCredentialStore, type DemoCredentialStore } from "./demoCredentials";
import { isAcceptablePassphrase } from "./passphrase";
import type { Page } from "@/api/types";
import type { UserRepository } from "./repository";
import type { AuthUser, CreateUserInput, UpdateUserInput } from "./types";
import { emailTaken, notFound, validateUserInput, weakPassphrase } from "./userRepository";

/** Demo implementation — delegates persistence to the single DemoStore. */
export class DemoUserRepository implements UserRepository {
  constructor(
    private readonly store: DemoStore = demoStore,
    private readonly credentials: DemoCredentialStore = demoCredentialStore(),
  ) {}

  async list(): Promise<Page<AuthUser>> {
    const data = this.store.users.all();
    return { data, meta: { page: 1, per_page: data.length || 25, total: data.length } };
  }

  async get(id: string): Promise<AuthUser> {
    const found = this.store.users.find(id);
    if (!found) throw notFound(id);
    return found;
  }

  async create(input: CreateUserInput): Promise<AuthUser> {
    const invalid = validateUserInput(input, true);
    if (invalid) throw invalid;
    if (this.emailTaken(input.email)) throw emailTaken();
    return this.store.users.create({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
      status: input.status ?? "active",
    });
  }

  async update(id: string, input: UpdateUserInput): Promise<AuthUser> {
    const invalid = validateUserInput(input, false);
    if (invalid) throw invalid;
    if (input.email && this.emailTaken(input.email, id)) throw emailTaken();
    const updated = this.store.users.update(id, {
      ...input,
      ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
    });
    if (!updated) throw notFound(id);
    this.syncTeacher(updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.store.users.remove(id)) throw notFound(id);
    // A credential must not outlive the account it belonged to.
    this.credentials.clear(id);
  }

  async setPassword(id: string, passphrase: string): Promise<void> {
    if (!this.store.users.find(id)) throw notFound(id);
    if (passphrase === "") {
      this.credentials.clear(id);
      return;
    }
    if (!isAcceptablePassphrase(passphrase)) throw weakPassphrase();
    this.credentials.set(id, passphrase.trim());
  }

  async hasOwnPassword(id: string): Promise<boolean> {
    return this.credentials.has(id);
  }

  /**
   * ONE PERSON, ONE NAME.
   *
   * An account linked to a teacher record (`teacherId`) is the same human the
   * teachers view edits. Renaming one and not the other is what made the panel
   * look unsynchronized — Settings showed the old name next to the new one — so
   * the write propagates here, in the repository, where every caller passes
   * through. The API implementation leaves this to the server, which owns both
   * tables.
   */
  private syncTeacher(user: AuthUser): void {
    if (!user.teacherId) return;
    const teacher = this.store.teachers.find(user.teacherId);
    if (!teacher) return;
    const patch: { name?: string; phone?: string } = {};
    if (user.name && teacher.name !== user.name) patch.name = user.name;
    if (user.phone && teacher.phone !== user.phone) patch.phone = user.phone;
    if (Object.keys(patch).length > 0) this.store.teachers.update(teacher.id, patch);
  }

  private emailTaken(email: string, exceptId?: string): boolean {
    const target = email.trim().toLowerCase();
    return this.store.users.all().some((u) => u.email.toLowerCase() === target && u.id !== exceptId);
  }
}
