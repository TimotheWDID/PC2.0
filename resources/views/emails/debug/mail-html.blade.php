<p style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.6; color: #111827;">
	<strong>{{ $subject }}</strong>
</p>

<p style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #374151; margin: 14px 0 6px;">
	Bonjour,
</p>

<p style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #374151; margin: 0 0 14px;">
	Vous avez un nouveau message sur votre ticket support.
</p>

<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.7; color: #111827; white-space: pre-wrap;">
	{{ $body }}
</div>

@php
	$footerEnabled = !empty($mailFooter['enabled'] ?? false);
	$footerText = trim((string) ($mailFooter['content'] ?? ''));
	$footerImage = trim((string) ($mailFooter['image_url'] ?? ''));
	$hasFooterText = $footerEnabled && $footerText !== '';
	$hasFooterImage = $footerEnabled && $footerImage !== '';
@endphp

@if ($hasFooterText || $hasFooterImage)
<hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;">
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #4b5563; white-space: pre-wrap;">
	@if ($hasFooterImage)
	<img src="{{ $footerImage }}" alt="{{ $mailFooter['image_alt'] ?? 'Logo SupportPC' }}" style="max-width: 140px; height: auto; display: block; margin-bottom: 10px;">
	@endif

	@if ($hasFooterText)
	{!! nl2br(e($footerText)) !!}
	@endif
</div>
@endif

@if (! $hasFooterText)
<p style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #4b5563; margin-top: 20px;">
	Cordialement,<br>
	{{ config('app.name') }}
</p>
@endif
