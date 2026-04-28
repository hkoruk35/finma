import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get("tag");
  const secret = request.nextUrl.searchParams.get("secret");

  // Verify secret token for security
  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  if (!tag) {
    return NextResponse.json({ error: "Missing tag parameter" }, { status: 400 });
  }

  try {
    // Revalidate page cache by path
    revalidatePath(`/${tag}`);
    return NextResponse.json({ revalidated: true, path: `/${tag}` }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to revalidate", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
