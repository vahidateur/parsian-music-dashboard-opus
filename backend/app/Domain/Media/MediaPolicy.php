<?php

namespace App\Domain\Media;

use App\Domain\Students\StudentAccessPolicy;
use App\Models\ChatParticipant;
use App\Models\MediaAsset;
use App\Models\Student;
use App\Models\User;
use App\Support\Api\ApiException;
use App\Support\Authorization\PermissionGate;
use Illuminate\Database\Eloquent\Builder;

/**
 * Media authorization — per object, against the record that shows the asset.
 *
 * WHY THERE IS NO `media.read` PERMISSION
 * A stored binary has no meaning on its own: a photo is a student's or a
 * teacher's, a file belongs to a catalogue row. So reading the BYTES is
 * reading the record that references it, and it is authorized by THAT
 * record's own rule:
 *
 *   - a photo on a student → the actor must be able to read that student,
 *     scope included (T-02: a teacher sees only the students of their own
 *     classes, so a teacher's bytes stay a teacher's business);
 *   - a photo on a teacher → `teachers.read`;
 *   - a file on a library resource → `library.read`;
 *   - an image on an instrument → `instruments.read` (the catalogue is a
 *     lookup table every authenticated role may read);
 *   - a gallery image or album cover → `gallery.read` (the showcase every
 *     teaching and reception role may open);
 *   - an academy logo or favicon → `branding.read` (identity every
 *     authenticated role may open);
 *   - teaching material → `learning.read` (the curriculum every teaching and
 *     reception role works with);
 *   - an asset NOTHING references yet (a freshly uploaded, not yet attached
 *     file) → the session that uploaded it, and nobody else.
 *
 *   A chat attachment is read like any other parent: the actor must hold
 *   `messages.read` AND participate in the thread that carries it. Knowing
 *   the asset id is never enough.
 *
 * A generic "anyone with library.read may fetch every byte in the
 * organization" rule would hand every teacher every student's photo — the
 * exact leak the scope rule exists to prevent.
 *
 * WHY THE UPLOAD GATE IS A COMPOUND
 * There is no `media.write` id in the shipped vocabulary, and adding one is a
 * governance decision, not an implementation detail. Rather than invent an id
 * or borrow a neighbouring one to stand in for it, the gate says what it
 * means: you may stage a binary if you may write at least one kind of record
 * that can carry one — a student photo (`students.write`), a teacher photo
 * (`teachers.write`), a library file (`library.write`), an instrument image
 * (`instruments.write`, §31), a gallery image (`gallery.write`, §36) or a
 * chat attachment (`messages.write`, §37) or an academy logo
 * (`branding.write`, §38).
 *
 * An actor with none of them (the accountant) cannot upload; an actor with
 * one of them (the staff member who registers students, the teacher who
 * writes to their own threads, the manager who curates instruments and the
 * showcase, the administrator who curates identity) can. The decision that
 * this should become a first-class `media.write` id — and who holds it — is
 * the OWNER's, and is listed as an open question in the change notes.
 */
final class MediaPolicy
{
    /**
     * The write permissions that can carry a binary. Used by the upload gate
     * and by the delete gate.
     */
    private const MEDIA_BEARING_WRITES = ['students.write', 'teachers.write', 'library.write', 'instruments.write', 'gallery.write', 'messages.write', 'branding.write'];

    public function __construct(
        private readonly PermissionGate $gate,
        private readonly StudentAccessPolicy $students,
        private readonly MediaReferences $references,
    ) {}

    /**
     * May the actor stage a new binary?
     *
     * The answer is "may you write at least one record that can carry one".
     */
    public function authorizeUpload(User $actor): void
    {
        foreach (self::MEDIA_BEARING_WRITES as $permission) {
            if ($this->gate->allows($actor, $permission)) {
                return;
            }
        }

        throw new ApiException(
            403,
            'FORBIDDEN',
            'شما دسترسی لازم برای بارگذاری فایل را ندارید.',
            [],
            ['permission' => 'students.write', 'permissions' => self::MEDIA_BEARING_WRITES],
        );
    }

