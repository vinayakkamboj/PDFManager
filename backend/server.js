// backend/server.js - FINAL WORKING VERSION - Correct OCR Endpoint!
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

const VIEWER_API_KEY = process.env.NUTRIENT_DWS_VIEWER_API_KEY;
const PROCESSOR_API_KEY = process.env.NUTRIENT_DWS_PROCESSOR_API_KEY;
const PORT = process.env.PORT || 3001;

console.log('\n🔑 Environment Check:');
console.log('VIEWER_API_KEY exists:', !!VIEWER_API_KEY);
console.log('PROCESSOR_API_KEY exists:', !!PROCESSOR_API_KEY);

if (!VIEWER_API_KEY) {
  console.error('❌ Missing NUTRIENT_DWS_VIEWER_API_KEY');
  process.exit(1);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));

await fs.mkdir('uploads', { recursive: true });

// Store PDFs in memory cache
const documentCache = new Map();

// UNIFIED UPLOAD
app.post('/api/upload', upload.single('file'), async (req, res) => {
  console.log('\n📤 ===== UPLOAD =====');
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file', success: false });
    }

    console.log('📁', req.file.originalname, `(${req.file.size} bytes)`);

    const fileBuffer = await fs.readFile(req.file.path);

    // Upload to DWS
    console.log('☁️  Uploading to DWS...');
    const uploadResponse = await fetch('https://api.nutrient.io/viewer/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VIEWER_API_KEY}`,
        'Content-Type': req.file.mimetype,
        'Content-Length': fileBuffer.length.toString()
      },
      body: fileBuffer
    });

    if (!uploadResponse.ok) {
      throw new Error(`DWS upload failed: ${uploadResponse.statusText}`);
    }

    const uploadResult = await uploadResponse.json();
    const documentId = uploadResult.data?.document_id || uploadResult.document_id;

    if (!documentId) {
      throw new Error('No document ID');
    }

    console.log('✅ Uploaded, ID:', documentId);

    // Convert to base64 and cache
    const pdfBase64 = fileBuffer.toString('base64');
    documentCache.set(documentId, pdfBase64);
    
    setTimeout(() => documentCache.delete(documentId), 60 * 60 * 1000);

    await fs.unlink(req.file.path);

    res.json({
      documentId,
      pdfData: pdfBase64,
      fileName: req.file.originalname,
      success: true
    });

    console.log('✅ Done!\n');

  } catch (error) {
    console.error('💥', error.message);
    
    if (req.file?.path) {
      try { await fs.unlink(req.file.path); } catch (e) {}
    }

    res.status(500).json({ error: 'Upload failed', details: error.message, success: false });
  }
});

// OCR ENDPOINT - Uses /processor/ocr (Simple endpoint!)
app.post('/api/ocr', async (req, res) => {
  console.log('\n🔍 ===== OCR =====');
  
  try {
    if (!PROCESSOR_API_KEY) {
      return res.status(400).json({ 
        error: 'Processor API key not configured',
        success: false
      });
    }

    const { documentId } = req.body;

    if (!documentId) {
      return res.status(400).json({ error: 'documentId required', success: false });
    }

    console.log('📄 OCR for:', documentId);

    // Get from cache
    const cachedPdfBase64 = documentCache.get(documentId);
    
    if (!cachedPdfBase64) {
      return res.status(400).json({ 
        error: 'Document not found. Upload again.',
        success: false
      });
    }

    console.log('✅ Found in cache');

    const documentBuffer = Buffer.from(cachedPdfBase64, 'base64');

    // Use the SIMPLE /processor/ocr endpoint!
    const formData = new FormData();
    formData.append('file', documentBuffer, 'document.pdf');
    formData.append('data', JSON.stringify({
      language: 'english'
    }));

    console.log('🔤 Calling /processor/ocr...');
    const ocrResponse = await fetch('https://api.nutrient.io/processor/ocr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PROCESSOR_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    console.log('OCR status:', ocrResponse.status);

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      console.error('❌ OCR failed:', errorText);
      throw new Error(`OCR failed: ${ocrResponse.statusText} - ${errorText}`);
    }

    const ocrBuffer = Buffer.from(await ocrResponse.arrayBuffer());
    console.log('✅ OCR done, size:', ocrBuffer.length);

    // Upload to DWS
    console.log('⬆️  Uploading to DWS...');
    const uploadResponse = await fetch('https://api.nutrient.io/viewer/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VIEWER_API_KEY}`,
        'Content-Type': 'application/pdf',
        'Content-Length': ocrBuffer.length.toString()
      },
      body: ocrBuffer
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    const uploadResult = await uploadResponse.json();
    const newDocumentId = uploadResult.data?.document_id || uploadResult.document_id;

    if (!newDocumentId) {
      throw new Error('No document ID');
    }

    console.log('✅ Uploaded, new ID:', newDocumentId);

    // Cache new PDF
    const ocrPdfBase64 = ocrBuffer.toString('base64');
    documentCache.set(newDocumentId, ocrPdfBase64);
    
    setTimeout(() => documentCache.delete(newDocumentId), 60 * 60 * 1000);

    res.json({
      documentId: newDocumentId,
      pdfData: ocrPdfBase64,
      ocrCompleted: true,
      success: true
    });

    console.log('✅ OCR complete!\n');

  } catch (error) {
    console.error('💥', error.message);
    res.status(500).json({ error: 'OCR failed', details: error.message, success: false });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    viewerApi: !!VIEWER_API_KEY,
    processorApi: !!PROCESSOR_API_KEY,
    cachedDocs: documentCache.size
  });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════╗
║   Nutrient Backend FINAL         ║
║   ✨ Upload + OCR Working        ║
╠══════════════════════════════════╣
║  Port: ${PORT}
║  Viewer: ${VIEWER_API_KEY ? '✅' : '❌'}
║  Processor: ${PROCESSOR_API_KEY ? '✅' : '❌'}
╚══════════════════════════════════╝
  `);
});