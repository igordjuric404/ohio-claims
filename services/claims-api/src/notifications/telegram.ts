const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";
const SITE_URL = process.env.SITE_URL ?? "https://bd61526b.ohio-claims-ui.pages.dev";

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

export function isTelegramConfigured(): boolean {
  return BOT_TOKEN.length > 0 && CHAT_ID.length > 0;
}

async function sendMessage(text: string, parseMode: "HTML" | "Markdown" = "HTML"): Promise<void> {
  if (!isTelegramConfigured()) return;

  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Telegram notification failed (${res.status}): ${err}`);
    }
  } catch (err) {
    console.error("Telegram notification error:", err);
  }
}

export async function notifyClaimSubmitted(claimId: string, opts: {
  policyId?: string;
  claimant?: string;
  lossDate?: string;
  city?: string;
  description?: string;
  vehicle?: string;
}): Promise<void> {
  const reviewUrl = `${SITE_URL}/reviewer`;

  const lines = [
    `🆕 <b>New Claim Submitted</b>`,
    ``,
    `<b>Claim:</b> <code>${claimId}</code>`,
  ];

  if (opts.policyId) lines.push(`<b>Policy:</b> ${esc(opts.policyId)}`);
  if (opts.claimant) lines.push(`<b>Claimant:</b> ${esc(opts.claimant)}`);
  if (opts.vehicle) lines.push(`<b>Vehicle:</b> ${esc(opts.vehicle)}`);
  if (opts.lossDate) lines.push(`<b>Date of Loss:</b> ${esc(opts.lossDate)}`);
  if (opts.city) lines.push(`<b>City:</b> ${esc(opts.city)}`);
  if (opts.description) {
    const desc = opts.description.length > 120
      ? opts.description.slice(0, 120) + "…"
      : opts.description;
    lines.push(`<b>Description:</b> ${esc(desc)}`);
  }

  lines.push(``);
  lines.push(`<a href="${reviewUrl}">Open Reviewer Dashboard →</a>`);

  await sendMessage(lines.join("\n"));
}

export async function notifyPipelineComplete(claimId: string, opts: {
  finalStage: string;
  stagesCompleted: string[];
  errors?: string[];
  duration?: number;
}): Promise<void> {
  const reviewUrl = `${SITE_URL}/reviewer`;
  const hasErrors = opts.errors && opts.errors.length > 0;
  const icon = hasErrors ? "⚠️" : "✅";

  const lines = [
    `${icon} <b>Pipeline Complete</b>`,
    ``,
    `<b>Claim:</b> <code>${claimId}</code>`,
    `<b>Final Stage:</b> ${esc(opts.finalStage)}`,
    `<b>Stages:</b> ${opts.stagesCompleted.length}/5`,
  ];

  if (opts.duration) lines.push(`<b>Duration:</b> ${opts.duration}s`);
  if (hasErrors) {
    lines.push(`<b>Errors:</b> ${esc(opts.errors!.join("; ").slice(0, 200))}`);
  }

  lines.push(``);
  lines.push(`<a href="${reviewUrl}">Review Claim →</a>`);

  await sendMessage(lines.join("\n"));
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
