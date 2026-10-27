<?php

/*
 * Server copy of the permission model in src/domains/auth/permissions.ts and
 * the default role labels/scopes in src/domains/auth/roleRepository.ts.
 *
 * This is the ONLY permission vocabulary the backend knows. Adding an id here
 * is a governance decision, not an implementation detail.
 */

$vocabulary = [
    'students.read',
    'students.write',
    'teachers.read',
    'teachers.write',
    'classes.read',
    'classes.write',
    'schedule.read',
    'schedule.write',
    'attendance.read',
    'attendance.write',
    'finance.read',
    'finance.write',
    // Paying is a desk verb, not an accounting verb: the receptionist at the
    // academy's terminal (and the manager overseeing them) confirms card and
    // POS payments, while issuing stays with administrator/accountant
    // (DECISIONS §41).
    'finance.pay',
    'messages.read',
    'messages.write',
    'library.read',
    'library.write',
    // Authorized by the owner for v1 on 2026-10-03 (DECISIONS.md §29). PB-3 was
    // lifted for Progress ONLY at the time; instruments (§33), learning (§34)
    // and rooms (§35) followed. No domain remains blocked.
    'progress.read',
    'progress.write',
    // Lifted for Instruments on 2026-10-23 (DECISIONS.md §33). PB-3 then
    // covered learning and rooms; both have since been lifted (§34, §35), so
    // no domain remains blocked. Same rule throughout: the ids are created
    // rather than reused, because §26.3 forbids the reuse.
    // Vocabulary: 25 → 27.
    'instruments.read',
    'instruments.write',
    // Lifted for Learning on 2026-10-24 (DECISIONS.md §34). Same rule as
    // instruments: the ids are created rather than reusing a neighbour's,
    // because §26.3 forbids the reuse. Vocabulary: 27 → 29.
    'learning.read',
    'learning.write',
    // Lifted for Rooms on 2026-10-24 (DECISIONS.md §35). Same rule again:
    // created, never borrowed. Vocabulary: 29 → 31. PB-3 has no blocked
    // domain left.
    'rooms.read',
    'rooms.write',
    // Lifted for Gallery on 2026-10-24 (DECISIONS.md §36). Same rule again:
    // created, never borrowed — §26.3 forbids reinterpreting `library.write`
    // as gallery management, which is what the demo-era frontend did (X-02).
    // Vocabulary: 31 → 33.
    'gallery.read',
    'gallery.write',
    // The details panel (caption, album, date, number, notes) is shown only
    // down to reception: teachers open the showcase but see bare photographs.
    // Display-only — the bytes and metadata stay authorized by gallery.read;
    // this id only controls the furnished readout (§40 follow-up).
    'gallery.details',
    // Lifted for Branding on 2026-10-26 (DECISIONS.md §38). Same rule again:
    // created, never borrowed — §26.3 forbids reinterpreting `settings.write`
    // as branding management, which is what the demo-era frontend did by
    // gating the whole panel on it. Vocabulary: 33 → 35.
    'branding.read',
    'branding.write',
    'reports.read',
    'settings.read',
    'settings.write',
    'users.read',
    'users.write',
    'roles.write',
    'demo.manage',
];

$readOnlyCore = [
    'students.read',
    'teachers.read',
    'classes.read',
    'schedule.read',
    'library.read',
    // Progress is per-student learning data, so it reads like the rest of the
    // per-student core: everyone who teaches or administers, never accounting.
    'progress.read',
    // Instruments are the lookup table every record that carries an
    // `instrument` field resolves against (students, teachers, classes,
    // resources, pieces). Reading them is reading a name, never personal data,
    // so every role that may see such a record needs it — accounting included,
    // which is why §33 grants it explicitly to `accountant` as well (it is not
    // part of the `$readOnlyCore` spread into that role's list).
    'instruments.read',
    // Learning programs, levels and their material are the curriculum every
    // teaching and reception role works with — the manager who curates it,
    // the teacher who places students in it, and the staff who register
    // students into it. Accounting never opens a learning surface.
    'learning.read',
    // Rooms are the lookup table every record that carries a `roomId` field
    // resolves against (classes, sessions). Reading them is reading a name,
    // never personal data — the same reason instruments.read is universal,
    // and why §35 grants it explicitly to `accountant` as well.
    'rooms.read',
    // Gallery albums and images are the academy's showcase, read by every
    // role that opens the gallery view — the same teaching and reception
    // audience as the rest of the read-only core. Accounting never opens
    // the gallery (it holds no `library.read` either), so — unlike rooms
    // and instruments — there is no explicit accountant grant.
    'gallery.read',
    // Academy identity renders on every authenticated surface (sidebar, top
    // bar, hero, login-adjacent views) — reading it is never personal data,
    // the strongest case of all: the name is already on the public login
    // page. Accounting included, explicitly like rooms and instruments.
    'branding.read',
];

