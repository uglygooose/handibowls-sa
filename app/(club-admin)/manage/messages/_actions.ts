"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth/role";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { sendMessage } from "@/lib/messages/actions";
import { createClient } from "@/lib/supabase/server";

import type { ComposeAction, ComposeFormState } from "./_form-state";

// Phase 11 / 11-3b — admin Messages server actions.
//
// Five actions backing the compose UI:
//
//   createMessageDraft    INSERT a fresh row at status='draft'.
//                         Hard-codes send_in_app=true,
//                         send_email=false (locked decision #3:
//                         in-app only in v1).
//   updateMessageDraft    UPDATE an existing draft. Rejects if
//                         the row has already transitioned out of
//                         'draft' (queued/sent/failed are immutable).
//   sendMessageNow        Atomic transition draft → queued, then
//                         invoke send_message RPC (mig 035) which
//                         transitions queued → sent / failed and
//                         fans out into message_recipients +
//                         notifications.
//   scheduleMessage       Transition draft → queued with a
//                         scheduled_at timestamp. The actual
//                         dispatcher is a future phase — for v1 the
//                         row sits at queued+scheduled_at and waits.
//   deleteMessageDraft    DELETE on status='draft' only.
//
// Pattern mirrors Phase 9's /manage/overview actions: Zod gating +
// typed Result discriminated unions + revalidatePath on success.
// RLS handles club-ownership at the DB level (messages_club_admin_rw
// policy) — these actions don't re-check ownership, they just trust
// RLS to reject foreign-club writes. Defence-in-depth pulls auth
// context for the sender_id but not for ownership.

const audienceKindEnum = z.enum([
  "all_members",
  "tournament_entrants",
  "custom",
]);

const draftInputSchema = z
  .object({
    subject: z.string().trim().min(1).max(120),
    body_md: z.string().trim().min(1).max(5000),
    audience_kind: audienceKindEnum,
    audience_tournament_id: z.string().uuid().nullable().optional(),
    audience_profile_ids: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (v) =>
      v.audience_kind !== "tournament_entrants" || !!v.audience_tournament_id,
    {
      message: "Tournament audience requires a tournament_id.",
      path: ["audience_tournament_id"],
    },
  );

export type CreateMessageDraftInput = z.input<typeof draftInputSchema>;

export type CreateMessageDraftResult =
  | { kind: "ok"; messageId: string }
  | { kind: "no_club" }
  | { kind: "auth"; error: string }
  | { kind: "validation"; error: string }
  | { kind: "error"; error: string };

export async function createMessageDraft(
  input: CreateMessageDraftInput,
): Promise<CreateMessageDraftResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };

  const club = await getCurrentHostClub();
  if (!club) return { kind: "no_club" };

  const parsed = draftInputSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "validation", error: firstZodError(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      club_id: club.club_id,
      sender_id: ctx.userId,
      subject: parsed.data.subject,
      body_md: parsed.data.body_md,
      audience_kind: parsed.data.audience_kind,
      audience_tournament_id:
        parsed.data.audience_tournament_id ?? null,
      audience_profile_ids: parsed.data.audience_profile_ids ?? [],
      // Locked decisions #1, #3: admin compose is in-app only in v1.
      send_in_app: true,
      send_email: false,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { kind: "error", error: error?.message ?? "Insert failed" };
  }

  revalidatePath("/manage/messages", "page");
  return { kind: "ok", messageId: data.id };
}

const updateInputSchema = draftInputSchema;

export type UpdateMessageDraftInput = z.input<typeof updateInputSchema>;

export type UpdateMessageDraftResult =
  | { kind: "ok" }
  | { kind: "not_found" }
  | { kind: "wrong_state" }
  | { kind: "auth"; error: string }
  | { kind: "validation"; error: string }
  | { kind: "error"; error: string };

