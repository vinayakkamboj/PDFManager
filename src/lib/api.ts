// lib/api.ts - UNIFIED VERSION
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    const responseText = await response.text();
    console.log('Raw response received');

    if (!response.ok) {
      console.error('Upload failed with status:', response.status);
      throw new Error(`Upload failed: ${response.status}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON');
      throw new Error('Server returned invalid JSON');
    }

    console.log('📦 Received from backend:', {
      hasPdfData: !!data.pdfData,
      hasDocumentId: !!data.documentId,
      hasFileName: !!data.fileName,
      success: data.success,
      pdfDataLength: data.pdfData?.length || 0,
      actualKeys: Object.keys(data)
    });

    // Validate response
    if (!data.pdfData) {
      console.error('❌ Backend response:', data);
      throw new Error('Server response missing pdfData');
    }

    if (!data.documentId) {
      throw new Error('Server response missing documentId');
    }

    return {
      pdfData: data.pdfData,      // Base64 PDF for immediate viewing
      documentId: data.documentId, // For OCR later
      fileName: data.fileName || file.name,
    };
  } catch (error) {
    console.error('uploadDocument error:', error);
    throw error;
  }
}

export async function performOCR(documentId: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentId }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('OCR failed with status:', response.status);
      throw new Error(`OCR failed: ${response.status}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error('Server returned invalid JSON for OCR');
    }

    if (!data.pdfData) {
      throw new Error('OCR response missing pdfData');
    }

    if (!data.documentId) {
      throw new Error('OCR response missing documentId');
    }

    return {
      pdfData: data.pdfData,
      documentId: data.documentId,
    };
  } catch (error) {
    console.error('performOCR error:', error);
    throw error;
  }
}