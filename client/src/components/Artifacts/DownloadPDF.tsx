import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import type { Artifact } from '~/common';
import { CheckMark } from '@librechat/client';

const DownloadPDF = ({
  artifact,
  className = '',
}: {
  artifact: Artifact;
  className?: string;
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);

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

  // Check if this artifact contains markdown content
  const isMarkdown = isMarkdownContent(artifact.content || '');

  // Don't render the button if it's not markdown content
  if (!isMarkdown) {
    return null;
  }

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);
      
      // Find the artifact preview element
      const previewElement = document.querySelector('[data-testid="artifact-preview"]') as HTMLElement;
      if (!previewElement) {
        console.error('Preview element not found');
        return;
      }

      // Clone the element to avoid modifying the original
      const clonedElement = previewElement.cloneNode(true) as HTMLElement;
      
      // Create print-optimized HTML
      const printContent = createMarkdownPDF(clonedElement.innerHTML, artifact);
      
      // Open print dialog
      openPrintDialog(printContent);

      setIsDownloaded(true);
      setTimeout(() => setIsDownloaded(false), 3000);

    } catch (error) {
      console.error('PDF download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const createMarkdownPDF = (content: string, artifact: Artifact): string => {
    const title = artifact.title || 'Document';
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        @page {
            margin: 0.75in;
            size: A4;
        }
        
        @media print {
            body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
            
            button, .no-print, [role="button"] {
                display: none !important;
            }
            
            svg {
                max-width: 100% !important;
                height: auto !important;
            }
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: none;
            margin: 0;
            padding: 0;
            background: white;
            font-size: 14px;
        }
        
        .pdf-header {
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 1rem;
            margin-bottom: 2rem;
        }
        
        .pdf-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #111827;
            margin: 0;
        }
        
        /* Markdown styles */
        .prose {
            max-width: none !important;
            color: #374151;
        }
        
        .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {
            color: #111827;
            font-weight: 600;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            page-break-after: avoid;
        }
        
        .prose h1 { font-size: 2em; }
        .prose h2 { font-size: 1.75em; }
        .prose h3 { font-size: 1.5em; }
        .prose h4 { font-size: 1.25em; }
        
        .prose p {
            margin-bottom: 1em;
        }
        
        .prose ul, .prose ol {
            margin: 1em 0;
            padding-left: 1.5em;
        }
        
        .prose li {
            margin: 0.25em 0;
        }
        
        .prose code {
            background: #f3f4f6;
            padding: 0.125em 0.25em;
            border-radius: 0.25em;
            font-size: 0.875em;
            font-family: 'Courier New', monospace;
        }
        
        .prose pre {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 0.5em;
            padding: 1em;
            overflow-x: auto;
            margin: 1em 0;
            font-family: 'Courier New', monospace;
        }
        
        .prose blockquote {
            border-left: 4px solid #3b82f6;
            padding-left: 1em;
            margin: 1em 0;
            font-style: italic;
            background: #f8fafc;
            padding: 1em;
            border-radius: 0.25em;
        }
        
        .prose table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
            page-break-inside: avoid;
        }
        
        .prose th, .prose td {
            border: 1px solid #e5e7eb;
            padding: 0.5em;
            text-align: left;
        }
        
        .prose th {
            background: #f9fafb;
            font-weight: 600;
        }
        
        /* Chart styling */
        .recharts-wrapper {
            background: white !important;
        }
        
        .recharts-cartesian-grid-horizontal line,
        .recharts-cartesian-grid-vertical line {
            stroke: #e5e7eb !important;
        }
        
        /* Ensure images and charts scale properly */
        img, svg, canvas {
            max-width: 100% !important;
            height: auto !important;
            page-break-inside: avoid;
        }
        
        /* Page break handling */
        h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
            page-break-inside: avoid;
        }
        
        .page-break {
            page-break-before: always;
        }
    </style>
</head>
<body>
    <div class="pdf-header">
        <h1 class="pdf-title">${title}</h1>
    </div>
    <div class="pdf-content">
        ${content}
    </div>
</body>
</html>`;
  };

  const openPrintDialog = (htmlContent: string) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      console.error('Could not open print window. Please allow popups and try again.');
      return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    printWindow.addEventListener('load', () => {
      setTimeout(() => {
        printWindow.print();
        setTimeout(() => {
          if (!printWindow.closed) {
            printWindow.close();
          }
        }, 1000);
      }, 500);
    });
  };

  return (
    <button
      className={`mr-2 text-text-secondary hover:text-text-primary transition-colors ${className}`}
      onClick={handleDownloadPDF}
      disabled={isDownloading}
      aria-label="Download as PDF"
      title="Download as PDF (opens print dialog)"
    >
      {isDownloaded ? (
        <CheckMark className="h-4 w-4 text-green-600" />
      ) : (
        <FileText className={`h-4 w-4 ${isDownloading ? 'animate-pulse' : ''}`} />
      )}
    </button>
  );
};

export default DownloadPDF;
