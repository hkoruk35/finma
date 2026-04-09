import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const MESSAGES_FILE = path.join(process.cwd(), "data", "messages.json");

export async function GET() {
  try {
    if (!fs.existsSync(MESSAGES_FILE)) {
      return NextResponse.json([]);
    }
    const data = fs.readFileSync(MESSAGES_FILE, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!fs.existsSync(MESSAGES_FILE)) return NextResponse.json({ success: true });

    const data = fs.readFileSync(MESSAGES_FILE, "utf-8");
    const messages = JSON.parse(data).filter((m: any) => m.id !== id);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
    try {
      const { id } = await req.json();
      if (!fs.existsSync(MESSAGES_FILE)) return NextResponse.json({ success: true });
  
      const data = fs.readFileSync(MESSAGES_FILE, "utf-8");
      const messages = JSON.parse(data).map((m: any) => 
        m.id === id ? { ...m, isRead: true } : m
      );
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
  
      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
    }
}
