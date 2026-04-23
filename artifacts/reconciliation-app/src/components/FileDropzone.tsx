import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileSpreadsheet, FileText, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileDropzoneProps {
  label: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
  accept?: Record<string, string[]>;
}

export function FileDropzone({
  label,
  files,
  onFilesChange,
  accept = {
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/pdf': ['.pdf'],
  },
}: FileDropzoneProps) {

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFilesChange([...files, ...acceptedFiles]);
    }
  }, [files, onFilesChange]);

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDrop,
    accept,
    multiple: true,
    noClick: files.length > 0,
    noKeyboard: files.length > 0,
  });

  return (
    <div className="space-y-2">
      {/* Existing files list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="p-1.5 bg-primary/10 text-primary rounded-lg shrink-0">
                  {file.type === 'application/pdf'
                    ? <FileText className="w-4 h-4" />
                    : <FileSpreadsheet className="w-4 h-4" />}
                </div>
                <div className="truncate">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button
                onClick={() => removeFile(i)}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors shrink-0"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Add more files button */}
          <button
            onClick={open}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 border-2 border-dashed border-border hover:border-primary/50 hover:bg-secondary/30 rounded-xl text-sm text-muted-foreground hover:text-foreground transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add another file</span>
          </button>
        </div>
      )}

      {/* Drop zone — shown when no files yet, or always for drag */}
      {files.length === 0 && (
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
            <UploadCloud className={cn("w-8 h-8", isDragActive ? "text-primary" : "text-muted-foreground")} />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1 text-center">
            {isDragActive ? "Drop files here" : `Click or drag to upload ${label}`}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Supports .xlsx, .xls and .pdf — multiple files allowed
          </p>
        </div>
      )}

      {/* Drag overlay when files already selected */}
      {files.length > 0 && (
        <div
          {...getRootProps()}
          className={cn(
            "hidden",
            isDragActive && "!flex flex-col items-center justify-center p-6 border-2 border-dashed border-primary bg-primary/5 rounded-xl"
          )}
        >
          <input {...getInputProps()} />
          {isDragActive && (
            <>
              <UploadCloud className="w-6 h-6 text-primary mb-2" />
              <p className="text-sm font-semibold text-primary">Drop to add more files</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
