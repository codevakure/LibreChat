import React from 'react';
import { TooltipAnchor, Button, Sidebar } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface LogoProps {
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
}

export default function Logo({ isExpanded, onToggle, className }: LogoProps) {
  const localize = useLocalize();

  return (
    <div className={cn('relative flex items-center gap-2', className)}>
      {/* Logo Container */}
      <div className="flex items-center flex-shrink-0">
        <img
          src={isExpanded ? "/assets/branding.png" : "/assets/logo.png"}
          alt="Logo"
          className={cn(
            "object-contain transition-all duration-200",
            isExpanded ? "h-8 w-auto max-w-[160px]" : "h-8 w-8"
          )}
        />
      </div>

      {/* Sidebar Toggle Button - always visible, properly aligned */}
      <TooltipAnchor
        description={isExpanded ? localize('com_nav_close_sidebar') : localize('com_nav_open_sidebar')}
        side="bottom"
        render={
          <Button
            size="icon"
            variant="ghost"
            data-testid="sidebar-toggle-button"
            aria-label={isExpanded ? localize('com_nav_close_sidebar') : localize('com_nav_open_sidebar')}
            className={cn(
              'h-8 w-8 p-1 transition-transform hover:bg-surface-hover flex items-center justify-center',
              !isExpanded && 'rotate-180'
            )}
            onClick={onToggle}
          >
            <Sidebar className="h-4 w-4" />
          </Button>
        }
      />
    </div>
  );
}
