// scan-receipt: reads a receipt photo OR a bank/card transaction screenshot with Claude.
// Deployed to the Smalljoy Supabase project as edge function "scan-receipt" (verify_jwt on).
// Only signed-in users can call it, and the Anthropic key lives in the function's secrets
// (ANTHROPIC_API_KEY), never in the page.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "Receipt scanning isn't set up yet: add ANTHROPIC_API_KEY to this function's secrets." }, 500);

  let body: { image?: string; media_type?: string; categories?: string[]; today?: string };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const { image, media_type = "image/jpeg", categories = [], today = "" } = body;
  if (!image || typeof image !== "string") return json({ error: "No image" }, 400);
  if (image.length > 6_000_000) return json({ error: "Image too large" }, 413);

  const prompt = `This image is either (a) a photo of a single receipt, or (b) a screenshot of a bank / credit card / payment app transaction list. Decide which, then reply with ONLY a JSON object, no prose, no code fences.

If it is a single receipt:
{"kind": "receipt",
 "amount": number (the final total actually paid, after tax and tip; null if unreadable),
 "date": "YYYY-MM-DD" or null,
 "merchant": "store or business name" or null,
 "category": one of ${JSON.stringify(categories)} (best fit; null if none fits),
 "items": ["up to 6 short line items"],
 "confidence": "high" | "medium" | "low"}

If it is a transaction list:
{"kind": "statement",
 "transactions": [
   {"date": "YYYY-MM-DD" or null, "merchant": "cleaned-up merchant name", "amount": positive number,
    "type": "debit" (money out) | "credit" (money in: deposits, refunds, payments received, transfers in),
    "category": one of ${JSON.stringify(categories)} or null}
 ],
 "confidence": "high" | "medium" | "low"}
List every visible transaction, in the order shown. Skip "pending" labels, running balances, and section headers. Clean merchant names ("SQ *BLUE BOTTLE 4821" -> "Blue Bottle").

Today is ${today || "unknown"}. If a date shows only month and day, assume the most recent occurrence not after today. If the image is neither, return {"kind": "receipt", "amount": null, "date": null, "merchant": null, "category": null, "items": [], "confidence": "low"}.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type, data: image } },
        { type: "text", text: prompt },
      ]}],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    const friendly = res.status === 401 ? "The Anthropic API key was rejected. Check the ANTHROPIC_API_KEY secret."
      : res.status === 400 && /credit|billing/i.test(detail) ? "The Anthropic account is out of API credit."
      : `Claude API error (${res.status}).`;
    return json({ error: friendly, detail: detail.slice(0, 300) }, 502);
  }
  const data = await res.json();
  const text = (data.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return json({ ok: true, ...parsed });
  } catch {
    return json({ error: "Couldn't read that image. Try a clearer, straight-on photo.", raw: text.slice(0, 300) }, 422);
  }
});
