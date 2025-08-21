import React, { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ModelSelectorProps } from '~/common';
import { ModelSelectorProvider, useModelSelectorContext } from '../Menus/Endpoints/ModelSelectorContext';
import { ModelSelectorChatProvider } from '../Menus/Endpoints/ModelSelectorChatContext';
import { renderModelSpecs, renderEndpoints, renderSearchResults } from '../Menus/Endpoints/components';
import { getSelectedIcon, getDisplayValue } from '../Menus/Endpoints/utils';
import { CustomMenu as Menu } from '../Menus/Endpoints/CustomMenu';
import DialogManager from '../Menus/Endpoints/DialogManager';
import { useLocalize } from '~/hooks';

function ChatModelSelectorContent() {
  const localize = useLocalize();

  const {
    // LibreChat
    agentsMap,
    modelSpecs,
    mappedEndpoints,
    endpointsConfig,
    // State
    searchValue,
    searchResults,
    selectedValues,

    // Functions
    setSearchValue,
    setSelectedValues,
    // Dialog
    keyDialogOpen,
    onOpenChange,
    keyDialogEndpoint,
  } = useModelSelectorContext();

  const selectedIcon = useMemo(
    () =>
      getSelectedIcon({
        mappedEndpoints: mappedEndpoints ?? [],
        selectedValues,
        modelSpecs,
        endpointsConfig,
      }),
    [mappedEndpoints, selectedValues, modelSpecs, endpointsConfig],
  );
  
  const selectedDisplayValue = useMemo(
    () =>
      getDisplayValue({
        localize,
        agentsMap,
        modelSpecs,
        selectedValues,
        mappedEndpoints,
      }),
    [localize, agentsMap, modelSpecs, selectedValues, mappedEndpoints],
  );

  // Compact trigger button for chat input area
  const trigger = (
    <button
      className="flex h-10 max-w-[200px] items-center justify-between gap-2 rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary hover:bg-surface-tertiary transition-colors"
      aria-label={localize('com_ui_select_model')}
    >
      <div className="flex items-center gap-2 min-w-0">
        {selectedIcon && React.isValidElement(selectedIcon) && (
          <div className="flex flex-shrink-0 items-center justify-center overflow-hidden">
            {selectedIcon}
          </div>
        )}
        <span className="truncate text-left flex-1 min-w-0">{selectedDisplayValue}</span>
      </div>
      <ChevronDown className="h-4 w-4 flex-shrink-0" />
    </button>
  );

  return (
    <div className="relative flex items-center">
      <Menu
        values={selectedValues}
        onValuesChange={(values: Record<string, any>) => {
          setSelectedValues({
            endpoint: values.endpoint || '',
            model: values.model || '',
            modelSpec: values.modelSpec || '',
          });
        }}
        onSearch={(value) => setSearchValue(value)}
        combobox={<input placeholder={localize('com_endpoint_search_models')} />}
        trigger={trigger}
      >
        {searchResults ? (
          renderSearchResults(searchResults, localize, searchValue)
        ) : (
          <>
            {renderModelSpecs(modelSpecs, selectedValues.modelSpec || '')}
            {renderEndpoints(mappedEndpoints ?? [])}
          </>
        )}
      </Menu>
      <DialogManager
        keyDialogOpen={keyDialogOpen}
        onOpenChange={onOpenChange}
        endpointsConfig={endpointsConfig || {}}
        keyDialogEndpoint={keyDialogEndpoint || undefined}
      />
    </div>
  );
}

export default function ChatModelSelector({ startupConfig }: ModelSelectorProps) {
  return (
    <ModelSelectorChatProvider>
      <ModelSelectorProvider startupConfig={startupConfig}>
        <ChatModelSelectorContent />
      </ModelSelectorProvider>
    </ModelSelectorChatProvider>
  );
}
