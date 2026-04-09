import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const MESSAGES_FILE = path.join(process.cwd(), "data", "messages.json");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, subject, message } = body;

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Load existing messages
    let messages = [];
    if (fs.existsSync(MESSAGES_FILE)) {
      const data = fs.readFileSync(MESSAGES_FILE, "utf-8");
      messages = JSON.parse(data);
    }

    const newMessage = {
      id: Date.now(),
      date: new Date().toISOString(),
      name,
      email,
      subject,
      message: message.substring(0, 1000),
      isRead: false
    };

    messages.unshift(newMessage); // Newest first

    // Ensure directory exists
    const dataDir = path.dirname(MESSAGES_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact API error:", error);
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }
}
