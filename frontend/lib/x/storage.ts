import { supabaseAdmin } from "@/lib/supabase-admin";

const BUCKET = "x-posts";

// X'e atilirken uretilen kart gorselini (satori+resvg PNG) kalici olarak
// saklar, boylece /news akisi ayni gorseli gosterebilir (X'in kendi medya
// URL'i public API uzerinden kolay erisilebilir degil).
export async function uploadPostImage(postId: string, buffer: Buffer): Promise<string | null> {
  const path = `${postId}.png`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
    contentType: "image/png",
    upsert: true,
  });
  if (error) {
    console.error("[x/storage] image upload failed:", error.message);
    return null;
  }
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
