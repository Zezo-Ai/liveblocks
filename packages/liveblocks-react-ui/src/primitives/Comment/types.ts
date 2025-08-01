import type { CommentBody, MentionData } from "@liveblocks/core";
import type { ComponentType, ReactNode } from "react";

import type { ComponentPropsWithSlot } from "../../types";

export type CommentMentionProps = ComponentPropsWithSlot<"span">;

export type CommentBodyMentionProps = {
  /**
   * The mention to display.
   */
  mention: MentionData;
};

export type CommentLinkProps = ComponentPropsWithSlot<"a">;

export interface CommentBodyLinkProps {
  /**
   * The link's absolute URL.
   *
   * @example "https://example.com"
   */
  href: string;

  /**
   * The link's content.
   *
   * @example "www.example.com", "a link", etc.
   */
  children: ReactNode;
}

export interface CommentBodyComponents {
  /**
   * The component used to display mentions.
   */
  Mention: ComponentType<CommentBodyMentionProps>;

  /**
   * The component used to display links.
   */
  Link: ComponentType<CommentBodyLinkProps>;
}

export interface CommentBodyProps extends ComponentPropsWithSlot<"div"> {
  /**
   * The comment body to display.
   * If not defined, the component will render `null`.
   */
  body?: CommentBody;

  /**
   * The components displayed within the comment body.
   */
  components?: Partial<CommentBodyComponents>;
}
