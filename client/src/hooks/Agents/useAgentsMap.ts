import { useMemo } from 'react';
import { PermissionBits } from 'pleach-data-provider';
import type { TAgentsMap } from 'pleach-data-provider';
import { useListAgentsQuery } from '~/data-provider';
import { mapAgents } from '~/utils';

export default function useAgentsMap({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}): TAgentsMap | undefined {
  const { data: mappedAgents = null } = useListAgentsQuery(
    { requiredPermission: PermissionBits.VIEW },
    {
      select: (res) => mapAgents(res.data),
      enabled: isAuthenticated,
    },
  );

  const agentsMap = useMemo<TAgentsMap | undefined>(() => {
    return mappedAgents !== null ? mappedAgents : undefined;
  }, [mappedAgents]);

  return agentsMap;
}