return [
    'vocabulary' => $vocabulary,

    'roles' => ['administrator', 'manager', 'teacher', 'staff', 'accountant'],

    'defaults' => [
        'administrator' => $vocabulary,
        'manager' => [
            ...$readOnlyCore,
            'students.write',
            'teachers.write',
            'classes.write',
            'schedule.write',
            'attendance.read',
            'attendance.write',
            'finance.read',
            // The manager oversees desk payments as well as reading finance.
            'finance.pay',
            'messages.read',
            'messages.write',
            'library.write',
            'instruments.write',
            'progress.write',
            // The curriculum is authored like repertoire: the manager curates
            // it the way they curate the library. Mirrors `library.write`.
            'learning.write',
            // Rooms are academy configuration, curated like instruments: the
            // manager defines them, nobody else writes them.
            'rooms.write',
            // The showcase is curated the same way: the manager composes
            // albums, nobody else writes them. Teachers open the gallery
            // view (read) but do not curate it — the sidebar never offered
            // them the controls, and the server does not either.
            'gallery.write',
            // The furnished readout is shown down to reception; teachers see
            // bare photographs (§40 follow-up).
            'gallery.details',
            'reports.read',
            'settings.read',
            'users.read',
        ],
        'teacher' => [
            ...$readOnlyCore,
            'attendance.read',
            'attendance.write',
            'messages.read',
            'messages.write',
            // Assignments are teacher-authored, the way attendance entries are.
            // The permission carries this; nothing authorizes on role === "teacher".
            'progress.write',
            // Placements are teacher-authored the same way: a teacher may
            // legitimately place a transferring student without owning the
            // curriculum. Mirrors `progress.write`.
            'learning.write',
        ],
        'staff' => [
            ...$readOnlyCore,
            'students.write',
            'schedule.write',
            'attendance.read',
            'messages.read',
            'messages.write',
            'reports.read',
            // The desk confirms POS and card-to-card payments on the spot.
            'finance.pay',
            // The furnished gallery readout is shown down to reception.
            'gallery.details',
        ],
        'accountant' => [
            'students.read',
            'classes.read',
            'instruments.read',
            'rooms.read',
            // The academy's own name renders on every authenticated surface —
            // reading it is never personal data, so accounting reads it too,
            // the same explicit grant as rooms and instruments (§38).
            'branding.read',
            'finance.read',
            'finance.write',
            // Accounting issues and confirms; the token user is recorded.
            'finance.pay',
            'reports.read',
            'messages.read',
        ],
    ],

    'labels' => [
        'administrator' => 'مدیر ارشد',
        'manager' => 'مدیر آموزشگاه',
        'teacher' => 'مدرس',
        'staff' => 'پذیرش',
        'accountant' => 'مالی',
    ],

    'scopes' => [
        'administrator' => 'دسترسی کامل به همهٔ بخش‌ها',
        'manager' => 'مدیریت آموزشی، برنامه‌ریزی و گزارش‌ها',
        'teacher' => 'کلاس‌های خود، حضور و غیاب، کتابخانه',
        'staff' => 'هنرجویان، برنامه‌ریزی، پیام‌ها',
        'accountant' => 'فاکتورها، پرداخت‌ها، گزارش مالی',
    ],
];
