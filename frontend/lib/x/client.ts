import { TwitterApi } from "twitter-api-v2";

// @bogastock hesabina tweet atmak icin user-context OAuth 1.0a istemcisi.
// X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET, Developer Portal > Keys and tokens >
// Access Token and Secret (Read and Write izniyle) olusturulmalidir.
export function getXClient(): TwitterApi {
  const {
    X_CONSUMER_KEY,
    X_CONSUMER_SECRET,
    X_ACCESS_TOKEN,
    X_ACCESS_TOKEN_SECRET,
  } = process.env;

  if (!X_CONSUMER_KEY || !X_CONSUMER_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
    throw new Error("X_STUDIO_NOT_CONFIGURED: consumer/access token env degiskenleri eksik");
  }

  return new TwitterApi({
    appKey: X_CONSUMER_KEY,
    appSecret: X_CONSUMER_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_TOKEN_SECRET,
  });
}

export async function postTweet(text: string, imageBuffer?: Buffer): Promise<string> {
  const client = getXClient().readWrite;

  let mediaId: string | undefined;
  if (imageBuffer) {
    mediaId = await client.v1.uploadMedia(imageBuffer, { mimeType: "image/png" });
  }

  const { data } = await client.v2.tweet({
    text,
    ...(mediaId ? { media: { media_ids: [mediaId] } } : {}),
  });

  return data.id;
}
