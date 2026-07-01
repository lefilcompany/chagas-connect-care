# `_shared/` — Edge Function utilities

Cross-function helpers used by every WhatsApp / Superadmin edge function.
Import via relative path (`../_shared/<file>.ts`) — Deno resolves them at
deploy time; no bundling required.

## Modules

| File | Purpose |
| --- | --- |
| `http.ts` | `handleCorsPreflight`, `jsonOk`, `jsonError`, `withEdgeHandler`. Every response goes through here so the wire contract stays consistent (`{ ok: true, ... }` or `{ ok: false, error_code, error, details? }`). |
| `whatsapp-errors.ts` | Canonical `error_code` enum. Must stay in sync with `src/lib/whatsapp.ts` on the frontend. |
| `auth.ts` | `requireAuth`, `requireSuperadmin`, `assertInstitutionAccess`. Validates the caller JWT with a user-scoped client and loads roles/institution via the service client. |
| `resolve-channel.ts` | `resolveChannel(service, institution)` → phone_number_id + waba_id + token, with env fallback. Also exposes `messagesUrl` / `templatesUrl` / `graphUrl` so functions never hardcode the Meta base URL. |
| `institution-branding.ts` | Signature + footer resolution for outbound messages. |
| `whatsapp-payload-builder.ts` | Meta-format payload construction. |
| `whatsapp-types.ts` | Shared TS types for template payloads. |

## Response contract

```ts
// success
{ ok: true, ...data }

// failure
{
  ok: false,
  error_code: "TEMPLATE_NOT_APPROVED",
  error: "Human readable message",
  details?: { ... }
}
```

Use `jsonOk` / `jsonError` — never build responses by hand. Wrap the whole
handler in `withEdgeHandler` so unexpected throws become
`500 { error_code: "INTERNAL_ERROR" }` instead of an opaque runtime crash.

## Auth pattern

```ts
import { withEdgeHandler, jsonOk } from "../_shared/http.ts";
import { requireSuperadmin } from "../_shared/auth.ts";

Deno.serve(withEdgeHandler(async (req) => {
  const ctx = await requireSuperadmin(req);
  if (ctx instanceof Response) return ctx; // 401 / 403 already formatted

  // use ctx.serviceClient for admin reads, ctx.userClient for RLS-scoped ones
  return jsonOk({ userId: ctx.userId });
}));
```

## Channel resolution

```ts
import { resolveChannel, messagesUrl } from "../_shared/resolve-channel.ts";

const channel = await resolveChannel(ctx.serviceClient, ctx.institution);
if (channel instanceof Response) return channel;

await fetch(messagesUrl(channel), {
  method: "POST",
  headers: { Authorization: `Bearer ${channel.token}`, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
```