import { LiveList, LiveObject } from "@liveblocks/client";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from "@liveblocks/react/suspense";
import { Room } from "./Room";

export default function App() {
  const roomId = "{% ROOM_ID %}";
  const publicApiKey = "{% LIVEBLOCKS_PUBLIC_KEY %}";

  return (
    <LiveblocksProvider
      publicApiKey={publicApiKey}
      key={Math.random() /* Fixes a tutorial bug, don't do this */}
    >
      <RoomProvider
        id={roomId}
        initialStorage={{
          person: new LiveObject({ name: "Marie", age: 30 }),
        }}
      >
        <ClientSideSuspense fallback={<div>Loading…</div>}>
          <Room />
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
