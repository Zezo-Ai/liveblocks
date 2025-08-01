import type {
  AiChatMessage,
  AiToolInvocationPart,
  AiToolInvocationProps,
  CopilotId,
  JsonObject,
  ToolResultResponse,
} from "@liveblocks/core";
import { kInternal } from "@liveblocks/core";
import { useClient } from "@liveblocks/react";
import { useSignal } from "@liveblocks/react/_private";
import { type FunctionComponent, useCallback, useMemo } from "react";

import { AiToolInvocationContext } from "./contexts";

type OpaqueAiToolInvocationProps = AiToolInvocationProps<
  JsonObject,
  JsonObject
>;

function StableRenderFn(props: {
  renderFn: FunctionComponent<OpaqueAiToolInvocationProps>;
  props: OpaqueAiToolInvocationProps;
}) {
  return props.renderFn(props.props);
}

/**
 * @internal
 *
 * This could become publicly exposed as <AiMessage.ToolInvocation /> in the future,
 * but because namespace exports can't be marked `@internal`, we're keeping it in its
 * own file for now.
 */
export function AiMessageToolInvocation({
  message,
  part,
  copilotId,
}: {
  message: AiChatMessage;
  part: AiToolInvocationPart;
  copilotId?: string;
}) {
  const client = useClient();
  const ai = client[kInternal].ai;
  const tool = useSignal(ai.signals.getToolΣ(part.name, message.chatId));

  const respond = useCallback(
    (result: ToolResultResponse | undefined) => {
      if (message.status !== "awaiting-tool") {
        // console.log("Ignoring respond(): message not awaiting tool result");
      } else if (part.stage === "receiving") {
        // console.log(
        //   `Ignoring respond(): tool '${part.name}' (${part.invocationId}) is still receiving`
        // );
      } else if (part.stage === "executed") {
        console.log(
          `Ignoring respond(): tool '${part.name}' (${part.invocationId}) has already executed`
        );
      } else {
        ai.setToolResult(
          message.chatId,
          message.id,
          part.invocationId,
          result ?? { data: {} },
          { copilotId: copilotId as CopilotId }
        );
      }
    },
    [
      ai,
      message.chatId,
      message.id,
      message.status,
      part.invocationId,
      part.name,
      part.stage,
      copilotId,
    ]
  );

  const props = useMemo(() => {
    const { type: _, ...rest } = part;
    return {
      ...rest,
      respond,
      types: undefined as never,
      [kInternal]: {
        execute: tool?.execute,
      },
    };
  }, [part, respond, tool?.execute]);

  if (tool?.render === undefined) return null;
  return (
    <AiToolInvocationContext.Provider value={props}>
      <StableRenderFn
        renderFn={tool.render as FunctionComponent<OpaqueAiToolInvocationProps>}
        props={props}
      />
    </AiToolInvocationContext.Provider>
  );
}
