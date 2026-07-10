import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const X_CONSUMER_KEY = process.env.X_CONSUMER_KEY || "";
const X_CONSUMER_SECRET = process.env.X_CONSUMER_SECRET || "";
const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN || "";
const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET || "";

function generateSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(
      Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    ),
  ].join("&");

  return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
}

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ message: "Invalid tweet content" }, { status: 400 });
    }

    if (content.length > 280) {
      return NextResponse.json({ message: "Tweet too long (max 280 characters)" }, { status: 400 });
    }

    if (!X_CONSUMER_KEY || !X_CONSUMER_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
      return NextResponse.json(
        { message: "X API credentials not configured" },
        { status: 500 }
      );
    }

    const url = "https://api.twitter.com/2/tweets";

    // OAuth 1.0a parameters
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: X_CONSUMER_KEY,
      oauth token: X_ACCESS_TOKEN,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: crypto.randomBytes(16).toString("hex"),
      oauth_version: "1.0",
    };

    const signature = generateSignature(
      "POST",
      url,
      { ...oauthParams, text: content },
      X_CONSUMER_SECRET,
      X_ACCESS_TOKEN_SECRET
    );

    oauthParams.oauth_signature = signature;

    const authHeader = `OAuth ${Object.entries(oauthParams)
      .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
      .join(", ")}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ text: content }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("X API Error:", data);
      return NextResponse.json(
        { message: data.detail || "Failed to post tweet" },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      tweetId: data.data?.id,
      message: "Tweet posted successfully",
    });
  } catch (error) {
    console.error("Error posting tweet:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
