import { NextResponse } from "next/server";

export async function GET() {
  try {
    const X_CONSUMER_KEY = process.env.X_CONSUMER_KEY;
    const X_CONSUMER_SECRET = process.env.X_CONSUMER_SECRET;
    const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
    const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

    const allConfigured =
      X_CONSUMER_KEY && X_CONSUMER_SECRET && X_ACCESS_TOKEN && X_ACCESS_TOKEN_SECRET;

    if (!allConfigured) {
      return NextResponse.json(
        {
          connected: false,
          message: "X API credentials not fully configured",
        },
        { status: 200 }
      );
    }

    // Verify credentials by making a simple API call
    const response = await fetch("https://api.twitter.com/2/tweets/search/recent?max_results=10", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.X_BEARER_TOKEN}`,
      },
    });

    if (response.ok) {
      return NextResponse.json({
        connected: true,
        message: "X API is connected and ready to post",
      });
    } else {
      return NextResponse.json({
        connected: false,
        message: "X API credentials are invalid",
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        message: "Failed to verify X API connection",
      },
      { status: 200 }
    );
  }
}
