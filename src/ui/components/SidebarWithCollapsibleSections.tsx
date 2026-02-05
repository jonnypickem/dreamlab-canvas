"use client";
/*
 * Documentation:
 * Accordion — https://app.subframe.com/1705d9930727/library?component=Accordion_d2e81e20-863a-4027-826a-991d8910efd9
 * Sidebar with collapsible sections — https://app.subframe.com/1705d9930727/library?component=Sidebar+with+collapsible+sections_47616606-525d-4c53-9481-68784d7159c2
 */

import React from "react";
import { FeatherCircleDashed } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import * as SubframeUtils from "../utils";
import { Accordion } from "./Accordion";

interface NavItemProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
}

const NavItem = React.forwardRef<HTMLDivElement, NavItemProps>(function NavItem(
  {
    selected = false,
    children,
    icon = <FeatherCircleDashed />,
    rightSlot,
    className,
    ...otherProps
  }: NavItemProps,
  ref
) {
  return (
    <div
      className={SubframeUtils.twClassNames(
        "group/fe62dd83 flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 hover:bg-neutral-50 active:bg-neutral-100",
        {
          "bg-neutral-100 hover:bg-neutral-100 active:bg-neutral-100": selected,
        },
        className
      )}
      ref={ref}
      {...otherProps}
    >
      {icon ? (
        <SubframeCore.IconWrapper
          className={SubframeUtils.twClassNames(
            "text-body font-body text-subtext-color",
            { "text-default-font": selected }
          )}
        >
          {icon}
        </SubframeCore.IconWrapper>
      ) : null}
      {children ? (
        <span
          className={SubframeUtils.twClassNames(
            "line-clamp-1 grow shrink-0 basis-0 text-body font-body text-subtext-color",
            { "text-body-bold font-body-bold text-default-font": selected }
          )}
        >
          {children}
        </span>
      ) : null}
      {rightSlot ? <div className="flex items-center">{rightSlot}</div> : null}
    </div>
  );
});

interface NavSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

const NavSection = React.forwardRef<HTMLDivElement, NavSectionProps>(
  function NavSection(
    { children, label, icon = null, className, ...otherProps }: NavSectionProps,
    ref
  ) {
    return (
      <div
        className={SubframeUtils.twClassNames(
          "group/36c53d81 flex w-full cursor-pointer flex-col items-start gap-2",
          className
        )}
        ref={ref}
        {...otherProps}
      >
        <Accordion
          trigger={
            <div className="flex w-full items-center gap-2 rounded-md px-3 py-2 group-hover/36c53d81:bg-neutral-50">
              {icon ? (
                <SubframeCore.IconWrapper className="text-body font-body text-default-font">
                  {icon}
                </SubframeCore.IconWrapper>
              ) : null}
              {label ? (
                <span className="line-clamp-1 grow shrink-0 basis-0 text-caption-bold font-caption-bold text-subtext-color">
                  {label}
                </span>
              ) : null}
              <Accordion.Chevron />
            </div>
          }
          defaultOpen={true}
        >
          {children ? (
            <div className="flex w-full flex-col items-start">{children}</div>
          ) : null}
        </Accordion>
      </div>
    );
  }
);

interface SidebarWithCollapsibleSectionsRootProps
  extends React.HTMLAttributes<HTMLElement> {
  header?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

const SidebarWithCollapsibleSectionsRoot = React.forwardRef<
  HTMLElement,
  SidebarWithCollapsibleSectionsRootProps
>(function SidebarWithCollapsibleSectionsRoot(
  {
    header,
    children,
    footer,
    className,
    ...otherProps
  }: SidebarWithCollapsibleSectionsRootProps,
  ref
) {
  return (
    <nav
      className={SubframeUtils.twClassNames(
        "flex h-full w-60 flex-col items-start border-r border-solid border-neutral-border bg-default-background",
        className
      )}
      ref={ref}
      {...otherProps}
    >
      {header ? (
        <div className="flex w-full flex-col items-start gap-2 border-b border-solid border-neutral-border px-3 py-4">
          {header}
        </div>
      ) : null}
      {children ? (
        <div className="flex w-full grow shrink-0 basis-0 flex-col items-start gap-6 px-4 py-4 overflow-auto">
          {children}
        </div>
      ) : null}
      {footer ? (
        <div className="flex w-full flex-col items-start justify-end gap-2 px-6 py-6">
          {footer}
        </div>
      ) : null}
    </nav>
  );
});

export const SidebarWithCollapsibleSections = Object.assign(
  SidebarWithCollapsibleSectionsRoot,
  {
    NavItem,
    NavSection,
  }
);
