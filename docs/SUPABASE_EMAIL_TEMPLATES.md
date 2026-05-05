# SUPABASE_EMAIL_TEMPLATES

HandiBowls-branded drafts for the six Supabase auth email templates. Operator pastes each into Supabase Dashboard → Authentication → Email Templates after this commit lands.

## Operator setup checklist

1. Sign in to the Supabase Dashboard for the demo project (`crahegkboinnhffabkxc`).
2. Navigate to **Authentication → Email Templates**.
3. For each of the 6 templates below: paste the **Subject** + **HTML body** verbatim. Save.
4. Confirm the **Site URL** (Authentication → URL Configuration) is the Vercel preview URL (`https://handibowls-...-andrews-projects-a0c14c4f.vercel.app`) — this is the host the templates' `{{ .SiteURL }}` variable expands to.
5. Confirm the **Redirect URLs** allowlist includes `{{ Site URL }}/auth/callback`.
6. Send a test signup to verify: sign up with a fresh `verify-callback@demo.local` test account, check email arrives from the configured sender, click the link, confirm landing on `/me` (player default home).

## Sender posture (pre-DNS)

While DNS access for `handibowls.co.za` is deferred:

- **Sender email** stays at the Supabase shared sender (`noreply@mail.app.supabase.io`) — out of operator control until DNS lands.
- **Sender name** flips to **"HandiBowls"** in the dashboard (Authentication → SMTP Settings → Sender Name). This is what most inbox clients show prominently.
- The `{{ Site URL }}` variable will be the Vercel preview URL during demo + pilot phase. After DNS cutover (`app.handibowls.co.za`), update Site URL in the dashboard. No template HTML changes needed at that point.

The templates below are visually self-contained — they do NOT depend on a custom sender domain to render correctly. Once DNS lands and the sending domain is verified (per `LAUNCH_DNS_CHECKLIST.md` §2), update the Sender Email in the dashboard. Templates stay as-is.

---

## Template 1: Confirm signup

**Subject:**

```
Confirm your HandiBowls account
```

**HTML body:**

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f0ec;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Arial,sans-serif">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
        <tr>
          <td style="padding:32px 32px 24px 32px;background:#D7261E;color:#ffffff">
            <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase">HANDIBOWLS · CONFIRM ACCOUNT</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px 32px;color:#0a0a0a">
            <h1 style="font-family:'Barlow Condensed','Oswald',Arial Black,Impact,sans-serif;font-size:32px;font-weight:900;font-style:italic;line-height:1.1;letter-spacing:-0.02em;color:#0a0a0a;margin:0 0 16px 0;text-transform:uppercase">Welcome to HandiBowls.</h1>
            <p style="font-size:15px;line-height:1.55;color:#0a0a0a;margin:0 0 16px 0">Tap the button below to confirm your email and finish creating your account.</p>
            <table cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0">
              <tr>
                <td>
                  <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=/me" style="display:inline-block;background:#0a0a0a;color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:14px 24px;border-radius:8px;text-decoration:none">Confirm my email</a>
                </td>
              </tr>
            </table>
            <p style="font-size:13px;line-height:1.5;color:#4a4a4a;margin:0 0 8px 0">Button not working? Paste this into your browser:</p>
            <p style="font-size:11px;line-height:1.4;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;color:#0a0a0a;word-break:break-all;margin:0">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=/me</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px 32px;color:#7a7a7a;font-size:12px;line-height:1.5;border-top:1px solid #e5e5e2">
            <p style="margin:0">If you didn't sign up for HandiBowls, you can ignore this email — your account won't be created.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

---

## Template 2: Invite user

**Subject:**

```
You're invited to join HandiBowls
```

**HTML body:**

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f0ec;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Arial,sans-serif">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
        <tr>
          <td style="padding:32px 32px 24px 32px;background:#D7261E;color:#ffffff">
            <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase">HANDIBOWLS · INVITE</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px 32px;color:#0a0a0a">
            <h1 style="font-family:'Barlow Condensed','Oswald',Arial Black,Impact,sans-serif;font-size:32px;font-weight:900;font-style:italic;line-height:1.1;letter-spacing:-0.02em;color:#0a0a0a;margin:0 0 16px 0;text-transform:uppercase">You're invited.</h1>
            <p style="font-size:15px;line-height:1.55;color:#0a0a0a;margin:0 0 16px 0">A HandiBowls club has invited you to join. Tap the button below to accept and finish setting up your account.</p>
            <table cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0">
              <tr>
                <td>
                  <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/me/setup" style="display:inline-block;background:#0a0a0a;color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:14px 24px;border-radius:8px;text-decoration:none">Accept invite</a>
                </td>
              </tr>
            </table>
            <p style="font-size:13px;line-height:1.5;color:#4a4a4a;margin:0 0 8px 0">Button not working? Paste this into your browser:</p>
            <p style="font-size:11px;line-height:1.4;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;color:#0a0a0a;word-break:break-all;margin:0">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/me/setup</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px 32px;color:#7a7a7a;font-size:12px;line-height:1.5;border-top:1px solid #e5e5e2">
            <p style="margin:0">If you weren't expecting this invite, you can safely ignore this email.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

