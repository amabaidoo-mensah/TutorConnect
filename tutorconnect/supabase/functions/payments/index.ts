// Deno Edge Function. Secrets: PAYSTACK_SECRET (test key). SUPABASE_SERVICE_ROLE_KEY is injected by Supabase. Never ship either to the browser.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const PS = "https://api.paystack.co", H = { Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET")}`, "Content-Type": "application/json" };
const CONTACT_FEE = 10, PLANS: Record<string, { amount: number; days: number }> = { monthly: { amount: 50, days: 30 }, semester: { amount: 200, days: 120 } };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey" } });
async function finalize(ref: string) { // idempotent: a repeated callback cannot double-unlock
  const { data: p } = await db.from("payments").select("*").eq("provider_ref", ref).single();
  if (!p) return json({ error: "unknown reference" }, 404);
  if (p.status === "paid") return json({ status: "paid", purpose: p.purpose, tutor_id: p.purpose === "contact" ? p.tutor_id : null });
  const v = await (await fetch(`${PS}/transaction/verify/${ref}`, { headers: H })).json();
  const ok = v.data?.status === "success" && v.data.amount === p.amount * 100 && v.data.currency === p.currency;
  await db.from("payments").update({ status: ok ? "paid" : "failed", verified_at: new Date().toISOString() }).eq("id", p.id).eq("status", "pending");
  if (ok && p.purpose === "contact") await db.from("contact_unlocks").upsert({ student_id: p.user_id, tutor_id: p.tutor_id, payment_id: p.id }, { onConflict: "student_id,tutor_id", ignoreDuplicates: true });
  if (ok && p.purpose === "premium") { const { data: t } = await db.from("tutor_profiles").select("premium_until").eq("id", p.user_id).single(); const base = Math.max(Date.now(), t?.premium_until ? Date.parse(t.premium_until) : 0); await db.from("tutor_profiles").update({ premium_until: new Date(base + p.plan_days * 864e5).toISOString() }).eq("id", p.user_id); }
  return json({ status: ok ? "paid" : "failed", purpose: p.purpose, tutor_id: ok && p.purpose === "contact" ? p.tutor_id : null });
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});
  const raw = await req.text();
  if (req.headers.get("x-paystack-signature")) { // webhook: validate HMAC-SHA512 signature
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(Deno.env.get("PAYSTACK_SECRET")!), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
    const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(raw)))].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (sig !== req.headers.get("x-paystack-signature")) return json({ error: "bad signature" }, 401);
    return finalize(JSON.parse(raw).data.reference);
  }
  const { data: { user } } = await db.auth.getUser((req.headers.get("authorization") ?? "").replace("Bearer ", ""));
  if (!user) return json({ error: "sign in required" }, 401);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: "invalid request" }, 400); }
  if (b.action === "verify") {
    if (typeof b.reference !== "string" || !b.reference) return json({ error: "invalid reference" }, 400);
    const { data: p } = await db.from("payments").select("user_id").eq("provider_ref", b.reference).single();
    return p?.user_id === user.id ? finalize(b.reference) : json({ error: "not yours" }, 403);
  }
  if (b.action !== "contact" && b.action !== "premium") return json({ error: "unsupported payment action" }, 400);
  const { data: account, error: accountError } = await db.from("profiles")
    .select("role,account_status").eq("id", user.id).maybeSingle();
  if (accountError || !account || account.account_status !== "active") return json({ error: "active account required" }, 403);
  const contact = b.action === "contact";
  if (contact && account.role !== "student") return json({ error: "student account required" }, 403);
  if (!contact && account.role !== "tutor") return json({ error: "tutor account required" }, 403);
  if (!contact) {
    const { data: tutorProfile, error: tutorError } = await db.from("tutor_profiles")
      .select("status").eq("id", user.id).maybeSingle();
    if (tutorError) return json({ error: "could not verify tutor approval" }, 503);
    if (!tutorProfile || tutorProfile.status !== "approved") return json({ error: "tutor approval required before subscribing" }, 403);
  }
  const plan = typeof b.plan === "string" ? PLANS[b.plan] : undefined;
  const amount = contact ? CONTACT_FEE : plan?.amount; // amount is decided server-side, never by the client
  if (!amount) return json({ error: "bad request" }, 400);
  const ref = "TC-" + crypto.randomUUID().slice(0, 12);
  await db.from("payments").insert({ user_id: user.id, purpose: contact ? "contact" : "premium", tutor_id: contact ? b.tutor_id : null, plan_days: plan?.days, amount, provider_ref: ref });
  const r = await (await fetch(`${PS}/transaction/initialize`, { method: "POST", headers: H, body: JSON.stringify({ email: user.email, amount: amount * 100, currency: "GHS", reference: ref, callback_url: b.callback_url }) })).json();
  return json({ url: r.data?.authorization_url, reference: ref });
});
