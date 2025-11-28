// PDFSidebar.tsx - Simplified (No Header Button)
import { useState, useRef } from "react";
import { Upload, FileText, ChevronRight, ChevronLeft, Square, X, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PDFSidebarProps {
  formFields: any[];
  fileName: string;
  isLoading: boolean;
  onFileUpload: (file: File) => void;
  onAddFormField: () => void;
  onFormFieldSelect: (formField: any, index: number) => void;
  onNextFormField: () => void;
  onPreviousFormField: () => void;
  onDeleteFormField: (formField: any, index: number) => void;
  currentFormFieldIndex: number;
}

const PDFSidebar = ({
  formFields,
  fileName,
  isLoading,
  onFileUpload,
  onAddFormField,
  onFormFieldSelect,
  onNextFormField,
  onPreviousFormField,
  onDeleteFormField,
  currentFormFieldIndex,
}: PDFSidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      onFileUpload(file);
    } else if (file) {
      alert("Please select a PDF file");
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handleDeleteFormFieldClick = (field: any, index: number) => {
    try {
      onDeleteFormField?.(field, index);
    } catch (e) {
      console.error("onDeleteFormField handler threw:", e);
    }
  };

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-card/50 backdrop-blur-sm transition-all duration-300 shadow-sm",
          isCollapsed ? "w-16" : "w-80"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-3 shrink-0">
          {!isCollapsed && (
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              PDF Form Editor
            </h2>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-8 w-8 hover:bg-primary/10"
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{isCollapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
          </Tooltip>
        </div>

        {/* Upload */}
        <div className="p-4 space-y-2 shrink-0">
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Upload PDF</h3>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
            disabled={isLoading}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size={isCollapsed ? "icon" : "default"}
                className={cn(
                  "w-full transition-all hover:bg-primary/10 hover:border-primary/50 hover:text-foreground",
                  !isCollapsed && "justify-start"
                )}
                disabled={isLoading}
                type="button"
                onClick={openFilePicker}
              >
                <Upload className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2">{isLoading ? "Loading..." : "Choose PDF"}</span>}
              </Button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">Upload PDF</TooltipContent>}
          </Tooltip>

          {!isCollapsed && fileName && (
            <div className="flex items-center gap-2 text-xs bg-muted/30 rounded p-2">
              <span className="truncate flex-1 text-muted-foreground">📄 {fileName}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Add Form Field button */}
        <div className="p-4 shrink-0 space-y-2">
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Add Fields</h3>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size={isCollapsed ? "icon" : "default"}
                onClick={onAddFormField}
                className={cn(
                  "hover:bg-primary/10 hover:border-primary/50 hover:text-foreground", 
                  !isCollapsed && "w-full justify-start"
                )}
              >
                <Type className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2">Add Text Field</span>}
              </Button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">Add a text field to the PDF</TooltipContent>}
          </Tooltip>
        </div>

        <Separator />

        {/* Form Fields list */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-h-0 flex flex-col">
          {!isCollapsed ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Form Fields</h3>
                <Badge variant="outline" className="text-xs">{formFields.length}</Badge>
              </div>

              {formFields.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-sm text-muted-foreground">No form fields</div>
                </div>
              ) : (
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {formFields.map((field: any, index: number) => {
                    const fieldName = field.name ?? `Field ${index + 1}`;
                    const fieldType = field.type ?? "text";
                    const fieldValue = field.value ?? "";
                    const key = field.id ?? `form-${index}`;
                    
                    return (
                      <div
                        key={key}
                        className={cn(
                          "rounded-lg border p-3 text-xs transition-all cursor-pointer hover:shadow-md relative",
                          currentFormFieldIndex === index ? "bg-primary/10 border-primary shadow-sm" : "border-border hover:border-primary/30 bg-card"
                        )}
                        onClick={() => onFormFieldSelect(field, index)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-start gap-2 flex-1">
                            <span className="font-medium text-foreground">Field {index + 1}</span>
                            <Badge 
                              variant="outline"
                              className="text-[10px] capitalize"
                            >
                              {fieldType}
                            </Badge>
                          </div>

                          <div className="ml-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFormFieldClick(field, index);
                                  }}
                                  aria-label={`Delete form field ${index + 1}`}
                                  className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-destructive/10"
                                  title="Delete form field"
                                >
                                  <X className="h-4 w-4 text-destructive" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left">Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>

                        <div className="mt-1 text-muted-foreground text-[11px] leading-relaxed">
                          <div className="font-medium mb-1">{fieldName}</div>
                          <div className="text-[10px] text-muted-foreground/70">
                            Page {(field.pageIndex ?? 0) + 1}
                            {fieldValue && <span className="ml-2">• Value: {fieldValue}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center py-2">
                  <div className="relative">
                    <Square className="h-5 w-5 text-muted-foreground" />
                    {formFields.length > 0 && <Badge className="absolute -top-1 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]">{formFields.length}</Badge>}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">Form Fields ({formFields.length})</TooltipContent>
            </Tooltip>
          )}

          {/* Navigation for form fields */}
          <div className="mt-4 pt-4 border-t border-border shrink-0">
            <div className={cn("flex gap-2", isCollapsed && "flex-col items-center")}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size={isCollapsed ? "icon" : "default"}
                    onClick={onPreviousFormField}
                    disabled={formFields.length === 0}
                    className={cn("transition-all hover:bg-primary/10 hover:border-primary/50 hover:text-foreground", !isCollapsed && "flex-1")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {!isCollapsed && <span className="ml-1">Previous</span>}
                  </Button>
                </TooltipTrigger>
                {isCollapsed && <TooltipContent side="right">Previous</TooltipContent>}
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size={isCollapsed ? "icon" : "default"}
                    onClick={onNextFormField}
                    disabled={formFields.length === 0}
                    className={cn("transition-all hover:bg-primary/10 hover:border-primary/50 hover:text-foreground", !isCollapsed && "flex-1")}
                  >
                    {!isCollapsed && <span className="mr-1">Next</span>}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                {isCollapsed && <TooltipContent side="right">Next</TooltipContent>}
              </Tooltip>
            </div>

            {!isCollapsed && formFields.length > 0 && (
              <div className="mt-3 text-center text-xs text-muted-foreground">{currentFormFieldIndex + 1} / {formFields.length}</div>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default PDFSidebar;