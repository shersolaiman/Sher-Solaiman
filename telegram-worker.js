/* telegram-worker.js
 * Deploy this file as a Cloudflare Worker.
 * Store BOT_TOKEN and CHAT_ID as Worker secrets/variables.
 */

const ALLOWED_ORIGIN = "*"; // নিরাপত্তার জন্য আপনার সাইটের আসল URL বসান

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGIN === "*" ? "*" : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin),
  });
}

function clean(value, max = 1500) {
  return String(value ?? "").trim().slice(0, max);
}

function htmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "POST only" }, 405, origin);
    }

    try {
      const data = await request.json();

      // Honeypot: আসল ব্যবহারকারী এটি পূরণ করবে না
      if (clean(data.hp, 100)) {
        return json({ ok: true }, 200, origin);
      }

      const name = clean(data.name, 100);
      const email = clean(data.email, 160);
      const brand = clean(data.brand, 160);
      const budget = clean(data.budget, 50);
      const service = clean(data.service, 160);
      const summary = clean(data.summary, 1500);

      if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || service.length < 1 || summary.length < 15) {
        return json({ ok: false, error: "Invalid form data" }, 400, origin);
      }

      if (!env.BOT_TOKEN || !env.CHAT_ID) {
        return json({ ok: false, error: "Telegram is not configured" }, 500, origin);
      }

      const message = [
        "<b>নতুন Website Brief</b>",
        "",
        `<b>নাম:</b> ${htmlEscape(name)}`,
        `<b>Email:</b> ${htmlEscape(email)}`,
        `<b>Brand/Website:</b> ${htmlEscape(brand || "—")}`,
        `<b>Budget:</b> ${htmlEscape(budget || "—")}`,
        `<b>Service:</b> ${htmlEscape(service)}`,
        "",
        `<b>Project brief:</b>\n${htmlEscape(summary)}`,
      ].join("\n");

      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: env.CHAT_ID,
            text: message,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        }
      );

      if (!telegramResponse.ok) {
        const detail = await telegramResponse.text();
        console.error("Telegram API error:", detail);
        return json({ ok: false, error: "Telegram delivery failed" }, 502, origin);
      }

      return json({ ok: true }, 200, origin);
    } catch (error) {
      console.error("Worker error:", error);
      return json({ ok: false, error: "Invalid request" }, 400, origin);
    }
  },
};
