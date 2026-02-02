"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ClubRow = { id: string; name: string; district_id: string | null };
type DistrictRow = { id: string; name: string; province_id: string | null };
type ProvinceRow = { id: string; name: string };

export default function LoginPage() {
  const supabase = createClient();

  const [mode, setMode] = useState<"SIGN_IN" | "SIGN_UP">("SIGN_IN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"" | "MALE" | "FEMALE">("");
  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [clubId, setClubId] = useState("");

  const [provinces, setProvinces] = useState<ProvinceRow[]>([]);
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [clubs, setClubs] = useState<ClubRow[]>([]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    window.location.href = "/";
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      setLoading(false);
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email.");
      setLoading(false);
      return;
    }
    if (!password.trim()) {
      setError("Please enter a password.");
      setLoading(false);
      return;
    }
    if (!provinceId || !districtId || !clubId) {
      setError("Please select your province, district, and club.");
      setLoading(false);
      return;
    }
    if (!gender) {
      setError("Please select your gender.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          club_id: clubId,
          district_id: districtId,
          province_id: provinceId,
          gender,
        },
      },
    });

    if (error || !data?.user) {
      setLoading(false);
      setError(error?.message ?? "Could not create account.");
      return;
    }

    const userId = data.user.id;

    const selectedClub = clubs.find((c) => c.id === clubId);

    const profileInsert = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName.trim(),
      email: email.trim(),
      club_id: clubId,
      district_id: districtId,
      club: selectedClub?.name ?? null,
      role: "USER",
      is_admin: false,
      gender,
    });

    if (profileInsert.error) {
      setLoading(false);
      setError(profileInsert.error.message);
      return;
    }

    const playerInsert = await supabase.from("players").upsert(
      {
        user_id: userId,
        club_id: clubId,
        display_name: fullName.trim(),
        handicap: 0,
        is_active: true,
        gender,
      },
      { onConflict: "user_id" }
    );

    if (playerInsert.error) {
      setLoading(false);
      setError(playerInsert.error.message);
      return;
    }

    setLoading(false);
    window.location.href = "/";
  }

  useEffect(() => {
    async function loadLists() {
      const [pRes, dRes, cRes] = await Promise.all([
        supabase.from("provinces").select("id, name").order("name"),
        supabase.from("districts").select("id, name, province_id").order("name"),
        supabase.from("clubs").select("id, name, district_id").order("name"),
      ]);

      if (!pRes.error) setProvinces((pRes.data ?? []) as ProvinceRow[]);
      if (!dRes.error) setDistricts((dRes.data ?? []) as DistrictRow[]);
      if (!cRes.error) setClubs((cRes.data ?? []) as ClubRow[]);
    }

    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (provinceId && districts.every((d) => d.province_id !== provinceId)) {
      setDistrictId("");
      setClubId("");
    }
  }, [provinceId, districts]);

  useEffect(() => {
    if (districtId && clubs.every((c) => c.district_id !== districtId)) {
      setClubId("");
    }
  }, [districtId, clubs]);

  const filteredDistricts = useMemo(() => {
    return provinceId ? districts.filter((d) => d.province_id === provinceId) : districts;
  }, [districts, provinceId]);

  const filteredClubs = useMemo(() => {
    return districtId ? clubs.filter((c) => c.district_id === districtId) : clubs;
  }, [clubs, districtId]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        backgroundImage: "url('/login-bowls.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "rgba(255,255,255,0.92)",
          border: "1px solid #e5d6c7",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
          backdropFilter: "blur(4px)",
        }}
      >
        <form onSubmit={mode === "SIGN_IN" ? signIn : signUp} style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 20, textAlign: "center" }}>HandiBowls SA</div>

          {mode === "SIGN_UP" ? (
            <>
              <input
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  border: "1px solid #d8c9ba",
                  borderRadius: 12,
                  padding: "12px 12px",
                  fontSize: 14,
                  background: "#fff",
                }}
              />

              <select
                value={provinceId}
                onChange={(e) => setProvinceId(e.target.value)}
                style={{
                  border: "1px solid #d8c9ba",
                  borderRadius: 12,
                  padding: "12px 12px",
                  fontSize: 14,
                  background: "#fff",
                }}
              >
                <option value="">Select province (national)</option>
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                style={{
                  border: "1px solid #d8c9ba",
                  borderRadius: 12,
                  padding: "12px 12px",
                  fontSize: 14,
                  background: "#fff",
                }}
              >
                <option value="">Select district</option>
                {filteredDistricts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
                style={{
                  border: "1px solid #d8c9ba",
                  borderRadius: 12,
                  padding: "12px 12px",
                  fontSize: 14,
                  background: "#fff",
                }}
              >
                <option value="">Select club</option>
                {filteredClubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as "MALE" | "FEMALE")}
                style={{
                  border: "1px solid #d8c9ba",
                  borderRadius: 12,
                  padding: "12px 12px",
                  fontSize: 14,
                  background: "#fff",
                }}
              >
                <option value="">Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </>
          ) : null}

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              border: "1px solid #d8c9ba",
              borderRadius: 12,
              padding: "12px 12px",
              fontSize: 14,
              background: "#fff",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              border: "1px solid #d8c9ba",
              borderRadius: 12,
              padding: "12px 12px",
              fontSize: 14,
              background: "#fff",
            }}
          />

          {error ? <div style={{ color: "crimson", fontWeight: 700 }}>{error}</div> : null}

          <button
            disabled={loading}
            type="submit"
            style={{
              border: "none",
              borderRadius: 12,
              padding: "12px 12px",
              fontWeight: 900,
              background: "#7A1F2B",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {loading ? "Working..." : mode === "SIGN_IN" ? "Sign In" : "Create Account"}
          </button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode(mode === "SIGN_IN" ? "SIGN_UP" : "SIGN_IN");
            }}
            style={{
              border: "1px solid #d8c9ba",
              borderRadius: 12,
              padding: "10px 12px",
              fontWeight: 900,
              background: "#fff",
              color: "#7A1F2B",
              cursor: "pointer",
            }}
          >
            {mode === "SIGN_IN" ? "Create Account" : "Back to Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