    /**
     * May the actor read THIS asset's bytes?
     *
     * The asset belongs to the record that references it, and to the session
     * that uploaded it ONLY while nothing references it yet:
     *
     *   - attached to a student → the actor must be able to read that student,
     *     scope included (T-02: a teacher sees only the students of their own
     *     classes, so a teacher's bytes stay a teacher's business);
     *   - attached to a teacher → `teachers.read`;
     *   - attached to a library resource → `library.read`;
     *   - attached to an instrument → `instruments.read`;
     *   - attached to a gallery image or an album cover → `gallery.read`;
     *   - attached to the academy logo or favicon → `branding.read`;
     *   - attached to a chat message → `messages.read`, and only inside a
     *     thread the actor participates in (knowing the asset id is never
     *     enough);
     *   - attached to teaching material → `learning.read`;
     *   - attached to NOTHING yet (a freshly uploaded, not yet attached file)
     *     → the session that uploaded it, and nobody else.
     *
     * The uploader branch deliberately does NOT survive the attachment: once
     * a record points at the asset, that record's rule decides — otherwise
     * "I uploaded it" would be a way around the scope rule.
     */
    public function authorizeReadAsset(User $actor, MediaAsset $asset, MediaReferences $references): void
    {
        if ($this->canReadStudentPhotos($actor, $asset, $references)) {
            return;
        }
        if ($this->gate->allows($actor, 'teachers.read') && $references->teacherMediaIds()->contains($asset->id)) {
            return;
        }
        if ($this->gate->allows($actor, 'library.read') && $references->resourceMediaIds()->contains($asset->id)) {
            return;
        }
        if ($this->gate->allows($actor, 'instruments.read') && $references->instrumentMediaIds()->contains($asset->id)) {
            return;
        }
        if ($this->gate->allows($actor, 'gallery.read') && ($references->galleryImageMediaIds()->contains($asset->id) || $references->galleryCoverMediaIds()->contains($asset->id))) {
            return;
        }
        if ($this->gate->allows($actor, 'messages.read') && $references->chatMessageMediaIdsInConversations($this->participatingConversationIds($actor))->contains($asset->id)) {
            return;
        }
        if ($this->gate->allows($actor, 'learning.read') && $references->learningContentMediaIds()->contains($asset->id)) {
            return;
        }
        if ($this->gate->allows($actor, 'branding.read') && $references->brandingMediaIds()->contains($asset->id)) {
            return;
        }

        // Nothing references it: it is a staged upload, and only its own
        // session may read it.
        if (! $references->isStillReferenced($asset->id) && $asset->uploaded_by !== null && $asset->uploaded_by === $actor->id) {
            return;
        }

        throw new ApiException(
            403,
            'FORBIDDEN',
            'شما دسترسی لازم برای دیدن این فایل را ندارید.',
            [],
            ['permission' => 'media.read'],
        );
    }

    /**
     * May the actor free this asset?
     *
     * The uploader may always free what they staged; otherwise the same
     * compound write gate applies. Whether the bytes may be freed AT ALL is a
     * separate question — a still-referenced asset is refused with 409 by the
     * service, not here.
     */
    public function authorizeDelete(User $actor, MediaAsset $asset): void
    {
        if ($asset->uploaded_by !== null && $asset->uploaded_by === $actor->id) {
            return;
        }

        $this->authorizeUpload($actor);
    }

