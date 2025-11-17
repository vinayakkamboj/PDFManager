// PDFSidebar.tsx
import { useState, useRef } from "react";
import { Upload, FileText, Edit2, ChevronRight, ChevronLeft, List, X } from "lucide-react";
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
  annotations: any[]; // wrappers: { sdk, pageIndex, boundingBox, type, clientId }
  fileName: string;
  isLoading: boolean;
  onFileUpload: (file: File) => void;
  onToggleDraw: () => void; // only the single "Click to Draw" button now
  onAnnotationSelect: (annotationWrapper: any, index: number) => void;
  onNextAnnotation: () => void;
  onPreviousAnnotation: () => void;
  onDeleteAnnotation: (annotationWrapper: any, index: number) => void; // NEW prop
  currentAnnotationIndex: number;
}

const PDFSidebar = ({
  annotations,
  fileName,
  isLoading,
  onFileUpload,
  onToggleDraw,
  onAnnotationSelect,
  onNextAnnotation,
  onPreviousAnnotation,
  onDeleteAnnotation,
  currentAnnotationIndex,
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

  // Delegate to parent - no confirm here (per request)
  const handleDeleteClick = (wrapper: any, index: number) => {
    try {
      onDeleteAnnotation?.(wrapper, index);
    } catch (e) {
      console.error("onDeleteAnnotation handler threw:", e);
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
        {/* header */}
        <div className="flex items-center justify-between border-b border-border p-3 shrink-0">
          {!isCollapsed && (
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              PDF Tools
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

        {/* upload */}
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

        {/* ONLY single draw button (Click to Draw) */}
        <div className="p-4 shrink-0">
          <div className="flex items-center justify-between">
            {!isCollapsed ? (
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Draw</h3>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size={isCollapsed ? "icon" : "default"}
                  onClick={onToggleDraw}
                  className={cn("hover:bg-primary/10 hover:border-primary/50 hover:text-foreground")}
                >
                  <Edit2 className="h-4 w-4" />
                  {!isCollapsed && <span className="ml-2">Click to Draw</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Open drawing tools</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Separator />

        {/* annotation list */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-h-0 flex flex-col">
          {!isCollapsed ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Annotations</h3>
                <Badge variant="outline" className="text-xs">{annotations.length}</Badge>
              </div>

              {annotations.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-sm text-muted-foreground">No annotations</div>
                </div>
              ) : (
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {annotations.map((wrapper: any, index: number) => {
                    const ann = wrapper.sdk;
                    const text = ann?.text ?? ann?.note ?? "";
                    const subject = ann?.subject ?? "";
                    const type = wrapper?.type ?? "annotation";
                    const key = ann?.id ?? wrapper?.clientId ?? `${wrapper.pageIndex}-${index}`;
                    return (
                      <div
                        key={key}
                        className={cn(
                          "rounded-lg border p-3 text-xs transition-all cursor-pointer hover:shadow-md relative",
                          currentAnnotationIndex === index ? "bg-primary/10 border-primary shadow-sm" : "border-border hover:border-primary/30 bg-card"
                        )}
                        // clicking the card selects the annotation
                        onClick={() => onAnnotationSelect(wrapper, index)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          {/* Changed label from Page N to Annotation X */}
                          <div className="flex items-start gap-2">
                            <span className="font-medium text-foreground">Annotation {index + 1}</span>
                            <Badge className="text-[10px]">{type}</Badge>
                          </div>

                          {/* DELETE BUTTON (small X) */}
                          <div className="ml-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation(); // prevent selecting the annotation
                                    handleDeleteClick(wrapper, index);
                                  }}
                                  aria-label={`Delete annotation ${index + 1}`}
                                  className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-destructive/10"
                                  title="Delete annotation"
                                >
                                  <X className="h-4 w-4 text-destructive" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left">Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>

                        {subject && <div className="text-[10px] text-primary font-medium mb-1 uppercase">{subject}</div>}

                        {text ? (
                          <div className="mt-1 text-muted-foreground line-clamp-3 text-[11px] leading-relaxed">{text}</div>
                        ) : (
                          <div className="mt-1 text-muted-foreground italic text-[11px]">No visible text</div>
                        )}
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
                    <List className="h-5 w-5 text-muted-foreground" />
                    {annotations.length > 0 && <Badge className="absolute -top-1 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]">{annotations.length}</Badge>}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">Annotations ({annotations.length})</TooltipContent>
            </Tooltip>
          )}

          {/* pinned navigation */}
          <div className="mt-4 pt-4 border-t border-border shrink-0">
            <div className={cn("flex gap-2", isCollapsed && "flex-col items-center")}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size={isCollapsed ? "icon" : "default"}
                    onClick={onPreviousAnnotation}
                    disabled={annotations.length === 0}
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
                    onClick={onNextAnnotation}
                    disabled={annotations.length === 0}
                    className={cn("transition-all hover:bg-primary/10 hover:border-primary/50 hover:text-foreground", !isCollapsed && "flex-1")}
                  >
                    {!isCollapsed && <span className="mr-1">Next</span>}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                {isCollapsed && <TooltipContent side="right">Next</TooltipContent>}
              </Tooltip>
            </div>

            {!isCollapsed && annotations.length > 0 && (
              <div className="mt-3 text-center text-xs text-muted-foreground">{currentAnnotationIndex + 1} / {annotations.length}</div>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default PDFSidebar;
