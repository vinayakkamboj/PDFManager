// Explore.tsx - Updated with form fields support
import { useState, useRef, useEffect } from "react";
import PDFSidebar from "@/components/PDFSidebar";
import PDFViewer, { PDFViewerHandle } from "@/components/PDFViewer";

const Explore = () => {
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [signatureFields, setSignatureFields] = useState<any[]>([]);
  const [formFields, setFormFields] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentAnnotationIndex, setCurrentAnnotationIndex] = useState(0);
  const [currentSignatureFieldIndex, setCurrentSignatureFieldIndex] = useState(0);
  const [currentFormFieldIndex, setCurrentFormFieldIndex] = useState(0);
  const viewerRef = useRef<PDFViewerHandle>(null);
  const [currentMode, setCurrentMode] = useState<string>("");

  const handleFileUpload = async (file: File) => {
    if (!viewerRef.current) return;
    try {
      setIsLoading(true);
      await viewerRef.current.loadDocument(file);
      setCurrentAnnotationIndex(0);
      setCurrentSignatureFieldIndex(0);
      setCurrentFormFieldIndex(0);
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
      setFormFields([]);
      setFileName("");
      setCurrentAnnotationIndex(0);
      setCurrentSignatureFieldIndex(0);
      setCurrentFormFieldIndex(0);
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

  const handleFormFieldsLoad = (loadedFields: any[]) => {
    setFormFields(loadedFields ?? []);
  };

  const handleDocumentLoad = (name: string) => setFileName(name);

  // Handle signature field focus from viewer clicks
  const handleSignatureFieldFocus = (signatureField: any, fieldIndex: number) => {
    console.log("Signature field clicked in viewer:", signatureField.name, "at index:", fieldIndex);
    
    // Update the sidebar to show this field as selected
    setCurrentSignatureFieldIndex(fieldIndex);
    // Deselect annotations when a signature field is focused
    setCurrentAnnotationIndex(-1);
    setCurrentFormFieldIndex(-1);
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

  // Keep form field index in bounds
  useEffect(() => {
    if (formFields.length === 0) {
      setCurrentFormFieldIndex(0);
      return;
    }
    if (currentFormFieldIndex >= formFields.length) {
      setCurrentFormFieldIndex(0);
    }
  }, [formFields, currentFormFieldIndex]);

  // Annotation navigation functions
  const focusAnnotationAtIndex = async (index: number) => {
    const wrapper = annotations[index];
    if (!wrapper) return;
    setCurrentAnnotationIndex(index);
    // Deselect signature fields and form fields when focusing on annotations
    setCurrentSignatureFieldIndex(-1);
    setCurrentFormFieldIndex(-1);
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
    // Deselect annotations and form fields when focusing on signature fields
    setCurrentAnnotationIndex(-1);
    setCurrentFormFieldIndex(-1);
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

  // Form field navigation functions
  const focusFormFieldAtIndex = async (index: number) => {
    const field = formFields[index];
    if (!field) return;
    setCurrentFormFieldIndex(index);
    // Deselect annotations and signature fields when focusing on form fields
    setCurrentAnnotationIndex(-1);
    setCurrentSignatureFieldIndex(-1);
    try {
      if (viewerRef.current) {
        await viewerRef.current.focusFormField(field);
      }
    } catch (err) {
      console.warn("Failed to focus form field:", err);
      if (viewerRef.current) viewerRef.current.navigateToPage(field.pageIndex ?? 0);
    }
  };

  const handleFormFieldSelect = (_field: any, index: number) => {
    focusFormFieldAtIndex(index);
  };

  const handleNextFormField = () => {
    if (formFields.length === 0) return;
    const next = (currentFormFieldIndex + 1) % formFields.length;
    focusFormFieldAtIndex(next);
  };

  const handlePreviousFormField = () => {
    if (formFields.length === 0) return;
    const prev = currentFormFieldIndex === 0 
      ? formFields.length - 1 
      : currentFormFieldIndex - 1;
    focusFormFieldAtIndex(prev);
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

  const handleAddFormField = async () => {
    if (!viewerRef.current) return;
    try {
      await viewerRef.current.addFormField();
    } catch (err) {
      console.error("Failed to add form field:", err);
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

  const handleDeleteFormField = async (field: any, index: number) => {
    if (!viewerRef.current) return;

    // Optimistically remove from local list for snappy UX
    setFormFields((prev) => {
      const keyToMatch = field.id ?? field.name;
      const newArr = prev.filter((f) => (f.id ?? f.name) !== keyToMatch);
      
      // Adjust current index if needed
      setCurrentFormFieldIndex((ci) => {
        if (newArr.length === 0) return 0;
        if (ci >= newArr.length) return Math.max(0, newArr.length - 1);
        return ci;
      });
      
      return newArr;
    });

    try {
      await viewerRef.current.deleteFormField(field);
      console.log("Form field deleted successfully");
    } catch (err) {
      console.error("Failed to delete form field:", err);
      
      // On error, try to refresh the form fields list to get back in sync
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
        formFields={formFields}
        fileName={fileName}
        isLoading={isLoading}
        onFileUpload={handleFileUpload}
        onToggleDraw={handleToggleDraw}
        onAddSignatureField={handleAddSignatureField}
        onAddFormField={handleAddFormField}
        onAnnotationSelect={handleAnnotationSelect}
        onNextAnnotation={handleNextAnnotation}
        onPreviousAnnotation={handlePreviousAnnotation}
        onDeleteAnnotation={handleDeleteAnnotation}
        onSignatureFieldSelect={handleSignatureFieldSelect}
        onNextSignatureField={handleNextSignatureField}
        onPreviousSignatureField={handlePreviousSignatureField}
        onDeleteSignatureField={handleDeleteSignatureField}
        onFormFieldSelect={handleFormFieldSelect}
        onNextFormField={handleNextFormField}
        onPreviousFormField={handlePreviousFormField}
        onDeleteFormField={handleDeleteFormField}
        currentAnnotationIndex={currentAnnotationIndex}
        currentSignatureFieldIndex={currentSignatureFieldIndex}
        currentFormFieldIndex={currentFormFieldIndex}
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
          onFormFieldsLoad={handleFormFieldsLoad}
          onDocumentLoad={handleDocumentLoad}
          onSignatureFieldFocus={handleSignatureFieldFocus}
          onModeChange={(m) => setCurrentMode(m)}
        />
      </main>
    </div>
  );
};

export default Explore;