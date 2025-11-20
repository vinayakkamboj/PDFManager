// Explore.tsx - Updated with viewer-sidebar synchronization
import { useState, useRef, useEffect } from "react";
import PDFSidebar from "@/components/PDFSidebar";
import PDFViewer, { PDFViewerHandle } from "@/components/PDFViewer";

const Explore = () => {
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [signatureFields, setSignatureFields] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentAnnotationIndex, setCurrentAnnotationIndex] = useState(0);
  const [currentSignatureFieldIndex, setCurrentSignatureFieldIndex] = useState(0);
  const viewerRef = useRef<PDFViewerHandle>(null);
  const [currentMode, setCurrentMode] = useState<string>("");

  const handleFileUpload = async (file: File) => {
    if (!viewerRef.current) return;
    try {
      setIsLoading(true);
      await viewerRef.current.loadDocument(file);
      setCurrentAnnotationIndex(0);
      setCurrentSignatureFieldIndex(0);
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
      setSignatureFields([]);
      setFileName("");
      setCurrentAnnotationIndex(0);
      setCurrentSignatureFieldIndex(0);
    } catch (err) {
      console.warn("clear failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnnotationsLoad = (loadedWrappers: any[]) => {
    setAnnotations(loadedWrappers ?? []);
  };

  const handleSignatureFieldsLoad = (loadedFields: any[]) => {
    setSignatureFields(loadedFields ?? []);
  };

  const handleDocumentLoad = (name: string) => setFileName(name);

  // NEW: Handle signature field focus from viewer clicks
  const handleSignatureFieldFocus = (signatureField: any, fieldIndex: number) => {
    console.log("Signature field clicked in viewer:", signatureField.name, "at index:", fieldIndex);
    
    // Update the sidebar to show this field as selected
    setCurrentSignatureFieldIndex(fieldIndex);
    // Deselect annotations when a signature field is focused
    setCurrentAnnotationIndex(-1);
  };

  // Keep annotation index in bounds
  useEffect(() => {
    if (annotations.length === 0) {
      setCurrentAnnotationIndex(0);
      return;
    }
    if (currentAnnotationIndex >= annotations.length) {
      setCurrentAnnotationIndex(0);
    }
  }, [annotations, currentAnnotationIndex]);

  // Keep signature field index in bounds
  useEffect(() => {
    if (signatureFields.length === 0) {
      setCurrentSignatureFieldIndex(0);
      return;
    }
    if (currentSignatureFieldIndex >= signatureFields.length) {
      setCurrentSignatureFieldIndex(0);
    }
  }, [signatureFields, currentSignatureFieldIndex]);

  // Annotation navigation functions
  const focusAnnotationAtIndex = async (index: number) => {
    const wrapper = annotations[index];
    if (!wrapper) return;
    setCurrentAnnotationIndex(index);
    // Deselect signature fields when focusing on annotations
    setCurrentSignatureFieldIndex(-1);
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

  // Signature field navigation functions
  const focusSignatureFieldAtIndex = async (index: number) => {
    const field = signatureFields[index];
    if (!field) return;
    setCurrentSignatureFieldIndex(index);
    // Deselect annotations when focusing on signature fields
    setCurrentAnnotationIndex(-1);
    try {
      if (viewerRef.current) {
        await viewerRef.current.focusSignatureField(field);
      }
    } catch (err) {
      console.warn("Failed to focus signature field:", err);
      if (viewerRef.current) viewerRef.current.navigateToPage(field.pageIndex ?? 0);
    }
  };

  const handleSignatureFieldSelect = (_field: any, index: number) => {
    focusSignatureFieldAtIndex(index);
  };

  const handleNextSignatureField = () => {
    if (signatureFields.length === 0) return;
    const next = (currentSignatureFieldIndex + 1) % signatureFields.length;
    focusSignatureFieldAtIndex(next);
  };

  const handlePreviousSignatureField = () => {
    if (signatureFields.length === 0) return;
    const prev = currentSignatureFieldIndex === 0 
      ? signatureFields.length - 1 
      : currentSignatureFieldIndex - 1;
    focusSignatureFieldAtIndex(prev);
  };

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

  const handleAddSignatureField = async () => {
    if (!viewerRef.current) return;
    try {
      await viewerRef.current.addSignatureField();
    } catch (err) {
      console.error("Failed to add signature field:", err);
    }
  };

  const handleDeleteAnnotation = async (wrapper: any, index: number) => {
    if (!viewerRef.current) return;
    const instance = viewerRef.current.getInstance?.();
    if (!instance) {
      console.warn("Viewer instance not available for deletion");
      return;
    }

    // Optimistically remove from local list
    setAnnotations((prev) => {
      const keyToMatch = wrapper.clientId ?? wrapper.sdk?.id;
      const newArr = prev.filter((w) => (w.clientId ?? w.sdk?.id) !== keyToMatch);
      setCurrentAnnotationIndex((ci) => {
        if (newArr.length === 0) return 0;
        if (ci >= newArr.length) return Math.max(0, newArr.length - 1);
        return ci;
      });
      return newArr;
    });

    try {
      await instance.delete?.(wrapper.sdk ?? wrapper.sdk?.id ?? wrapper.clientId);
    } catch (err) {
      console.error("Failed to delete annotation via Nutrient instance:", err);
      try {
        const pageIndex = wrapper.pageIndex ?? 0;
        viewerRef.current?.navigateToPage(pageIndex);
      } catch (e) {}
    }
  };

  const handleDeleteSignatureField = async (field: any, index: number) => {
    if (!viewerRef.current) return;

    // Optimistically remove from local list for snappy UX
    setSignatureFields((prev) => {
      const keyToMatch = field.id ?? field.name;
      const newArr = prev.filter((f) => (f.id ?? f.name) !== keyToMatch);
      
      // Adjust current index if needed
      setCurrentSignatureFieldIndex((ci) => {
        if (newArr.length === 0) return 0;
        if (ci >= newArr.length) return Math.max(0, newArr.length - 1);
        return ci;
      });
      
      return newArr;
    });

    try {
      await viewerRef.current.deleteSignatureField(field);
      console.log("Signature field deleted successfully");
    } catch (err) {
      console.error("Failed to delete signature field:", err);
      
      // On error, try to refresh the signature fields list to get back in sync
      try {
        const instance = viewerRef.current.getInstance?.();
        if (instance) {
          // Trigger a small action to force event propagation
          const pageIndex = field.pageIndex ?? 0;
          viewerRef.current?.navigateToPage(pageIndex);
        }
      } catch (e) {
        console.warn("Failed to refresh after delete error:", e);
      }
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <PDFSidebar
        annotations={annotations}
        signatureFields={signatureFields}
        fileName={fileName}
        isLoading={isLoading}
        onFileUpload={handleFileUpload}
        onToggleDraw={handleToggleDraw}
        onAddSignatureField={handleAddSignatureField}
        onAnnotationSelect={handleAnnotationSelect}
        onNextAnnotation={handleNextAnnotation}
        onPreviousAnnotation={handlePreviousAnnotation}
        onDeleteAnnotation={handleDeleteAnnotation}
        onSignatureFieldSelect={handleSignatureFieldSelect}
        onNextSignatureField={handleNextSignatureField}
        onPreviousSignatureField={handlePreviousSignatureField}
        onDeleteSignatureField={handleDeleteSignatureField}
        currentAnnotationIndex={currentAnnotationIndex}
        currentSignatureFieldIndex={currentSignatureFieldIndex}
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
          onSignatureFieldsLoad={handleSignatureFieldsLoad}
          onDocumentLoad={handleDocumentLoad}
          onSignatureFieldFocus={handleSignatureFieldFocus}
          onModeChange={(m) => setCurrentMode(m)}
        />
      </main>
    </div>
  );
};

export default Explore;