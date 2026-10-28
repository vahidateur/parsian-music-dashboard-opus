<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Auth\AuthService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Support\Api\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class AuthController extends Controller
{
    public function __construct(private readonly AuthService $auth) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $validated = $request->validated();

        return ApiResponse::item($this->auth->login($validated['email'], $validated['password']));
    }

    public function logout(Request $request): Response
    {
        $this->auth->logout($request->user());

        return ApiResponse::noContent();
    }

    public function me(Request $request): JsonResponse
    {
        return ApiResponse::item($this->auth->me($request->user()));
    }
}
