<?php

namespace App\Actions\Fortify;

use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Laravel\Fortify\Contracts\UpdatesUserProfileInformation;

class UpdateUserProfileInformation implements UpdatesUserProfileInformation
{
    /**
     * Validate and update the given user's profile information.
     */
    public function update(User $user, array $input): void
    {
        Validator::make($input, [
            'first_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'default_notification_preference' => ['nullable', 'string', Rule::in(['Email', 'SMS', 'None'])],
        ])->validateWithBag('updateProfileInformation');

        $user->forceFill([
            'first_name' => $input['first_name'] ?? $user->first_name,
            'last_name' => $input['last_name'] ?? $user->last_name,
            'email' => $input['email'],
            'default_notification_preference' => $input['default_notification_preference'] ?? $user->default_notification_preference,
        ])->save();
    }
}