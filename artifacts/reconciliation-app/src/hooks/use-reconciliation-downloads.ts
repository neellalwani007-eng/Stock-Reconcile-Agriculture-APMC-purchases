import { useState } from "react";
import { downloadFile } from "@workspace/api-client-react";
import type { ReconciliationResult } from "@workspace/api-client-react";

type FileType = "updated-sales" | "pending-pavati" | "datewise-report" | "purchase-exceptions";

export function useReconciliationDownloads(data: ReconciliationResult | undefined) {
  const [downloading, setDownloading] = useState<FileType | null>(null);

  const handleDownload = async (fileType: FileType, filename: string) => {
    if (!data) return;
    
    try {
      setDownloading(fileType);
      const blob = await downloadFile(fileType, data);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(`Failed to download ${fileType}:`, error);
      // In a real app, we'd trigger a toast notification here
      alert("Failed to download file. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  return { handleDownload, downloading };
}
