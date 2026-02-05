"use client";
/*
 * Documentation:
 * Avatar — https://app.subframe.com/1705d9930727/library?component=Avatar_bec25ae6-5010-4485-b46b-cf79e3943ab2
 * Chat Channel Message — https://app.subframe.com/1705d9930727/library?component=Chat+Channel+Message_15407223-508a-4685-88e7-8681fa9cc4d6
 */

import React from "react";
import * as SubframeUtils from "../utils";
import { Avatar } from "./Avatar";

interface ChatChannelMessageRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  avatar?: string;
  author?: React.ReactNode;
  timestamp?: React.ReactNode;
  children?: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
}

const ChatChannelMessageRoot = React.forwardRef<
  HTMLDivElement,
  ChatChannelMessageRootProps
>(function ChatChannelMessageRoot(
  {
    avatar,
    author,
    timestamp,
    children,
    toolbar,
    className,
    ...otherProps
  }: ChatChannelMessageRootProps,
  ref
) {
  return (
    <div
      className={SubframeUtils.twClassNames(
        "group/15407223 flex w-full cursor-pointer items-start gap-4 rounded-md px-4 py-4 hover:bg-neutral-50",
        className
      )}
      ref={ref}
      {...otherProps}
    >
      <Avatar size="large" image={avatar}>
        JD
      </Avatar>
      <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
        <div className="flex w-full flex-wrap items-center gap-2">
          {author ? (
            <span className="text-body-bold font-body-bold text-default-font">
              {author}
            </span>
          ) : null}
          {timestamp ? (
            <span className="text-caption font-caption text-subtext-color">
              {timestamp}
            </span>
          ) : null}
        </div>
        {children ? (
          <div className="flex w-full flex-col items-start gap-2">
            {children}
          </div>
        ) : null}
        {toolbar ? (
          <div className="flex items-center gap-1 pt-2">{toolbar}</div>
        ) : null}
      </div>
    </div>
  );
});

export const ChatChannelMessage = ChatChannelMessageRoot;
