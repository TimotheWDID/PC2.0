<p style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.6; color: #111827;">
	<strong>{{ $subject }}</strong>
</p>

<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.7; color: #111827; white-space: pre-wrap;">
	{{ $body }}
</div>

@if (!empty($mailFooter['enabled'] ?? false) && !empty(trim((string) ($mailFooter['content'] ?? ''))))
<hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;">
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #4b5563; white-space: pre-wrap;">
	{!! nl2br(e($mailFooter['content'])) !!}
    @if (!empty(trim((string) ($mailFooter['image_url'] ?? ''))))
	<img src="{{ $mailFooter['image_url'] }}" alt="{{ $mailFooter['image_alt'] ?? 'Logo SupportPC' }}" style="max-width: 220px; height: auto; display: block; margin-bottom: 12px;">
	@endif
</div>
@endif
