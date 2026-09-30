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
    'messages.read',
    'messages.write',
    'library.read',
    'library.write',
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
            'messages.read',
            'messages.write',
            'library.write',
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
        ],
        'staff' => [
            ...$readOnlyCore,
            'students.write',
            'schedule.write',
            'attendance.read',
            'messages.read',
            'messages.write',
            'reports.read',
        ],
        'accountant' => [
            'students.read',
            'classes.read',
            'finance.read',
            'finance.write',
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
