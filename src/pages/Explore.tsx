// Explore.tsx
import { useState, useRef, useEffect } from "react";
import PDFSidebar from "@/components/PDFSidebar";
import PDFViewer, { PDFViewerHandle } from "@/components/PDFViewer";

const Explore = () => {
  // annotations are wrapper objects: { sdk, pageIndex, boundingBox, type, clientId }
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentAnnotationIndex, setCurrentAnnotationIndex] = useState(0);
  const viewerRef = useRef<PDFViewerHandle>(null);
  const [currentMode, setCurrentMode] = useState<string>("");

  const handleFileUpload = async (file: File) => {
    if (!viewerRef.current) return;
    try {
      setIsLoading(true);
      await viewerRef.current.loadDocument(file);
      setCurrentAnnotationIndex(0);
    } catch (err) {
      console.error("loadDocument failed:", err);
      alert("Failed to load PDF. Try another file.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearFile = async () => {
    try {
      setIsLoading(true);
      if (viewerRef.current) await viewerRef.current.unloadDocument();
      setAnnotations([]);
      setFileName("");
      setCurrentAnnotationIndex(0);
    } catch (err) {
      console.warn("clear failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // viewer provides already-filtered wrappers via onAnnotationsLoad
  const handleAnnotationsLoad = (loadedWrappers: any[]) => {
    // loadedWrappers are authoritative; update state
    setAnnotations(loadedWrappers ?? []);
  };

  const handleDocumentLoad = (name: string) => setFileName(name);

  // Keep index in bounds when annotations change
  useEffect(() => {
    if (annotations.length === 0) {
      setCurrentAnnotationIndex(0);
      return;
    }
    if (currentAnnotationIndex >= annotations.length) {
      setCurrentAnnotationIndex(0);
    }
  }, [annotations, currentAnnotationIndex]);

  const focusAnnotationAtIndex = async (index: number) => {
    const wrapper = annotations[index];
    if (!wrapper) return;
    setCurrentAnnotationIndex(index);
    try {
      if (viewerRef.current) {
        await viewerRef.current.focusAnnotation(wrapper);
      }
    } catch (err) {
      if (viewerRef.current) viewerRef.current.navigateToPage(wrapper.pageIndex);
    }
  };

  const handleAnnotationSelect = (_wrapper: any, index: number) => {
    focusAnnotationAtIndex(index);
  };

  const handleNextAnnotation = () => {
    if (annotations.length === 0) return;
    const next = (currentAnnotationIndex + 1) % annotations.length;
    focusAnnotationAtIndex(next);
  };

  const handlePreviousAnnotation = () => {
    if (annotations.length === 0) return;
    const prev = currentAnnotationIndex === 0 ? annotations.length - 1 : currentAnnotationIndex - 1;
    focusAnnotationAtIndex(prev);
  };

  // Single draw button handler (only ink mode)
  const handleToggleDraw = async () => {
    if (!viewerRef.current) return;
    try {
      await viewerRef.current.enterDrawMode();
      setCurrentMode("ink");
    } catch (err) {
      console.warn("Failed to enter draw mode:", err);
      alert("Unable to open drawing tools. Check console for details.");
    }
  };

  /**
   * Delete handler - called from the sidebar.
   * - Calls Nutrient instance.delete(annotation) to remove from the viewer.
   * - Optimistically removes the annotation from local state so the UI updates immediately.
   * - The viewer emits annotation delete events which will drive authoritative updates via onAnnotationsLoad.
   */
  const handleDeleteAnnotation = async (wrapper: any, index: number) => {
    if (!viewerRef.current) return;
    const instance = viewerRef.current.getInstance?.();
    if (!instance) {
      console.warn("Viewer instance not available for deletion");
      return;
    }

    // Optimistically remove from local list for snappy UX
    setAnnotations((prev) => {
      const keyToMatch = wrapper.clientId ?? wrapper.sdk?.id;
      const newArr = prev.filter((w) => (w.clientId ?? w.sdk?.id) !== keyToMatch);
      // fix current index if needed
      setCurrentAnnotationIndex((ci) => {
        if (newArr.length === 0) return 0;
        if (ci >= newArr.length) return Math.max(0, newArr.length - 1);
        return ci;
      });
      return newArr;
    });

    try {
      // Nutrient SDK delete API: instance.delete(annotationOrId)
      // Pass the sdk object (or id) from the wrapper
      await instance.delete?.(wrapper.sdk ?? wrapper.sdk?.id ?? wrapper.clientId);
      // The viewer should emit an "annotations.delete" event and PDFViewer will re-collect annotations.
      // If for some reason the SDK does not emit, the optimistic update above keeps UI consistent.
    } catch (err) {
      console.error("Failed to delete annotation via Nutrient instance:", err);
      // On failure, we should re-sync authoritative annotations:
      // Try to re-collect by triggering a small refresh via focus -> onAnnotationsLoad will be fired when viewer emits changes
      // As fallback, request a full refresh by toggling a tiny navigation (no-op) to encourage event propagation:
      try {
        const pageIndex = wrapper.pageIndex ?? 0;
        viewerRef.current?.navigateToPage(pageIndex);
      } catch (e) {}
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <PDFSidebar
        annotations={annotations}
        fileName={fileName}
        isLoading={isLoading}
        onFileUpload={handleFileUpload}
        onToggleDraw={handleToggleDraw}
        onAnnotationSelect={handleAnnotationSelect}
        onNextAnnotation={handleNextAnnotation}
        onPreviousAnnotation={handlePreviousAnnotation}
        onDeleteAnnotation={handleDeleteAnnotation} // wired here
        currentAnnotationIndex={currentAnnotationIndex}
      />

      <main className="flex-1 bg-muted/30 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading PDF...</p>
            </div>
          </div>
        )}

        <PDFViewer
          ref={viewerRef}
          onAnnotationsLoad={handleAnnotationsLoad}
          onDocumentLoad={handleDocumentLoad}
          onModeChange={(m) => setCurrentMode(m)}
        />
      </main>
    </div>
  );
};

export default Explore;
