import { useRef, useState, useEffect } from 'react';
import { useSetRecoilState } from 'recoil';
import * as Tabs from '@radix-ui/react-tabs';
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react';
import type { SandpackPreviewRef, CodeEditorRef } from '@codesandbox/sandpack-react';
import useArtifacts from '~/hooks/Artifacts/useArtifacts';
import DownloadArtifact from './DownloadArtifact';
import DownloadPDF from './DownloadPDF';
import { useEditorContext } from '~/Providers';
import ArtifactTabs from './ArtifactTabs';
import { CopyCodeButton } from './Code';
import { useLocalize } from '~/hooks';
import store from '~/store';

export default function Artifacts() {
  const localize = useLocalize();
  const { isMutating } = useEditorContext();
  const editorRef = useRef<CodeEditorRef>();
  const previewRef = useRef<SandpackPreviewRef>();
  const [isVisible, setIsVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const setArtifactsVisible = useSetRecoilState(store.artifactsVisibility);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const {
    activeTab,
    isMermaid,
    setActiveTab,
    currentIndex,
    cycleArtifact,
    currentArtifact,
    orderedArtifactIds,
  } = useArtifacts();

  if (currentArtifact === null || currentArtifact === undefined) {
    return null;
  }

  const handleRefresh = () => {
    setIsRefreshing(true);
    const client = previewRef.current?.getClient();
    if (client != null) {
      client.dispatch({ type: 'refresh' });
    }
    setTimeout(() => setIsRefreshing(false), 750);
  };

  const closeArtifacts = () => {
    setIsVisible(false);
    setTimeout(() => setArtifactsVisible(false), 300);
  };

  return (
    <Tabs.Root value={activeTab} onValueChange={setActiveTab} asChild>
      {/* Main Parent */}
      <div className="flex h-full w-full items-center justify-center">
        {/* Main Container */}
        <div
          className={`flex h-full w-full flex-col overflow-hidden bg-surface-primary text-xl text-text-primary shadow-[-4px_0_16px_rgba(0,0,0,0.08)] transition-all duration-500 ease-in-out ${
            isVisible ? 'scale-100 opacity-100 blur-0' : 'scale-105 opacity-0 blur-sm'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-1.5" style={{ backgroundColor: 'var(--sp-colors-surface1)' }}>
            <div className="flex items-center">
              <button className="mr-2 rounded-full p-1 text-gray-400 transition-all duration-200 hover:bg-gray-700 hover:text-gray-200" onClick={closeArtifacts}>
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <h3 className="truncate text-xs font-medium text-gray-200">{currentArtifact.title}</h3>
            </div>
            <div className="flex items-center">
              {/* Refresh button */}
              {activeTab === 'preview' && (
                <button
                  className={`mr-2 rounded-full p-1 text-gray-400 transition-all duration-200 hover:bg-gray-700 hover:text-gray-200 ${
                    isRefreshing ? 'rotate-180' : ''
                  }`}
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  aria-label="Refresh"
                >
                  <RefreshCw
                    size={14}
                    className={`transform ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                </button>
              )}
              {activeTab !== 'preview' && isMutating && (
                <RefreshCw size={14} className="mr-2 animate-spin text-gray-400" />
              )}
              {/* Tabs */}
              <Tabs.List className="mr-2 inline-flex h-6 rounded-lg bg-gray-800 backdrop-blur-sm">
                <Tabs.Trigger
                  value="preview"
                  disabled={isMutating}
                  className="flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium text-gray-300 transition-all duration-200 data-[state=active]:bg-gray-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  {localize('com_ui_preview')}
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="code"
                  className="flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium text-gray-300 transition-all duration-200 data-[state=active]:bg-gray-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  {localize('com_ui_code')}
                </Tabs.Trigger>
              </Tabs.List>
              <button className="rounded-full p-1 text-gray-400 transition-all duration-200 hover:bg-gray-700 hover:text-gray-200" onClick={closeArtifacts}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {/* Content */}
          <ArtifactTabs
            isMermaid={isMermaid}
            artifact={currentArtifact}
            editorRef={editorRef as React.MutableRefObject<CodeEditorRef>}
            previewRef={previewRef as React.MutableRefObject<SandpackPreviewRef>}
          />
          {/* Footer */}
          <div className="flex items-center justify-between p-1.5 text-xs text-gray-400" style={{ backgroundColor: 'var(--sp-colors-surface1)' }}>
            <div className="flex items-center">
              <button onClick={() => cycleArtifact('prev')} className="mr-2 rounded-full p-1 text-gray-400 transition-all duration-200 hover:bg-gray-700 hover:text-gray-200">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs font-medium">{`${currentIndex + 1} / ${
                orderedArtifactIds.length
              }`}</span>
              <button onClick={() => cycleArtifact('next')} className="ml-2 rounded-full p-1 text-gray-400 transition-all duration-200 hover:bg-gray-700 hover:text-gray-200">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <CopyCodeButton content={currentArtifact.content ?? ''} />
              {/* Download Buttons */}
              <DownloadArtifact artifact={currentArtifact} />
              <DownloadPDF artifact={currentArtifact} />
              {/* Publish button */}
              {/* <button className="border-0.5 min-w-[4rem] whitespace-nowrap rounded-md border-border-medium bg-[radial-gradient(ellipse,_var(--tw-gradient-stops))] from-surface-active from-50% to-surface-active px-3 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-surface-active hover:text-text-primary active:scale-[0.985] active:bg-surface-active">
                Publish
              </button> */}
            </div>
          </div>
        </div>
      </div>
    </Tabs.Root>
  );
}