export async function updateMessageDraft(
  id: string,
  input: UpdateMessageDraftInput,
): Promise<UpdateMessageDraftResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };
  if (!z.string().uuid().safeParse(id).success) {
    return { kind: "validation", error: "Invalid message id." };
  }

  const parsed = updateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "validation", error: firstZodError(parsed.error) };
  }

  const supabase = await createClient();
  // Status check before update — rejects queued/sent/failed mutations
  // up front rather than emitting a silent no-op via .eq("status",
  // "draft"). Lets us return wrong_state cleanly.
  const { data: existing, error: readErr } = await supabase
    .from("messages")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { kind: "error", error: readErr.message };
  if (!existing) return { kind: "not_found" };
  if (existing.status !== "draft") return { kind: "wrong_state" };

  const { error } = await supabase
    .from("messages")
    .update({
      subject: parsed.data.subject,
      body_md: parsed.data.body_md,
      audience_kind: parsed.data.audience_kind,
      audience_tournament_id:
        parsed.data.audience_tournament_id ?? null,
      audience_profile_ids: parsed.data.audience_profile_ids ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { kind: "error", error: error.message };

  revalidatePath("/manage/messages", "page");
  return { kind: "ok" };
}

export type SendMessageNowResult =
  | { kind: "ok"; recipientCount: number }
  | { kind: "not_found" }
  | { kind: "wrong_state" }
  | { kind: "audience_invalid"; error: string }
  | { kind: "forbidden"; error: string }
  | { kind: "auth"; error: string }
  | { kind: "validation"; error: string }
  | { kind: "error"; error: string };

export async function sendMessageNow(id: string): Promise<SendMessageNowResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };
  if (!z.string().uuid().safeParse(id).success) {
    return { kind: "validation", error: "Invalid message id." };
  }

  const supabase = await createClient();
  // Step 1 — read + state guard
  const { data: existing, error: readErr } = await supabase
    .from("messages")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { kind: "error", error: readErr.message };
  if (!existing) return { kind: "not_found" };
  if (existing.status !== "draft") return { kind: "wrong_state" };

  // Step 2 — transition draft → queued (RPC requires queued)
  const { error: queueErr } = await supabase
    .from("messages")
    .update({ status: "queued", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (queueErr) return { kind: "error", error: queueErr.message };

  // Step 3 — RPC fan-out
  const result = await sendMessage({ messageId: id });

  if (result.ok) {
    revalidatePath("/manage/messages", "page");
    return { kind: "ok", recipientCount: result.recipientCount };
  }
  // Map send_message wrapper kinds onto our action's surface kinds.
  switch (result.kind) {
    case "audience_invalid":
      return {
        kind: "audience_invalid",
        error: result.error ?? "Audience resolution failed.",
      };
    case "forbidden":
      return { kind: "forbidden", error: result.error ?? "Forbidden" };
    case "not_authenticated":
      return { kind: "auth", error: result.error ?? "Not authenticated" };
    case "not_found":
      return { kind: "not_found" };
    case "wrong_state":
      return { kind: "wrong_state" };
    case "validation":
      return { kind: "validation", error: result.error ?? "Validation failed" };
    default:
      return { kind: "error", error: result.error ?? "send_message failed" };
  }
}

const scheduleInputSchema = z.object({
  scheduled_at: z
    .string()
    .datetime({ offset: true })
    .refine((s) => new Date(s).getTime() > Date.now(), {
      message: "scheduled_at must be in the future.",
    }),
});

export type ScheduleMessageInput = z.input<typeof scheduleInputSchema>;

export type ScheduleMessageResult =
  | { kind: "ok" }
  | { kind: "not_found" }
  | { kind: "wrong_state" }
  | { kind: "auth"; error: string }
  | { kind: "validation"; error: string }
  | { kind: "error"; error: string };

export async function scheduleMessage(
  id: string,
  input: ScheduleMessageInput,
): Promise<ScheduleMessageResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };
  if (!z.string().uuid().safeParse(id).success) {
    return { kind: "validation", error: "Invalid message id." };
  }

  const parsed = scheduleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "validation", error: firstZodError(parsed.error) };
  }

  const supabase = await createClient();
  const { data: existing, error: readErr } = await supabase
    .from("messages")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { kind: "error", error: readErr.message };
  if (!existing) return { kind: "not_found" };
  if (existing.status !== "draft") return { kind: "wrong_state" };

  const { error } = await supabase
    .from("messages")
    .update({
      status: "queued",
      scheduled_at: parsed.data.scheduled_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { kind: "error", error: error.message };

  revalidatePath("/manage/messages", "page");
  return { kind: "ok" };
}

export type DeleteMessageDraftResult =
  | { kind: "ok" }
  | { kind: "not_found" }
  | { kind: "wrong_state" }
  | { kind: "auth"; error: string }
  | { kind: "validation"; error: string }
  | { kind: "error"; error: string };

export async function deleteMessageDraft(
  id: string,
): Promise<DeleteMessageDraftResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { kind: "auth", error: "Not authenticated" };
  if (!z.string().uuid().safeParse(id).success) {
    return { kind: "validation", error: "Invalid message id." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("messages")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { kind: "not_found" };
  if (existing.status !== "draft") return { kind: "wrong_state" };

  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) return { kind: "error", error: error.message };

  revalidatePath("/manage/messages", "page");
  return { kind: "ok" };
}

// ---------------------------------------------------------------------
// useActionState wrapper for the compose form
// ---------------------------------------------------------------------
//
// Bridges the form-data world (HTML form inputs) and the structured
// createMessageDraft / sendMessageNow / scheduleMessage inputs. On
// success path we redirect() inline so the form submission flow
// ends on the list page (or detail page once that lands).
//
// `ComposeFormState` + `COMPOSE_INITIAL` live in ./_form-state.ts
// because plain-object exports from a "use server" module strip to
// undefined at the Client-Component bundler boundary — see
// app/(club-admin)/manage/t20/_form-state.ts (Phase 10 fix cd6d068)
// for the full explanation and the regression test that locks the
// boundary.

export async function composeMessageFromForm(
  _prev: ComposeFormState,
  formData: FormData,
): Promise<ComposeFormState> {
  const action = (formData.get("compose_action") ?? "save_draft") as ComposeAction;
  const subject = String(formData.get("subject") ?? "");
  const body_md = String(formData.get("body_md") ?? "");
  const audience_kind = String(formData.get("audience_kind") ?? "all_members");
  const audience_tournament_id =
    (formData.get("audience_tournament_id") as string | null) ?? null;
  const audience_profile_ids_raw = formData.get("audience_profile_ids");
  const audience_profile_ids =
    typeof audience_profile_ids_raw === "string" && audience_profile_ids_raw
      ? audience_profile_ids_raw.split(",").filter(Boolean)
      : [];
  const scheduled_at =
    (formData.get("scheduled_at") as string | null) ?? null;

  const draft = await createMessageDraft({
    subject,
    body_md,
    audience_kind: audience_kind as
      | "all_members"
      | "tournament_entrants"
      | "custom",
    audience_tournament_id: audience_tournament_id || null,
    audience_profile_ids,
  });

  if (draft.kind !== "ok") {
    return draft as ComposeFormState;
  }

  const messageId = draft.messageId;

  if (action === "save_draft") {
    redirect("/manage/messages");
  }

  if (action === "schedule") {
    if (!scheduled_at) {
      return {
        kind: "validation",
        error: "scheduled_at is required for schedule action.",
      };
    }
    // Convert datetime-local (no offset) to ISO string with current
    // local-zone offset baked in. The browser submits a value like
    // "2026-05-01T18:00" — Date() parses as local time and toISOString
    // produces the UTC-Z form Zod validates as a datetime with offset.
    const iso = new Date(scheduled_at).toISOString();
    const result = await scheduleMessage(messageId, { scheduled_at: iso });
    if (result.kind !== "ok") return result as ComposeFormState;
    redirect("/manage/messages");
  }

  // action === "send_now"
  const result = await sendMessageNow(messageId);
  if (result.kind !== "ok") return result as ComposeFormState;
  redirect("/manage/messages");
}

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------

function firstZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue?.message ?? "Invalid input";
}
