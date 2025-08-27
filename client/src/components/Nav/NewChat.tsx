import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys, Constants } from 'wrangler-data-provider';
import { TooltipAnchor, NewChatIcon, MobileSidebar, Button, Sidebar } from '@wrangler/client';
import type { TMessage } from 'wrangler-data-provider';
import { useLocalize, useNewConvo } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';

export default function NewChat({
  index = 0,
  toggleNav,
  subHeaders,
  isSmallScreen,
  headerButtons,
  navVisible = true,
}: {
  index?: number;
  toggleNav: () => void;
  isSmallScreen?: boolean;
  subHeaders?: React.ReactNode;
  headerButtons?: React.ReactNode;
  navVisible?: boolean;
}) {
  const queryClient = useQueryClient();
  /** Note: this component needs an explicit index passed if using more than one */
  const { newConversation: newConvo } = useNewConvo(index);
  const navigate = useNavigate();
  const localize = useLocalize();
  const { conversation } = store.useCreateConversationAtom(index);

  const clickHandler: React.MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
        window.open('/c/new', '_blank');
        return;
      }
      queryClient.setQueryData<TMessage[]>(
        [QueryKeys.messages, conversation?.conversationId ?? Constants.NEW_CONVO],
        [],
      );
      queryClient.invalidateQueries([QueryKeys.messages]);
      newConvo();
      navigate('/c/new', { state: { focusChat: true } });
      if (isSmallScreen) {
        toggleNav();
      }
    },
    [queryClient, conversation, newConvo, navigate, toggleNav, isSmallScreen],
  );

  return (
    <>
      <div className="flex items-center justify-between py-[2px] md:py-2">
        {/* Left section: Logo only */}
        <div className="flex items-center">
          <div className="flex items-center flex-shrink-0">
            <img
              src={navVisible ? "/assets/branding.png" : "/assets/logo.png"}
              alt="Logo"
              className={cn(
                "object-contain transition-all duration-200",
                navVisible ? "h-8 w-auto max-w-[160px]" : "h-8 w-8"
              )}
            />
          </div>
        </div>
        
        {/* Right section: New Chat + Sidebar Toggle (rightmost) + Mobile Menu + Header Buttons */}
        <div className="flex items-center gap-1">
          {/* New Chat Icon - 2nd rightmost */}
          <TooltipAnchor
            description={localize('com_ui_new_chat')}
            render={
              <Button
                size="icon"
                variant="ghost"
                data-testid="nav-new-chat-button"
                aria-label={localize('com_ui_new_chat')}
                className="h-8 w-8 p-1 hover:bg-surface-hover flex items-center justify-center"
                onClick={clickHandler}
              >
                <NewChatIcon className="h-4 w-4 text-text-primary" />
              </Button>
            }
          />

          {/* Sidebar Toggle Button - RIGHTMOST, always visible */}
          <Button
            size="icon"
            variant="ghost"
            data-testid="sidebar-toggle-button"
            title={navVisible ? localize('com_nav_close_sidebar') : localize('com_nav_open_sidebar')}
            aria-label={navVisible ? localize('com_nav_close_sidebar') : localize('com_nav_open_sidebar')}
            className={cn(
              'h-8 w-8 p-1 transition-transform flex items-center justify-center',
              'text-text-primary opacity-100 visible',
              'hover:bg-surface-hover hover:text-text-primary',
              !navVisible && 'rotate-180'
            )}
            onClick={toggleNav}
          >
            <Sidebar className="h-4 w-4 text-current opacity-100" />
          </Button>

          {/* Mobile hamburger menu - only show on small screens */}
          {isSmallScreen && (
            <TooltipAnchor
              description={localize('com_nav_close_sidebar')}
              render={
                <Button
                  size="icon"
                  variant="outline"
                  data-testid="close-sidebar-button"
                  aria-label={localize('com_nav_close_sidebar')}
                  className="rounded-full border-none bg-transparent p-2 hover:bg-surface-hover md:hidden"
                  onClick={toggleNav}
                >
                  <MobileSidebar className="m-1 inline-flex size-10 items-center justify-center" />
                </Button>
              }
            />
          )}

          {headerButtons}
        </div>
      </div>
      {subHeaders != null ? subHeaders : null}
    </>
  );
}
