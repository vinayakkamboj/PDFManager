// src/pages/Explore.tsx - UNIFIED VERSION - Single Upload
import { useState, useRef, useEffect } from "react";
import PDFSidebar from "@/components/PDFSidebar";
import PDFViewer, { PDFViewerHandle } from "@/components/PDFViewer";
import { uploadDocument, performOCR } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const Explore = () => {
  const [formFields, setFormFields] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOCRLoading, setIsOCRLoading] = useState(false);
  const [currentFormFieldIndex, setCurrentFormFieldIndex] = useState(0);
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const viewerRef = useRef<PDFViewerHandle>(null);
  const { toast } = useToast();

  // UNIFIED UPLOAD - Works for both local viewing AND enables OCR
  const handleFileUpload = async (file: File) => {
    if (!viewerRef.current) return;
    
    try {
      setIsLoading(true);
      
      toast({
        title: "Uploading...",
        description: "Processing PDF for viewing and OCR",
      });
      
      console.log('🚀 Starting upload for:', file.name);
      
      // Upload to backend (which uploads to DWS and returns PDF data)
      const result = await uploadDocument(file);
      console.log('✅ Upload result received');
      
      if (!result.pdfData) {
        throw new Error('No PDF data received from server');
      }

      if (!result.documentId) {
        throw new Error('No document ID received from server');
      }
      
      console.log('📄 Loading document in viewer...');
      // Load PDF in viewer from base64 data
      await viewerRef.current.loadDocumentFromBase64(result.pdfData, result.fileName);
      
      // Save document ID for OCR
      setCurrentDocumentId(result.documentId);
      setFileName(result.fileName);
      setCurrentFormFieldIndex(0);
      
      toast({
        title: "Success!",
        description: "Document loaded. OCR is now available!",
      });
      
    } catch (err) {
      console.error("Upload failed:", err);
      
      let errorMessage = "Failed to upload document";
      
      if (err instanceof Error) {
        errorMessage = err.message;
        
        if (err.message.includes('500')) {
          errorMessage = "Server error. Check backend logs.";
        } else if (err.message.includes('network') || err.message.includes('fetch')) {
          errorMessage = "Cannot connect to backend. Is it running on port 3001?";
        }
      }
      
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePerformOCR = async () => {
    if (!currentDocumentId || !viewerRef.current) {
      toast({
        title: "OCR not available",
        description: "Please upload a document first",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsOCRLoading(true);
      
      toast({
        title: "Performing OCR...",
        description: "This may take a moment",
      });
      
      const result = await performOCR(currentDocumentId);
      
      if (!result.pdfData || !result.documentId) {
        throw new Error('Invalid OCR response');
      }
      
      // Load the OCR'd PDF
      await viewerRef.current.loadDocumentFromBase64(result.pdfData, fileName);
      
      // Update document ID
      setCurrentDocumentId(result.documentId);
      
      toast({
        title: "OCR Complete!",
        description: "Text extracted and document reloaded",
      });
      
    } catch (err) {
      console.error("OCR failed:", err);
      
      let errorMessage = "Failed to perform OCR";
      
      if (err instanceof Error) {
        if (err.message.includes('not configured')) {
          errorMessage = "OCR requires Processor API key. Add NUTRIENT_DWS_PROCESSOR_API_KEY to backend .env";
        } else {
          errorMessage = err.message;
        }
      }
      
      toast({
        title: "OCR failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsOCRLoading(false);
    }
  };

  const handleFormFieldsLoad = (loadedFields: any[]) => {
    setFormFields(loadedFields ?? []);
  };

  const handleDocumentLoad = (name: string) => setFileName(name);

  useEffect(() => {
    if (formFields.length === 0) {
      setCurrentFormFieldIndex(0);
      return;
    }
    if (currentFormFieldIndex >= formFields.length) {
      setCurrentFormFieldIndex(0);
    }
  }, [formFields, currentFormFieldIndex]);

  const focusFormFieldAtIndex = async (index: number) => {
    const field = formFields[index];
    if (!field) return;
    setCurrentFormFieldIndex(index);
    try {
      if (viewerRef.current) {
        await viewerRef.current.focusFormField(field);
      }
    } catch (err) {
      console.warn("Failed to focus:", err);
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
      console.error("Failed to add field:", err);
    }
  };

  const handleDeleteFormField = async (field: any, index: number) => {
    if (!viewerRef.current) return;

    setFormFields((prev) => {
      const keyToMatch = field.id ?? field.name;
      const newArr = prev.filter((f) => (f.id ?? f.name) !== keyToMatch);
      
      setCurrentFormFieldIndex((ci) => {
        if (newArr.length === 0) return 0;
        if (ci >= newArr.length) return Math.max(0, newArr.length - 1);
        return ci;
      });
      
      return newArr;
    });

    try {
      await viewerRef.current.deleteFormField(field);
      console.log("✅ Form field deleted");
    } catch (err) {
      console.error("Failed to delete:", err);
      
      try {
        const instance = viewerRef.current.getInstance?.();
        if (instance) {
          const pageIndex = field.pageIndex ?? 0;
          viewerRef.current?.navigateToPage(pageIndex);
        }
      } catch (e) {
        console.warn("Failed to refresh:", e);
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
        onPerformOCR={handlePerformOCR}
        isOCRLoading={isOCRLoading}
      />

      <main className="flex-1 bg-muted/30 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">
                Loading PDF...
              </p>
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