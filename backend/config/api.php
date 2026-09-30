<?php

return [
    // Pagination: `per_page` defaults to this value when absent.
    'default_per_page' => 25,

    // Server cap: larger `per_page` values are clamped, not rejected.
    'max_per_page' => 100,
];
