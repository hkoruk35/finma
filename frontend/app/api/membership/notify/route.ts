import { NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = "8501733970:AAHM1l2wkPRKOWQdtq8jRqWZazGQhYteH5k";
const TELEGRAM_CHAT_ID = "-1003569445341";

export async function POST(request: Request) {
  try {
    const { event, details } = await request.json();

    let emoji = "🔔";
    let title = "Membership Alert";

    if (event === "free_join") {
      emoji = "🆕✨";
      title = "New Free Member Joined";
    } else if (event === "pro_join") {
      emoji = "💰🚀";
      title = "New PRO Member Joined";
    } else if (event === "pro_renew") {
      emoji = "♻️💎";
      title = "PRO Membership Renewed";
    } else if (event === "pro_cancel") {
      emoji = "❌📉";
      title = "PRO Membership Cancelled";
    }

    const message = `
<b>${emoji} ${title}</b>
──────────────────
<b>Event:</b> ${event.toUpperCase()}
<b>User:</b> ${details?.email || "Anonymous"}
<b>Date:</b> ${new Date().toLocaleString()}

<b>Current Statistics:</b>
• Total Free Members: <i>[Pending DB Sync]</i>
• Total PRO Members: <i>[Pending DB Sync]</i>

<i>BOGA AI System Notification</i>
    `;

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Telegram notification error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
