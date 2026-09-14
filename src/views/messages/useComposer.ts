/**
 * Composer state for one conversation at a time.
 *
 * WHY THIS IS A KEYED STATE AND NOT `useState("")`
 *
 * The composer belongs to a conversation. A plain `useState` belongs to the
 * component, which stays mounted across a thread switch — so its contents
 * outlive the conversation they were typed for. That is the same defect class
 * as I13's stale page, moved into the write path: text drafted for teacher A,
 * still sitting in the box after the operator clicks thread B, and one Enter
 * away from being sent to B. Nothing downstream can catch it — the send the
 * operator intended and the send that happens are identical by the time the
 * repository is called.
 *
 * So the state carries the conversation it describes, and what the hook exposes
 * is **derived at render** from `state.key === key` rather than fixed in an
 * effect afterwards. The frame that switches conversation therefore already
 * shows an empty composer and no pending attachment: there is no committed
 * frame in which A's text sits under B's header, which is exactly the shape
 * I13's Checkpoint 1 established for reads and this hook mirrors for this one
 * piece of write state.
 *
 * The pending attachment is reset for the same reason: a file chosen for A is
 * A's, and carrying it into B would attach it to the wrong conversation.
 *
 * SCOPE (M6 / CP2, extended by CP3)
 *
 * CP2 owns this state and its isolation; CP3 wired the control that populates
 * it (`AttachmentPicker` → `AttachmentStatus` → `Messages.send`). The pending
 * file is still only a `File`: it becomes a persisted attachment when the send
 * path stores it through `MediaRepository` and the message records its id.
 *
 * `attachmentError` is part of the same record for the same reason the file is:
 * a validation reason belongs to the conversation whose picker produced it, so
 * switching threads cannot leave A's «این قالب مجاز نیست» sitting under B.
 */
import { useCallback, useEffect, useState } from "react";

export interface ComposerState {
  /** Text of the message being composed, for the ACTIVE conversation only. */
  draft: string;
  setDraft: (value: string) => void;
  /**
   * The file chosen for the next message, held until it is sent.
   * `null` when there is none — never `undefined`, so the empty case is explicit.
   */
  pendingAttachment: File | null;
  setPendingAttachment: (file: File | null) => void;
  /**
   * Why the last picked file was refused — the client-side validation reason, in
   * the same words the media repository uses. `null` when nothing was refused.
   *
   * It lives here rather than in the field component so it is keyed to the
   * conversation like every other piece of composer state.
   */
  attachmentError: string | null;
  setAttachmentError: (message: string | null) => void;
  /** Drops the pending file and its refusal; leaves the draft untouched. */
  clearAttachment: () => void;
  /**
   * Clears both fields, but ONLY if `conversationId` is still the conversation
   * on screen.
   *
   * A send is asynchronous: the operator can switch threads while it is in
   * flight. Calling an unconditional reset on resolution would wipe the draft
   * they have since started typing in the NEW conversation — a data-loss bug
   * that only appears under a slow send, which is why the guard lives here
   * rather than in a comment at the call site.
   */
  clearFor: (conversationId: string) => void;
}

interface ComposerRecord {
  /** The conversation this record describes. */
  key: string;
  draft: string;
  attachment: File | null;
  attachmentError: string | null;
}

const EMPTY = (key: string): ComposerRecord => ({ key, draft: "", attachment: null, attachmentError: null });

export function useComposer(conversationId: string | undefined): ComposerState {
  const key = conversationId ?? "";
  const [state, setState] = useState<ComposerRecord>(() => EMPTY(key));

  // Derived, not stored: see the header. A record belonging to another
  // conversation is not this conversation's composer state.
  const active = state.key === key ? state : EMPTY(key);

  const setDraft = useCallback(
    (value: string) => {
      setState((current) => ({
        // Rebasing on the current key means a typed value can never be written
        // onto the record of the conversation the operator just left.
        ...(current.key === key ? current : EMPTY(key)),
        draft: value,
      }));
    },
    [key],
  );

  const setPendingAttachment = useCallback(
    (file: File | null) => {
      setState((current) => ({
        ...(current.key === key ? current : EMPTY(key)),
        attachment: file,
      }));
    },
    [key],
  );

  const setAttachmentError = useCallback(
    (message: string | null) => {
      setState((current) => ({
        ...(current.key === key ? current : EMPTY(key)),
        attachmentError: message,
      }));
    },
    [key],
  );

  const clearAttachment = useCallback(() => {
    setState((current) => ({
      ...(current.key === key ? current : EMPTY(key)),
      attachment: null,
      attachmentError: null,
    }));
  }, [key]);

  const clearFor = useCallback((conversationId: string) => {
    setState((current) => (current.key === conversationId ? EMPTY(conversationId) : current));
  }, []);

  /*
    The derived value above hides the previous conversation's text from the very
    frame the selection changes; this effect then DISCARDS it, so the reset is
    permanent rather than a single-slot cache that reappears on the way back.
    Both halves are needed and they answer different questions:

      - derivation  — can the old text be READ under the new conversation's
                      header, for even one committed frame? (no)
      - discard     — does the old text still exist to reappear if the operator
                      switches back? (also no)

    It is deliberately not the reverse order: an effect alone runs after the
    commit, so the leaked frame would still happen. And it never touches a
    record that already belongs to `key`, so text typed after the switch — which
    `setDraft` rebases onto the new conversation — cannot be cleared by it.
  */
  useEffect(() => {
    setState((current) => (current.key === key ? current : EMPTY(key)));
  }, [key]);

  return {
    draft: active.draft,
    setDraft,
    pendingAttachment: active.attachment,
    setPendingAttachment,
    attachmentError: active.attachmentError,
    setAttachmentError,
    clearAttachment,
    clearFor,
  };
}
