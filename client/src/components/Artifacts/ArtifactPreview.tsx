import React, { memo, useMemo } from 'react';
import {
  SandpackPreview,
  SandpackProvider,
  SandpackProviderProps,
} from '@codesandbox/sandpack-react/unstyled';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react/unstyled';
import type { TStartupConfig } from 'librechat-data-provider';
import type { ArtifactFiles } from '~/common';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import supersub from 'remark-supersub';
import rehypeHighlight from 'rehype-highlight';
import InlineChart from '~/components/Chat/Messages/Content/InlineChart';
import CodeBlock from '~/components/Messages/Content/CodeBlock';
import { a, p } from '~/components/Chat/Messages/Content/MarkdownComponents';
import { ArtifactProvider, CodeBlockProvider } from '~/Providers';
import { handleDoubleClick, langSubset } from '~/utils';
import { sharedFiles, sharedOptions } from '~/utils/artifacts';

// Custom code component for artifacts that bypasses streaming detection
const ArtifactCodeComponent = memo(({ className, children }: { className?: string; children: React.ReactNode }) => {
  const match = /language-(\w+)/.exec(className ?? '');
  const lang = match && match[1];
  const isChart = lang === 'chart';
  const isSingleLine = typeof children === 'string' && children.split('\n').length === 1;

  if (isChart && typeof children === 'string') {
    // For artifacts, always render the chart directly (no streaming detection)
    return <InlineChart content={children} fallbackToCodeBlock />;
  } else if (isSingleLine) {
    return (
      <code onDoubleClick={handleDoubleClick} className={className}>
        {children}
      </code>
    );
  } else {
    return (
      <CodeBlock
        lang={lang ?? 'text'}
        codeChildren={children}
        blockIndex={0}
        allowExecution={false}
      />
    );
  }
});

// Simple function to detect if content looks like markdown
const isMarkdownContent = (content: string): boolean => {
  if (!content || typeof content !== 'string') return false;
  
  const markdownPatterns = [
    /^#\s+/m,           // Headers
    /^\*\s+/m,          // Bullet lists
    /^\d+\.\s+/m,       // Numbered lists
    /\*\*.*?\*\*/,      // Bold text
    /\*.*?\*/,          // Italic text
    /`.*?`/,            // Inline code
    /```[\s\S]*?```/,   // Code blocks
    /\[.*?\]\(.*?\)/,   // Links
  ];
  
  return markdownPatterns.some(pattern => pattern.test(content));
};

export const ArtifactPreview = memo(function ({
  files,
  fileKey,
  template,
  sharedProps,
  previewRef,
  currentCode,
  startupConfig,
}: {
  files: ArtifactFiles;
  fileKey: string;
  template: SandpackProviderProps['template'];
  sharedProps: Partial<SandpackProviderProps>;
  previewRef: React.MutableRefObject<SandpackPreviewRef>;
  currentCode?: string;
  startupConfig?: TStartupConfig;
}) {
  const artifactFiles = useMemo(() => {
    if (Object.keys(files).length === 0) {
      return files;
    }
    const code = currentCode ?? '';
    if (!code) {
      return files;
    }
    return {
      ...files,
      [fileKey]: {
        code,
      },
    };
  }, [currentCode, files, fileKey]);

  const options: typeof sharedOptions = useMemo(() => {
    if (!startupConfig) {
      return sharedOptions;
    }
    const _options: typeof sharedOptions = {
      ...sharedOptions,
      bundlerURL: template === 'static' ? startupConfig.staticBundlerURL : startupConfig.bundlerURL,
    };

    return _options;
  }, [startupConfig, template]);

  if (Object.keys(artifactFiles).length === 0) {
    return null;
  }

  // Check if the current code is markdown and render it directly
  const code = currentCode ?? '';
  
  // If currentCode is empty, try to get content from files
  let actualContent = code;
  if (!actualContent && files[fileKey]) {
    // Check if it's a string directly or an object with code property
    const fileContent = files[fileKey];
    if (typeof fileContent === 'string') {
      actualContent = fileContent;
    } else if (fileContent && typeof fileContent === 'object' && fileContent.code) {
      actualContent = fileContent.code;
    }
  }
  
  // Also try to get content from artifactFiles after they're processed
  const processedContent = artifactFiles[fileKey]?.code || '';
  if (!actualContent && processedContent) {
    actualContent = processedContent;
  }
  
  if (actualContent && isMarkdownContent(actualContent)) {
    const rehypePlugins = [
      [rehypeKatex],
      [
        rehypeHighlight,
        {
          detect: true,
          ignoreMissing: true,
          subset: langSubset,
        },
      ],
    ];

    return (
      <div className="h-full w-full overflow-auto bg-white p-6 dark:bg-gray-900" data-testid="artifact-preview">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ArtifactProvider>
            <CodeBlockProvider>
              <ReactMarkdown
                remarkPlugins={[
                  /** @ts-ignore */
                  supersub,
                  remarkGfm,
                  [remarkMath, { singleDollarTextMath: false }],
                ]}
                /** @ts-ignore */
                rehypePlugins={rehypePlugins}
                components={
                  {
                    code: ArtifactCodeComponent,
                    a,
                    p,
                  } as {
                    [nodeType: string]: React.ElementType;
                  }
                }
              >
                {actualContent}
              </ReactMarkdown>
            </CodeBlockProvider>
          </ArtifactProvider>
        </div>
      </div>
    );
  }

  return (
    <SandpackProvider
      files={{
        ...artifactFiles,
        ...sharedFiles,
      }}
      options={options}
      {...sharedProps}
      template={template}
    >
      <div data-testid="artifact-preview" className="h-full w-full">
        <SandpackPreview
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          tabIndex={0}
          ref={previewRef}
        />
      </div>
    </SandpackProvider>
  );
});
