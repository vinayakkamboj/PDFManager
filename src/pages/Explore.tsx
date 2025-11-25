// Explore.tsx - Form Fields Only
import { useState, useRef, useEffect } from "react";
import PDFSidebar from "@/components/PDFSidebar";
import PDFViewer, { PDFViewerHandle } from "@/components/PDFViewer";

const Explore = () => {
  const [formFields, setFormFields] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentFormFieldIndex, setCurrentFormFieldIndex] = useState(0);
  const viewerRef = useRef<PDFViewerHandle>(null);

  const handleFileUpload = async (file: File) => {
    if (!viewerRef.current) return;
    try {
      setIsLoading(true);
      await viewerRef.current.loadDocument(file);
      setCurrentFormFieldIndex(0);
    } catch (err) {
      console.error("loadDocument failed:", err);
      alert("Failed to load PDF. Try another file.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormFieldsLoad = (loadedFields: any[]) => {
    setFormFields(loadedFields ?? []);
  };

  const handleDocumentLoad = (name: string) => setFileName(name);

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

  // Form field navigation functions
  const focusFormFieldAtIndex = async (index: number) => {
    const field = formFields[index];
    if (!field) return;
    setCurrentFormFieldIndex(index);
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

  const handleAddFormField = async () => {
    if (!viewerRef.current) return;
    try {
      await viewerRef.current.addFormField();
    } catch (err) {
      console.error("Failed to add form field:", err);
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
        formFields={formFields}
        fileName={fileName}
        isLoading={isLoading}
        onFileUpload={handleFileUpload}
        onAddFormField={handleAddFormField}
        onFormFieldSelect={handleFormFieldSelect}
        onNextFormField={handleNextFormField}
        onPreviousFormField={handlePreviousFormField}
        onDeleteFormField={handleDeleteFormField}
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
          onFormFieldsLoad={handleFormFieldsLoad}
          onDocumentLoad={handleDocumentLoad}
        />
      </main>
    </div>
  );
};

export default Explore;