---

## Template 3: Magic Link

**Subject:**

```
Your HandiBowls sign-in link
```

**HTML body:**

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f0ec;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Arial,sans-serif">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
        <tr>
          <td style="padding:32px 32px 24px 32px;background:#D7261E;color:#ffffff">
            <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase">HANDIBOWLS · SIGN-IN LINK</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px 32px;color:#0a0a0a">
            <h1 style="font-family:'Barlow Condensed','Oswald',Arial Black,Impact,sans-serif;font-size:32px;font-weight:900;font-style:italic;line-height:1.1;letter-spacing:-0.02em;color:#0a0a0a;margin:0 0 16px 0;text-transform:uppercase">Sign in to HandiBowls.</h1>
            <p style="font-size:15px;line-height:1.55;color:#0a0a0a;margin:0 0 16px 0">You requested a one-time sign-in link. Tap the button below to sign in. This link expires in one hour.</p>
            <table cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0">
              <tr>
                <td>
                  <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink" style="display:inline-block;background:#0a0a0a;color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:14px 24px;border-radius:8px;text-decoration:none">Sign in to HandiBowls</a>
                </td>
              </tr>
            </table>
            <p style="font-size:13px;line-height:1.5;color:#4a4a4a;margin:0 0 8px 0">Button not working? Paste this into your browser:</p>
            <p style="font-size:11px;line-height:1.4;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;color:#0a0a0a;word-break:break-all;margin:0">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px 32px;color:#7a7a7a;font-size:12px;line-height:1.5;border-top:1px solid #e5e5e2">
            <p style="margin:0">Didn't request this link? Someone may have typed your email by mistake — you can ignore this email and no action will be taken.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

---

## Template 4: Change Email Address

**Subject:**

```
Confirm your new HandiBowls email
```

**HTML body:**

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f0ec;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Arial,sans-serif">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
        <tr>
          <td style="padding:32px 32px 24px 32px;background:#D7261E;color:#ffffff">
            <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase">HANDIBOWLS · EMAIL CHANGE</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px 32px;color:#0a0a0a">
            <h1 style="font-family:'Barlow Condensed','Oswald',Arial Black,Impact,sans-serif;font-size:32px;font-weight:900;font-style:italic;line-height:1.1;letter-spacing:-0.02em;color:#0a0a0a;margin:0 0 16px 0;text-transform:uppercase">Confirm your new email.</h1>
            <p style="font-size:15px;line-height:1.55;color:#0a0a0a;margin:0 0 16px 0">You requested to change the email address on your HandiBowls account to this one. Tap the button below to confirm.</p>
            <table cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0">
              <tr>
                <td>
                  <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change&next=/me" style="display:inline-block;background:#0a0a0a;color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:14px 24px;border-radius:8px;text-decoration:none">Confirm new email</a>
                </td>
              </tr>
            </table>
            <p style="font-size:13px;line-height:1.5;color:#4a4a4a;margin:0 0 8px 0">Button not working? Paste this into your browser:</p>
            <p style="font-size:11px;line-height:1.4;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;color:#0a0a0a;word-break:break-all;margin:0">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change&next=/me</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px 32px;color:#7a7a7a;font-size:12px;line-height:1.5;border-top:1px solid #e5e5e2">
            <p style="margin:0">If you didn't request this change, ignore this email and your account email will stay as it was.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

---

## Template 5: Reset Password

**Subject:**

```
Reset your HandiBowls password
```

