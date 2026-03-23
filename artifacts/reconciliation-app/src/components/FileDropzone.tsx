import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileSpreadsheet, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileDropzoneProps {
  label: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: Record<string, string[]>;
}

export function FileDropzone({ 
  label, 
  file, 
  onFileChange, 
  accept = {
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls']
  } 
}: FileDropzoneProps) {
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      onFileChange(acceptedFiles[0]);
    }
  }, [onFileChange]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    maxFiles: 1
  });

  if (file) {
    return (
      <div className="relative flex items-center justify-between p-4 bg-primary/5 border-2 border-primary/20 rounded-xl">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="truncate">
            <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFileChange(null);
          }}
          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          title="Remove file"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200",
        isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/30",
        isDragReject && "border-destructive bg-destructive/5"
      )}
    >
      <input {...getInputProps()} />
      <div className="p-4 bg-background shadow-sm rounded-full mb-4">
        <UploadCloud className={cn(
          "w-8 h-8",
          isDragActive ? "text-primary" : "text-muted-foreground"
        )} />
      </div>
      <p className="text-sm font-semibold text-foreground mb-1 text-center">
        {isDragActive ? "Drop the file here" : `Click or drag to upload ${label}`}
      </p>
      <p className="text-xs text-muted-foreground text-center">
        Supports .xlsx and .xls
      </p>
    </div>
  );
}
