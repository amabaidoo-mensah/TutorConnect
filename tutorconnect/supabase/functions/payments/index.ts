// Deno Edge Function. Secrets: PAYSTACK_SECRET (test key). SUPABASE_SERVICE_ROLE_KEY is injected by Supabase.
// Never ship either secret to the browser.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const paystackSecret = Deno.env.get("PAYSTACK_SECRET");
const db = createClient(supabaseUrl, serviceRoleKey);
const paystackUrl = "https://api.paystack.co";
const contactFee = 10;
const resourceFee = 50;
const plans: Record<string, { amount: number; days: number }> = {
  monthly: { amount: 50, days: 30 },
  semester: { amount: 200, days: 120 },
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  },
});

async function markPaymentFailed(reference: string) {
  const { error } = await db.from("payments")
    .update({ status: "failed" })
    .eq("provider_ref", reference)
    .eq("status", "pending");
  return error;
}

async function finalize(reference: string) {
  if (!paystackSecret) return json({ error: "Payments are not configured." }, 503);

  const { data: payment, error: paymentError } = await db.from("payments")
    .select("id,user_id,tutor_id,purpose,amount,currency,plan_days,status")
    .eq("provider_ref", reference)
    .maybeSingle();
  if (paymentError) return json({ error: "Could not load the payment record." }, 503);
  if (!payment) return json({ error: "Unknown payment reference." }, 404);
  if (payment.status === "paid") {
    return json({
      status: "paid",
      purpose: payment.purpose,
      tutor_id: payment.purpose === "contact" ? payment.tutor_id : null,
    });
  }
  if (payment.status !== "pending") {
    return json({ status: payment.status, purpose: payment.purpose, tutor_id: null });
  }

  let verification: { data?: { status?: string; amount?: number; currency?: string } };
  try {
    const response = await fetch(`${paystackUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` },
    });
    if (!response.ok) return json({ error: "Paystack could not verify this payment. Please retry." }, 502);
    verification = await response.json();
  } catch {
    return json({ error: "Paystack could not be reached. Please retry payment verification." }, 502);
  }

  const verified = verification.data?.status === "success"
    && verification.data.amount === Number(payment.amount) * 100
    && verification.data.currency === payment.currency;
  const { data, error } = await db.rpc("finalize_tutorconnect_payment", {
    p_provider_ref: reference,
    p_verified: verified,
  });
  if (error) return json({ error: "Payment was verified, but could not be recorded. Please contact support." }, 503);
  return json(data);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({});
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  if (signature) {
    if (!paystackSecret) return json({ error: "Payments are not configured." }, 503);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(paystackSecret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"],
    );
    const expectedSignature = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    if (signature !== expectedSignature) return json({ error: "Invalid Paystack signature." }, 401);

    let event: { event?: string; data?: { reference?: string } };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid webhook payload." }, 400);
    }
    if (event.event !== "charge.success") return json({ received: true });
    if (!event.data?.reference) return json({ error: "Missing payment reference." }, 400);
    return await finalize(event.data.reference);
  }

  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return json({ error: "Sign in is required." }, 401);
  const { data: authData, error: authError } = await db.auth.getUser(accessToken);
  if (authError || !authData.user) return json({ error: "Your session is invalid. Please sign in again." }, 401);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (body.action === "verify") {
    if (typeof body.reference !== "string" || !body.reference) return json({ error: "Invalid payment reference." }, 400);
    const { data: payment, error } = await db.from("payments")
      .select("user_id")
      .eq("provider_ref", body.reference)
      .maybeSingle();
    if (error) return json({ error: "Could not verify payment ownership." }, 503);
    if (!payment || payment.user_id !== authData.user.id) return json({ error: "Payment reference does not belong to this account." }, 403);
    return await finalize(body.reference);
  }

  if (!["contact", "premium", "resource"].includes(String(body.action))) {
    return json({ error: "Unsupported payment action." }, 400);
  }
  if (!paystackSecret) return json({ error: "Payments are not configured." }, 503);
  if (!authData.user.email) return json({ error: "A verified email address is required for checkout." }, 400);

  const { data: account, error: accountError } = await db.from("profiles")
    .select("role,account_status")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (accountError) return json({ error: "Could not verify your account." }, 503);
  if (!account || account.account_status !== "active") return json({ error: "An active account is required." }, 403);

  const contactPayment = body.action === "contact";
  if (contactPayment && account.role !== "student") return json({ error: "A student account is required." }, 403);
  if (!contactPayment && account.role !== "tutor") return json({ error: "A tutor account is required." }, 403);

  let tutorPlan: { amount: number; days: number } | undefined;
  if (!contactPayment) {
    const { data: tutor, error: tutorError } = await db.from("tutor_profiles")
      .select("status")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (tutorError) return json({ error: "Could not verify tutor approval." }, 503);
    if (!tutor || tutor.status !== "approved") return json({ error: "Administrator approval is required before checkout." }, 403);
  }

  let tutorId: string | null = null;
  if (contactPayment) {
    if (typeof body.tutor_id !== "string") return json({ error: "A valid tutor is required." }, 400);
    tutorId = body.tutor_id;
    const { data: existingUnlock, error: unlockError } = await db.from("contact_unlocks")
      .select("id")
      .eq("student_id", authData.user.id)
      .eq("tutor_id", tutorId)
      .maybeSingle();
    if (unlockError) return json({ error: "Could not check existing contact access." }, 503);
    if (existingUnlock) return json({ already_unlocked: true, tutor_id: tutorId });

    const { data: tutor, error: tutorError } = await db.from("tutor_profiles")
      .select("status")
      .eq("id", tutorId)
      .maybeSingle();
    if (tutorError) return json({ error: "Could not verify tutor availability." }, 503);
    if (!tutor || tutor.status !== "approved") return json({ error: "This tutor is not currently available." }, 404);
    const { data: tutorAccount, error: tutorAccountError } = await db.from("profiles")
      .select("account_status")
      .eq("id", tutorId)
      .maybeSingle();
    if (tutorAccountError) return json({ error: "Could not verify tutor availability." }, 503);
    if (!tutorAccount || tutorAccount.account_status !== "active") return json({ error: "This tutor is not currently available." }, 404);
    const { data: tutorContact, error: tutorContactError } = await db.from("tutor_contacts")
      .select("phone,email")
      .eq("tutor_id", tutorId)
      .maybeSingle();
    if (tutorContactError) return json({ error: "Could not verify whether contact details are available." }, 503);
    if (!tutorContact || (!tutorContact.phone && !tutorContact.email)) {
      return json({ error: "This tutor has not listed contact details yet." }, 409);
    }
  } else if (body.action === "premium") {
    tutorPlan = typeof body.plan === "string" ? plans[body.plan] : undefined;
    if (!tutorPlan) return json({ error: "Choose a valid tutor plan." }, 400);
  }

  let callbackUrl: string;
  try {
    const callback = new URL(String(body.callback_url ?? ""));
    if (callback.protocol !== "https:" && callback.hostname !== "localhost" && callback.hostname !== "127.0.0.1") {
      return json({ error: "Checkout callback must use HTTPS." }, 400);
    }
    callbackUrl = callback.toString();
  } catch {
    return json({ error: "A valid checkout callback URL is required." }, 400);
  }

  const purpose = contactPayment ? "contact" : body.action === "resource" ? "resource" : "premium";
  const amount = contactPayment ? contactFee : purpose === "resource" ? resourceFee : tutorPlan!.amount;
  const reference = `TC-${crypto.randomUUID().slice(0, 12)}`;
  const { error: insertError } = await db.from("payments").insert({
    user_id: authData.user.id,
    purpose,
    tutor_id: tutorId,
    plan_days: tutorPlan?.days ?? null,
    amount,
    provider_ref: reference,
  });
  if (insertError) return json({ error: "Could not create a payment record. Please retry." }, 503);

  let initialization: { status?: boolean; data?: { authorization_url?: string } };
  try {
    const response = await fetch(`${paystackUrl}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: authData.user.email,
        amount: amount * 100,
        currency: "GHS",
        reference,
        callback_url: callbackUrl,
      }),
    });
    initialization = await response.json();
    if (!response.ok || !initialization.status || !initialization.data?.authorization_url) {
      const updateError = await markPaymentFailed(reference);
      return json({
        error: updateError
          ? `Paystack could not start checkout, and the pending payment could not be marked failed: ${updateError.message}`
          : "Paystack could not start checkout. Please try again.",
      }, updateError ? 503 : 502);
    }
  } catch {
    const updateError = await markPaymentFailed(reference);
    return json({
      error: updateError
        ? `Paystack could not be reached, and the pending payment could not be marked failed: ${updateError.message}`
        : "Paystack could not be reached. Please try again.",
    }, updateError ? 503 : 502);
  }

  return json({ url: initialization.data.authorization_url, reference });
});
