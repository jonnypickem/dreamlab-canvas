"use client";
/*
 * Documentation:
 * Avatar — https://app.subframe.com/1705d9930727/library?component=Avatar_bec25ae6-5010-4485-b46b-cf79e3943ab2
 * Badge — https://app.subframe.com/1705d9930727/library?component=Badge_97bdb082-1124-4dd7-a335-b14b822d0157
 * Chat Channels Menu — https://app.subframe.com/1705d9930727/library?component=Chat+Channels+Menu_9f9e357a-0cd0-4dca-b155-8b6e30cce3cf
 * Default Page Layout — https://app.subframe.com/1705d9930727/library?component=Default+Page+Layout_a57b1c43-310a-493f-b807-8cc88e2452cf
 * Dropdown Menu — https://app.subframe.com/1705d9930727/library?component=Dropdown+Menu_99951515-459b-4286-919e-a89e7549b43b
 * Icon Button — https://app.subframe.com/1705d9930727/library?component=Icon+Button_af9405b1-8c54-4e01-9786-5aad308224f6
 */

import React from "react";
import { FeatherChevronDown } from "@subframe/core";
import { FeatherFolder } from "@subframe/core";
import { FeatherLayoutGrid } from "@subframe/core";
import { FeatherSearch } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import { Avatar } from "../components/Avatar";
import { Badge } from "../components/Badge";
import { ChatChannelsMenu } from "../components/ChatChannelsMenu";
import { DropdownMenu } from "../components/DropdownMenu";
import { IconButton } from "../components/IconButton";
import * as SubframeUtils from "../utils";

interface DefaultPageLayoutRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

const DefaultPageLayoutRoot = React.forwardRef<
  HTMLDivElement,
  DefaultPageLayoutRootProps
>(function DefaultPageLayoutRoot(
  { children, className, ...otherProps }: DefaultPageLayoutRootProps,
  ref
) {
  return (
    <div
      className={SubframeUtils.twClassNames(
        "flex h-screen w-full items-center",
        className
      )}
      ref={ref}
      {...otherProps}
    >
      <div className="flex flex-col items-start gap-2 self-stretch bg-neutral-100 py-4">
        <div className="flex w-full items-center justify-center gap-2 px-2 py-2">
          <div className="flex h-2.5 w-2.5 flex-none flex-col items-start gap-2 rounded-full bg-brand-600" />
          <div className="flex items-center justify-center gap-2 rounded-lg shadow-lg">
            <Avatar
              variant="neutral"
              size="large"
              image="https://res.cloudinary.com/subframe/image/upload/v1713909352/uploads/279/rsam5v66hcvpj96fr5hc.avif"
              square={true}
            >
              A
            </Avatar>
          </div>
          <div className="flex h-2.5 w-2.5 flex-none flex-col items-start gap-2 rounded-full" />
        </div>
      </div>
      <div className="flex w-72 flex-none flex-col items-start gap-2 self-stretch bg-neutral-50 px-4 py-4">
        <div className="flex w-full items-center gap-4">
          <div className="flex grow shrink-0 basis-0 items-center gap-2 px-4 py-4">
            <SubframeCore.DropdownMenu.Root>
              <SubframeCore.DropdownMenu.Trigger asChild={true}>
                <div className="flex items-center gap-2">
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    Dreamlab
                  </span>
                  <FeatherChevronDown className="text-caption font-caption text-default-font" />
                </div>
              </SubframeCore.DropdownMenu.Trigger>
              <SubframeCore.DropdownMenu.Portal>
                <SubframeCore.DropdownMenu.Content
                  side="bottom"
                  align="start"
                  sideOffset={4}
                  asChild={true}
                >
                  <DropdownMenu>
                    <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border px-3 pt-3 pb-4">
                      <Avatar
                        image="https://res.cloudinary.com/subframe/image/upload/v1713909352/uploads/279/rsam5v66hcvpj96fr5hc.avif"
                        square={true}
                      >
                        A
                      </Avatar>
                      <div className="flex grow shrink-0 basis-0 flex-col items-start">
                        <span className="line-clamp-1 w-full text-body-bold font-body-bold text-default-font">
                          Subframe
                        </span>
                        <span className="line-clamp-1 w-full text-caption font-caption text-subtext-color">
                          subframe.com
                        </span>
                      </div>
                    </div>
                    <DropdownMenu.DropdownItem icon={null}>
                      Invite team members
                    </DropdownMenu.DropdownItem>
                    <DropdownMenu.DropdownItem icon={null}>
                      Settings
                    </DropdownMenu.DropdownItem>
                    <DropdownMenu.DropdownItem icon={null}>
                      Sign out
                    </DropdownMenu.DropdownItem>
                  </DropdownMenu>
                </SubframeCore.DropdownMenu.Content>
              </SubframeCore.DropdownMenu.Portal>
            </SubframeCore.DropdownMenu.Root>
          </div>
          <IconButton icon={<FeatherSearch />} />
        </div>
        <ChatChannelsMenu className="w-full grow shrink-0 basis-0">
          <ChatChannelsMenu.Item
            icon={<FeatherLayoutGrid />}
            rightSlot={<Badge variant="neutral">110</Badge>}
          >
            All Items
          </ChatChannelsMenu.Item>
          <ChatChannelsMenu.Folder label="Projects">
            <ChatChannelsMenu.Item icon={<FeatherFolder />}>
              FixedProject
            </ChatChannelsMenu.Item>
            <ChatChannelsMenu.Item icon={<FeatherFolder />}>
              Apple Home
            </ChatChannelsMenu.Item>
          </ChatChannelsMenu.Folder>
        </ChatChannelsMenu>
      </div>
      {children ? (
        <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 self-stretch overflow-y-auto bg-default-background">
          {children}
        </div>
      ) : null}
    </div>
  );
});

export const DefaultPageLayout = DefaultPageLayoutRoot;
