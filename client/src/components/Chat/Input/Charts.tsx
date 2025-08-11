import React, { memo } from 'react';
import { BarChart } from 'lucide-react';
import { CheckboxButton } from '@librechat/client';
import { Permissions, PermissionTypes } from 'librechat-data-provider';
import { useLocalize, useHasAccess } from '~/hooks';
import { useBadgeRowContext } from '~/Providers';

function Charts() {
  const localize = useLocalize();
  const { charts: chartsData } = useBadgeRowContext();
  const { toggleState: charts, debouncedChange, isPinned } = chartsData;

  const canUseCharts = useHasAccess({
    permissionType: PermissionTypes.CHARTS,
    permission: Permissions.USE,
  });

  if (!canUseCharts) {
    return null;
  }

  return (
    (isPinned || charts) && (
      <CheckboxButton
        className="max-w-fit"
        checked={charts}
        setValue={debouncedChange}
        label={localize('com_ui_charts')}
        isCheckedClassName="border-green-600/40 bg-green-500/10 hover:bg-green-700/10"
        icon={<BarChart className="icon-md" />}
      />
    )
  );
}

export default memo(Charts);