**HTML body:**

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f0ec;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Arial,sans-serif">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
        <tr>
          <td style="padding:32px 32px 24px 32px;background:#D7261E;color:#ffffff">
            <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase">HANDIBOWLS · PASSWORD RESET</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px 32px;color:#0a0a0a">
            <h1 style="font-family:'Barlow Condensed','Oswald',Arial Black,Impact,sans-serif;font-size:32px;font-weight:900;font-style:italic;line-height:1.1;letter-spacing:-0.02em;color:#0a0a0a;margin:0 0 16px 0;text-transform:uppercase">Reset your password.</h1>
            <p style="font-size:15px;line-height:1.55;color:#0a0a0a;margin:0 0 16px 0">Tap the button below to set a new password. This link expires in one hour.</p>
            <table cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0">
              <tr>
                <td>
                  <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/me/settings" style="display:inline-block;background:#0a0a0a;color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:14px 24px;border-radius:8px;text-decoration:none">Reset my password</a>
                </td>
              </tr>
            </table>
            <p style="font-size:13px;line-height:1.5;color:#4a4a4a;margin:0 0 8px 0">Button not working? Paste this into your browser:</p>
            <p style="font-size:11px;line-height:1.4;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;color:#0a0a0a;word-break:break-all;margin:0">{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/me/settings</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px 32px;color:#7a7a7a;font-size:12px;line-height:1.5;border-top:1px solid #e5e5e2">
            <p style="margin:0">If you didn't request a password reset, ignore this email and your existing password will stay active.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

---

## Template 6: Reauthenticate

**Subject:**

```
Confirm your identity on HandiBowls
```

**HTML body:**

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f0ec;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Arial,sans-serif">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
        <tr>
          <td style="padding:32px 32px 24px 32px;background:#D7261E;color:#ffffff">
            <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase">HANDIBOWLS · CONFIRM IDENTITY</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px 32px;color:#0a0a0a">
            <h1 style="font-family:'Barlow Condensed','Oswald',Arial Black,Impact,sans-serif;font-size:32px;font-weight:900;font-style:italic;line-height:1.1;letter-spacing:-0.02em;color:#0a0a0a;margin:0 0 16px 0;text-transform:uppercase">Confirm it's you.</h1>
            <p style="font-size:15px;line-height:1.55;color:#0a0a0a;margin:0 0 16px 0">Use this code to reauthenticate on HandiBowls:</p>
            <p style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:0.16em;color:#0a0a0a;background:#f1f0ec;padding:16px 24px;border-radius:8px;display:inline-block;margin:0 0 16px 0">{{ .Token }}</p>
            <p style="font-size:13px;line-height:1.5;color:#4a4a4a;margin:0">This code expires in 5 minutes.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px 32px;color:#7a7a7a;font-size:12px;line-height:1.5;border-top:1px solid #e5e5e2">
            <p style="margin:0">If you didn't request this code, ignore this email — no action is needed.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

---

## Notes for the operator

- **Brand chrome:** every template uses the atomic-red header strip (`#D7261E`), bone-cream background (`#f1f0ec`), Barlow Condensed Black Italic uppercase H1, ink-black CTA button. Matches the landing page's visual identity.
- **No "powered by Supabase":** the default footer is intentionally dropped from every template. HandiBowls owns the inbox identity end-to-end.
- **CTA URL pattern:** every template's confirmation link points at `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=<flow>&next=<path>`. The route handler at `app/auth/callback/route.ts` was updated at Phase 13 / 13-8 / Batch B / Fix 2 to handle this `token_hash` + `type` shape via `verifyOtp`. The reauthenticate template uses `{{ .Token }}` (a 6-digit code) instead of a clickable link — different flow, no callback URL needed.
- **`next` parameter:** picks a sensible role-agnostic landing per template:
  - Confirm signup → `/me` (profile + first-session orientation)
  - Invite → `/me/setup` (complete profile)
  - Email change → `/me` (profile)
  - Reset password → `/me/settings` (where the user changes credentials)
  - Magic link → no `next` (auth callback resolves to `homeFor(role)`)
- **Pre-DNS limitation:** templates render correctly at the demo phase using the Supabase shared sender; the visual chrome lands without DKIM-aligned domain. Recipients will see "via mail.app.supabase.io" in some clients (Gmail, Yahoo) — known artefact, addressed by `LAUNCH_DNS_CHECKLIST.md` §2 Resend domain verification post-DNS.
- **Manual verification banked:** after pasting the templates, sign up `verify-callback@demo.local` end-to-end. Confirm the email arrives with the new chrome AND the link redirects to `/me` (not `/login`). This closes the manual-verification step from `signup-confirmation-redirects-to-login-instead-of-app` DRIFT.

When the operator confirms templates are pasted + verified live, the DRIFT entry `supabase-default-email-templates-unbranded` can be closed with the timestamp + operator's name in the strike-through closure annotation.