    /**
     * The ids of the assets the actor may SEE.
     *
     * The list is a projection of what the actor may read, not the
     * organization's whole media table: a photo of a student outside the
     * actor's scope is not listed, and a library file is not listed to an
     * actor without `library.read` — listing an id the actor cannot open is
     * the same leak as serving the file.
     *
     * @return list<string>
     */
    public function visibleMediaIds(User $actor): array
    {
        $ids = [];

        if ($this->gate->allows($actor, 'students.read')) {
            $studentIds = $this->references->studentMediaIds(
                fn (Builder $query): Builder => $this->students->scopeQuery($query, $actor),
            );
            if ($studentIds->isNotEmpty()) {
                $ids = array_merge($ids, $studentIds->all());
            }
        }

        if ($this->gate->allows($actor, 'teachers.read')) {
            $teacherIds = $this->references->teacherMediaIds();
            if ($teacherIds->isNotEmpty()) {
                $ids = array_merge($ids, $teacherIds->all());
            }
        }

        if ($this->gate->allows($actor, 'library.read')) {
            $resourceIds = $this->references->resourceMediaIds();
            if ($resourceIds->isNotEmpty()) {
                $ids = array_merge($ids, $resourceIds->all());
            }
        }

        if ($this->gate->allows($actor, 'gallery.read')) {
            $galleryIds = $this->references->galleryImageMediaIds()->merge($this->references->galleryCoverMediaIds());
            if ($galleryIds->isNotEmpty()) {
                $ids = array_merge($ids, $galleryIds->all());
            }
        }

        if ($this->gate->allows($actor, 'messages.read')) {
            $chatIds = $this->references->chatMessageMediaIdsInConversations($this->participatingConversationIds($actor));
            if ($chatIds->isNotEmpty()) {
                $ids = array_merge($ids, $chatIds->all());
            }
        }

        if ($this->gate->allows($actor, 'learning.read')) {
            $learningIds = $this->references->learningContentMediaIds();
            if ($learningIds->isNotEmpty()) {
                $ids = array_merge($ids, $learningIds->all());
            }
        }

        if ($this->gate->allows($actor, 'branding.read')) {
            $brandingIds = $this->references->brandingMediaIds();
            if ($brandingIds->isNotEmpty()) {
                $ids = array_merge($ids, $brandingIds->all());
            }
        }

        if ($this->gate->allows($actor, 'instruments.read')) {
            $instrumentIds = $this->references->instrumentMediaIds();
            if ($instrumentIds->isNotEmpty()) {
                $ids = array_merge($ids, $instrumentIds->all());
            }
        }

        // The actor's own STAGED uploads — an asset nothing references yet is
        // visible to the session that created it. An asset their own upload
        // later attached to a record they may not read is NOT theirs to see.
        $referenced = $this->references->allReferencedMediaIds();
        $own = MediaAsset::query()->where('uploaded_by', $actor->id)->pluck('id')->all();
        $staged = array_values(array_diff($own, $referenced->all()));
        if ($staged !== []) {
            $ids = array_merge($ids, $staged);
        }

        return array_values(array_unique($ids));
    }

    /**
     * The threads the actor participates in.
     *
     * Participation is the chat read boundary everywhere: bytes, lists and
     * threads all answer against this set, so a non-participant and a
     * stranger get the same answer.
     *
     * @return \Illuminate\Support\Collection<int, string>
     */
    private function participatingConversationIds(User $actor): \Illuminate\Support\Collection
    {
        return ChatParticipant::query()->where('user_id', $actor->id)->pluck('conversation_id');
    }

    /**
     * The student's own rule, scope included: the actor must hold
     * `students.read` AND the student that carries THIS photo must be inside
     * the actor's scope. A photo of a student outside the scope stays
     * unreadable even though other students' photos are visible.
     */
    private function canReadStudentPhotos(User $actor, MediaAsset $asset, MediaReferences $references): bool
    {
        if (! $this->gate->allows($actor, 'students.read')) {
            return false;
        }

        $ids = $references->studentMediaIds(
            fn (Builder $query): Builder => $this->students->scopeQuery($query, $actor),
        );

        return $ids->contains($asset->id);
    }
}
