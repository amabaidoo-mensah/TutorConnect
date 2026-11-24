import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const model = "gemini-3.8-flash";
const maxMessageLength = 2000;
const maxTurns = 12;

type ChatMessage = { role: "user" | "model"; text: string };

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (message.role === "user" || message.role === "model")
    && typeof message.text === "string"
    && message.text.trim().length > 0
    && message.text.length <= maxMessageLength;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return response({});
  if (req.method !== "POST") return response({ error: "Method not allowed." }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !supabaseUrl || !serviceRoleKey) {
    return response({ error: "The student assistant is not configured yet." }, 503);
  }

  const authorization = req.headers.get("authorization") ?? "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return response({ error: "Sign in to use the student assistant." }, 401);

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await db.auth.getUser(accessToken);
  if (authError || !authData.user) return response({ error: "Your session is invalid. Please sign in again." }, 401);

  const { data: profile, error: profileError } = await db.from("profiles")
    .select("account_status")
    .eq("id", authData.user.id)
    .single();
  if (profileError) return response({ error: "Could not verify your account. Please try again." }, 503);
  if (!profile || profile.account_status !== "active") {
    return response({ error: "An active TutorConnect account is required to use the assistant." }, 403);
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 30000) return response({ error: "This conversation is too long. Start a new message." }, 413);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return response({ error: "The chat request was not valid JSON." }, 400);
  }

  if (!payload || typeof payload !== "object" || !Array.isArray((payload as Record<string, unknown>).messages)) {
    return response({ error: "Send a list of chat messages." }, 400);
  }
  const messages = (payload as { messages: unknown[] }).messages;
  if (!messages.length || messages.length > maxTurns) {
    return response({ error: "Send up to 12 valid messages ending with your question." }, 400);
  }
  const chatMessages = messages.filter(isChatMessage);
  if (chatMessages.length !== messages.length || chatMessages[chatMessages.length - 1]?.role !== "user") {
    return response({ error: "Send up to 12 valid messages ending with your question." }, 400);
  }

  const { data: allowed, error: quotaError } = await db.rpc("consume_student_assistant_quota", {
    p_user_id: authData.user.id,
  });
  if (quotaError) return response({ error: "Could not check assistant usage limits. Please try again." }, 503);
  if (!allowed) return response({ error: "You’ve reached the assistant limit. Please wait a minute or try again tomorrow." }, 429);

  const systemInstruction = [
    "You are TutorConnect Student Assistant, a friendly study and app-help assistant.",
    "Answer questions across all academic and general knowledge fields, including mathematics, science, technology, languages, arts, humanities, business, careers and everyday learning.",
    "For learning questions, explain clearly, use worked examples where useful, show steps, adapt to the student's level, offer a short quiz or practice when appropriate, and distinguish facts from estimates or uncertainty.",
    "Be honest when unsure. Do not pretend to browse the web or see a user's account, payments, private tutor contacts, or live course catalogue.",
    "For TutorConnect, you may explain these known features: approved tutor discovery, course and institution filters, public learning resources, student activity, and direct administrator support.",
    "Never invent tutor identities, course codes, prices, payment status, availability, university endorsements, or policy details. For unsupported app-specific facts, say you cannot verify them and direct the student to an administrator.",
    "Administrator contact: baidoomensahama@gmail.com and 0245664985. WhatsApp support is available at https://wa.me/2332456698495.",
    "Do not request passwords, payment card details, authentication codes, or other sensitive information. Do not claim that a message was sent or a booking/payment was made.",
    "You provide educational information, not professional medical, legal, or financial advice. Keep replies concise and suitable for students.",
  ].join(" ");

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: chatMessages.map((message) => ({
            role: message.role,
            parts: [{ text: message.text }],
          })),
          generationConfig: { maxOutputTokens: 700, temperature: 0.6 },
        }),
        signal: AbortSignal.timeout(60000),
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return response({ error: "The AI response took too long. Please try again with a shorter question." }, 504);
    }
    return response({ error: "The AI service could not be reached. Please try again or contact an administrator." }, 502);
  }

  if (!geminiResponse.ok) {
    if (geminiResponse.status === 429) {
      return response({ error: "The Gemini free-tier limit is temporarily reached. Please try again later." }, 429);
    }
    if (geminiResponse.status === 401 || geminiResponse.status === 403) {
      return response({ error: "The Gemini API key needs to be checked by the administrator." }, 503);
    }
    return response({ error: "The AI service could not answer right now. Please try again later." }, 502);
  }

  let result: {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  try {
    result = await geminiResponse.json();
  } catch {
    return response({ error: "The AI service returned an unreadable response. Please try again." }, 502);
  }

  const reply = result.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!reply) return response({ error: "The AI service could not provide a response. Please rephrase your question." }, 502);

  return response({ reply });
});
