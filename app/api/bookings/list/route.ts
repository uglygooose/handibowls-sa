import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

type Session = "AM" | "PM";

function normalizeSession(v: unknown): Session | null {
  const t = String(v ?? "").toUpperCase();
  if (t === "AM") return "AM";
  if (t === "PM") return "PM";
  return null;
}

function isMissingRelationError(msg: string | undefined) {
  const m = String(msg ?? "").toLowerCase();
  return m.includes("does not exist") && (m.includes("relation") || m.includes("table"));
}

function normalizeRole(v: unknown) {
  return String(v ?? "").toUpperCase();
}

function isValidDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: Request) {
  try {
    const { supabase, user } = await createAuthedServerClient();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const url = new URL(req.url);
    const booking_date = String(url.searchParams.get("date") ?? "");
    const session = normalizeSession(url.searchParams.get("session"));

    if (!isValidDateOnly(booking_date)) return NextResponse.json({ error: "Invalid date (expected YYYY-MM-DD)" }, { status: 400 });
    if (!session) return NextResponse.json({ error: "Invalid session (AM/PM)" }, { status: 400 });

    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("id, club_id, is_admin, role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const profRow =
      (prof ?? null) as unknown as { club_id: string | null; is_admin: boolean | null; role: string | null; full_name: string | null } | null;
    if (pErr || !profRow) return NextResponse.json({ error: "Profile not found" }, { status: 400 });
    const clubId = String(profRow.club_id ?? "");
    if (!clubId) return NextResponse.json({ error: "Missing club_id on profile" }, { status: 400 });

    const role = normalizeRole(profRow.role);
    const isSuperAdmin = role === "SUPER_ADMIN";
    const isAdmin = Boolean(profRow.is_admin) || isSuperAdmin;

    const greensQ = await supabase
      .from("club_greens")
      .select("id, club_id, name, lane_count, sort_order, is_active")
      .eq("club_id", clubId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (greensQ.error) {
      if (isMissingRelationError(greensQ.error.message)) {
        return NextResponse.json(
          {
            error:
              'Missing DB tables. Run `supabase/migrations/20260217_club_greens_and_lane_bookings.sql` in your Supabase SQL editor.',
          },
          { status: 501 }
        );
      }
      return NextResponse.json({ error: greensQ.error.message }, { status: 400 });
    }

    const bookingsQ = await supabase
      .from("lane_bookings")
      .select("id, club_id, green_id, booking_date, session, lane_number, created_by, created_at")
      .eq("club_id", clubId)
      .eq("booking_date", booking_date)
      .eq("session", session)
      .order("green_id", { ascending: true })
      .order("lane_number", { ascending: true });

    if (bookingsQ.error) {
      if (isMissingRelationError(bookingsQ.error.message)) {
        return NextResponse.json(
          {
            error:
              'Missing DB tables. Run `supabase/migrations/20260217_club_greens_and_lane_bookings.sql` in your Supabase SQL editor.',
          },
          { status: 501 }
        );
      }
      return NextResponse.json({ error: bookingsQ.error.message }, { status: 400 });
    }

    const bookings = bookingsQ.data ?? [];
    const creatorIds = Array.from(
      new Set(
        bookings
          .map((b: unknown) => {
            const r = (b ?? null) as unknown as { created_by?: unknown } | null;
            return String(r?.created_by ?? "");
          })
          .filter(Boolean)
      )
    );

    const creatorsQ = creatorIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", creatorIds)
      : ({ data: [] as unknown[], error: null } as { data: unknown[]; error: null });

    const nameByUserId: Record<string, string> = {};
    for (const c of (creatorsQ.data ?? []) as unknown[]) {
      const r = (c ?? null) as unknown as { id?: unknown; full_name?: unknown } | null;
      const id = String(r?.id ?? "");
      if (!id) continue;
      nameByUserId[id] = String(r?.full_name ?? "").trim();
    }

    return NextResponse.json({
      ok: true,
      me: { user_id: user.id, club_id: clubId, is_admin: isAdmin },
      greens: greensQ.data ?? [],
      bookings,
      nameByUserId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
