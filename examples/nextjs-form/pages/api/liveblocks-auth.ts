import { Liveblocks } from "@liveblocks/node";
import { NextApiRequest, NextApiResponse } from "next";
import { NAMES } from "../../constants";

/**
 * Authenticating your Liveblocks application
 * https://liveblocks.io/docs/authentication
 */

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
  // TODO: revert this after we're done
  // @ts-expect-error it's ok to use a local baseUrl
  baseUrl: process.env.NEXT_PUBLIC_LIVEBLOCKS_BASE_URL!,
});

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  // For the avatar example, we're generating random users
  // and set their info from the authentication endpoint
  //TODO revert this after experimentation
  const userIndex = 0; //Math.floor(Math.random() * NAMES.length);

  // Create a session for the current user (access token auth)
  const session = liveblocks.prepareSession(`user-${userIndex}`, {
    userInfo: {
      name: NAMES[userIndex],
      avatar: `https://liveblocks.io/avatars/avatar-${Math.floor(
        Math.random() * 30
      )}.png`,
    },
  });

  // Use a naming pattern to allow access to rooms with a wildcard
  session.allow(`liveblocks:examples:*`, session.FULL_ACCESS);

  const { status, body } = await session.authorize();
  res.status(status).end(body);
}
