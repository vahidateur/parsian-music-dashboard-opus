<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * One tuition invoice of an organization.
 *
 * Composite primary key `(organization_id, id)`, like the other domains.
 *
 * v1 is deliberately narrow (DECISIONS.md §40): an invoice is issued due and
 * discharged by exactly one accepted payment. There are no partial payments
 * and paying never touches the student's own `balance` — that sync is a
 * later, owner-approved step, not a silent side effect smuggled into v1.
 *
 * @property string $organization_id
 * @property string $id
 * @property string $student_id
 * @property string $title
 * @property int $amount
 * @property string $status
 * @property string $issued_at
 * @property string|null $due_at
 * @property string|null $paid_at
 * @property string|null $paid_by_user_id
 * @property string|null $paid_method
 * @property string|null $paid_reference
 */
class Invoice extends Model
{
    /** @use HasFactory<\Database\Factories\InvoiceFactory> */
    use BelongsToOrganization, HasFactory;

    public const STATUSES = ['due', 'paid'];

    /** How the accepted payment arrived. */
    public const PAY_METHODS = ['pos', 'transfer'];

    protected $table = 'invoices';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'student_id', 'title', 'amount', 'status',
        'issued_at', 'due_at', 'paid_at', 'paid_by_user_id',
        'paid_method', 'paid_reference',
    ];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'issued_at' => 'datetime',
            'due_at' => 'date',
            'paid_at' => 'datetime',
        ];
    }
}
