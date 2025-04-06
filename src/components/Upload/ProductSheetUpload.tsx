import React, { useState, useCallback, useEffect } from 'react';
import {
  Button,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  LinearProgress,
} from '@mui/material';
import { 
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import { utils, read, WorkBook, Sheet } from 'xlsx';
import { Product } from '../../types';
import { downloadTemplate } from '../../utils/exportTemplate';
import { createWorker, CreateWorkerOptions } from 'tesseract.js';

interface ProductSheetUploadProps {
  onUploadSuccess: (products: Product[]) => void;
}

interface ExcelRow {
  id?: string;
  sku: string;
  name: string;
  imageUrl?: string;
  quantity?: number;
  location?: string;
}

interface ImageUploadState {
  [sku: string]: {
    file?: File;
    previewUrl?: string;
  };
}

// Add type for Tesseract logger
interface TesseractLogger {
  status: string;
  progress: number;
}

// Add interface for parsed row
interface ParsedRow {
  item: string;
  category: string;
  subcategory: string;
  bin: string;
  description: string;
  qtyToShip: number;
}

interface TableData {
  headers: string[];
  rows: string[][];
}

const ProductSheetUpload: React.FC<ProductSheetUploadProps> = ({ onUploadSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Product[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [imageUploads, setImageUploads] = useState<ImageUploadState>({});
  const [ocrProgress, setOcrProgress] = useState(0);

  const parseExcel = async (file: File) => {
    try {
      setLoading(true);
      setError(null);

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook: WorkBook = read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet: Sheet = workbook.Sheets[sheetName];
          
          // Convert sheet to JSON without type parameter
          const jsonData = utils.sheet_to_json(sheet) as ExcelRow[];

          if (jsonData.length === 0) {
            throw new Error('No data found in the file');
          }

          const products: Product[] = jsonData.map((row: ExcelRow, index: number) => {
            if (!row.sku || !row.name) {
              throw new Error(`Row ${index + 1} is missing required fields (SKU or Name)`);
            }
            return {
              id: row.id || `PROD-${index + 1}`,
              sku: row.sku,
              name: row.name,
              imageUrl: row.imageUrl || '',
              quantity: row.quantity || 1,
              location: row.location || '',
              status: 'pending',
            };
          });

          setPreview(products);
          setShowPreview(true);
          setLoading(false);
        } catch (err) {
          setError(`Error parsing file: ${err instanceof Error ? err.message : 'Invalid format'}`);
          setLoading(false);
        }
      };

      reader.onerror = () => {
        setError('Error reading file');
        setLoading(false);
      };

      reader.readAsBinaryString(file);
    } catch (err) {
      setError('Error processing file');
      setLoading(false);
    }
  };

  const preprocessText = (text: string): string[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      // Remove multiple spaces and replace with single space
      .map(line => line.replace(/\s+/g, ' '))
      // Remove special characters except alphanumeric, spaces, and basic punctuation
      .map(line => line.replace(/[^a-zA-Z0-9\s\-_.,()]/g, ''));
  };

  const parseRow = (row: string): ParsedRow | null => {
    try {
      // Pattern for item number (usually at start)
      const itemPattern = /^([A-Z0-9-]+)/i;
      
      // Pattern for bin location (format: BIN-1, BIN-A1, etc.)
      const binPattern = /BIN[-\s]?([A-Z0-9-]+)/i;
      
      // Pattern for quantity (looking for numbers followed by optional units)
      const qtyPattern = /(?:qty|quantity|ship):?\s*(\d+)|(\d+)\s*(?:pc|pcs|units|to\s*ship)/i;
      
      // Pattern for category/subcategory (usually in parentheses or after certain keywords)
      const categoryPattern = /(?:category|cat)[:.\s-]+([^,]+)(?:,\s*([^,\n]+))?/i;

      // Try to match item number
      const itemMatch = row.match(itemPattern);
      if (!itemMatch) return null;
      const item = itemMatch[1];
      
      // Remove item from string for further processing
      let remaining = row.slice(itemMatch[0].length).trim();

      // Try to match bin location
      const binMatch = row.match(binPattern);
      const bin = binMatch ? binMatch[1] : '';

      // Try to match quantity
      const qtyMatch = row.match(qtyPattern);
      const qtyToShip = qtyMatch ? parseInt(qtyMatch[1] || qtyMatch[2]) || 0 : 0;

      // Try to match category/subcategory
      const categoryMatch = row.match(categoryPattern);
      const category = categoryMatch ? categoryMatch[1].trim() : '';
      const subcategory = categoryMatch && categoryMatch[2] ? categoryMatch[2].trim() : '';

      // The remaining text (after removing known parts) is likely the description
      remaining = remaining
        .replace(binPattern, '')
        .replace(qtyPattern, '')
        .replace(categoryPattern, '')
        .trim();

      // Clean up description
      const description = remaining.replace(/\s+/g, ' ').trim();

      if (!item || !description) {
        return null;
      }

      return {
        item,
        category,
        subcategory,
        bin,
        description,
        qtyToShip,
      };
    } catch (err) {
      console.warn('Error parsing row:', row, err);
      return null;
    }
  };

  const preprocessImage = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;

          // Higher resolution for better text recognition
          const scale = Math.max(
            1200 / img.width,
            1200 / img.height,
            2
          );

          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          // Apply better image processing
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);

          // Enhanced image processing
          let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // Apply adaptive thresholding
          for (let i = 0; i < imageData.data.length; i += 4) {
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];
            
            // Enhanced grayscale conversion
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            
            // Dynamic thresholding based on local contrast
            const threshold = gray > 180 ? 220 : gray > 120 ? 160 : 100;
            const value = gray > threshold ? 255 : 0;
            
            imageData.data[i] = value;
            imageData.data[i + 1] = value;
            imageData.data[i + 2] = value;
            imageData.data[i + 3] = 255;
          }

          ctx.putImageData(imageData, 0, 0);

          // Apply sharpening and contrast enhancement
          ctx.filter = 'contrast(120%) brightness(105%) sharpen(1)';
          ctx.drawImage(canvas, 0, 0);

          resolve(canvas.toDataURL('image/png', 1.0));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const enhanceImageForOCR = (imageData: ImageData): ImageData => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Create grayscale array for processing
    const grayscale = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      grayscale[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    // Calculate adaptive threshold using Otsu's method
    const threshold = calculateOtsuThreshold(grayscale);

    // Apply local adaptive thresholding
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const gIdx = y * width + x;

        // Get local threshold
        const localThreshold = getLocalThreshold(grayscale, x, y, width, height, threshold);
        
        // Apply threshold and set value
        const value = grayscale[gIdx] > localThreshold ? 255 : 0;

        // Set RGB channels
        data[idx] = value;
        data[idx + 1] = value;
        data[idx + 2] = value;
      }
    }

    // Apply sharpening
    applySharpening(data, width, height);

    // Apply noise reduction
    applyNoiseReduction(data, width, height);

    return imageData;
  };

  const calculateOtsuThreshold = (data: Uint8Array): number => {
    const histogram = new Array(256).fill(0);
    data.forEach(pixel => histogram[pixel]++);

    let sum = 0;
    let total = data.length;
    
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let maxVariance = 0;
    let threshold = 0;

    for (let i = 0; i < 256; i++) {
      wB += histogram[i];
      if (wB === 0) continue;
      
      wF = total - wB;
      if (wF === 0) break;

      sumB += i * histogram[i];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const variance = wB * wF * (mB - mF) * (mB - mF);

      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = i;
      }
    }

    return threshold;
  };

  const getLocalThreshold = (
    data: Uint8Array,
    x: number,
    y: number,
    width: number,
    height: number,
    globalThreshold: number
  ): number => {
    const windowSize = 20; // Increased window size for better local analysis
    let sum = 0;
    let count = 0;

    for (let dy = -windowSize; dy <= windowSize; dy++) {
      for (let dx = -windowSize; dx <= windowSize; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          sum += data[ny * width + nx];
          count++;
        }
      }
    }

    const localMean = sum / count;
    // Weighted combination of local and global thresholds
    return 0.7 * localMean + 0.3 * globalThreshold;
  };

  const applySharpening = (data: Uint8ClampedArray, width: number, height: number): void => {
    const kernel = [
      -1, -1, -1,
      -1,  9, -1,
      -1, -1, -1
    ];
    const temp = new Uint8ClampedArray(data.length);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * width + (x + kx)) * 4 + c;
              sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
            }
          }
          temp[(y * width + x) * 4 + c] = Math.max(0, Math.min(255, sum));
        }
        temp[(y * width + x) * 4 + 3] = 255;
      }
    }

    // Copy back the sharpened data
    for (let i = 0; i < data.length; i++) {
      data[i] = temp[i];
    }
  };

  const applyNoiseReduction = (data: Uint8ClampedArray, width: number, height: number): void => {
    const temp = new Uint8ClampedArray(data.length);
    const windowSize = 2;

    for (let y = windowSize; y < height - windowSize; y++) {
      for (let x = windowSize; x < width - windowSize; x++) {
        for (let c = 0; c < 3; c++) {
          const values = [];
          for (let dy = -windowSize; dy <= windowSize; dy++) {
            for (let dx = -windowSize; dx <= windowSize; dx++) {
              const idx = ((y + dy) * width + (x + dx)) * 4 + c;
              values.push(data[idx]);
            }
          }
          values.sort((a, b) => a - b);
          temp[(y * width + x) * 4 + c] = values[Math.floor(values.length / 2)];
        }
        temp[(y * width + x) * 4 + 3] = 255;
      }
    }

    // Copy back the filtered data
    for (let i = 0; i < data.length; i++) {
      data[i] = temp[i];
    }
  };

  const parseImage = async (file: File) => {
    try {
      setLoading(true);
      setError(null);

      // Enhanced preprocessing with better image quality
      const processedImageUrl = await preprocessImage(file);

      // Initialize worker with optimized settings
      const worker = await createWorker({
        logger: (m: TesseractLogger) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
        workerOptions: {
          tessedit_ocr_engine_mode: '1',     // LSTM only
          tessedit_pageseg_mode: '4',        // Assume single column of text
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.,() $',
          preserve_interword_spaces: '1',
          textord_heavy_nr: '1',             // More aggressive noise removal
          tessedit_enable_doc_dict: '0',     // Disable dictionary
          language_model_penalty_non_dict_word: '0.5',
          language_model_penalty_non_freq_dict_word: '0.5',
          tessedit_pageseg_fixed_pitch: '0',
          tessedit_do_invert: '0',
          tessedit_blur_multiple: '1.2',     // Slight blur for better recognition
          edges_max_children_per_outline: '40'
        }
      } as CreateWorkerOptions);

      await worker.loadLanguage('eng');
      await worker.initialize('eng');

      // Perform OCR with enhanced settings
      const { data: { text } } = await worker.recognize(processedImageUrl);
      await worker.terminate();

      // Enhanced text cleaning and normalization
      const cleanedText = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          return line
            .replace(/[^\w\s\-.,()]/g, ' ')  // Remove special characters
            .replace(/\s+/g, ' ')            // Normalize spaces
            .replace(/[oO](?=\d)/g, '0')     // Convert 'O' to '0' when before numbers
            .replace(/[lI](?=\d)/g, '1')     // Convert 'l' or 'I' to '1' when before numbers
            .replace(/[Ss](?=\d)/g, '5')     // Convert 'S' to '5' when before numbers
            .trim();
        })
        .filter(line => line.length >= 3)    // Remove very short lines
        .join('\n');

      console.log('Raw OCR text:', text);
      console.log('Cleaned OCR text:', cleanedText);

      // Parse text with enhanced pattern matching
      const products = parseDirectText(cleanedText);
      
      if (products.length === 0) {
        throw new Error('Could not extract product information. Please ensure the image is clear and contains product details.');
      }

      setPreview(products);
      setShowPreview(true);
    } catch (err) {
      console.error('OCR Error:', err);
      setError(`Error processing image: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      setOcrProgress(0);
    }
  };

  const parseDirectText = (text: string): Product[] => {
    const products: Product[] = [];
    const lines = text.split('\n');

    // Enhanced patterns for better product description matching
    const patterns = {
      // Match product descriptions with various formats
      description: /^(?:item|product|desc|description)?[:.\s-]*([A-Za-z0-9\s\-.,()&+#'"/\\]+)(?=\s*(?:\d|qty|bin|loc|$))/i,
      
      // Match quantities at the end or beginning of lines
      quantity: /(?:^|\s)(?:qty|quantity|pcs|pieces|units|count|amount|x|\*|=)?\s*?(\d+)(?:\s*(?:pc|pcs|pieces|units|qty|x|\*|ea|each))?(?:\s|$)/i,
      
      // Match location codes
      location: /(?:loc|bin|shelf|pos|location|aisle)?[-:\s]*([A-Z][0-9][-]?[A-Z][0-9]|[A-Z]{1,2}[-]?[0-9]{1,3})\b/i,
      
      // Match common product attributes to remove
      removeWords: /\b(?:qty|pcs|pieces|units|loc|bin|shelf|pos|location|aisle|item|product|description|each|ea)\b/gi,
      
      // Match numbers that aren't part of product names
      numbers: /(?:^|\s)(\d+)(?:\s|$)/g
    };

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line || line.length < 3) continue;

      try {
        // Initial line cleanup
        line = line
          .replace(/[^\w\s\-.,()&+#'"/\\]/g, ' ')  // Allow more special characters
          .replace(/\s+/g, ' ')
          .trim();

        console.log('Processing line:', line);

        // Try to extract description
        let description = '';
        let remainingText = line;

        // Strategy 1: Look for description pattern
        const descMatch = line.match(patterns.description);
        if (descMatch && descMatch[1].length > 3) {
          description = descMatch[1].trim();
          remainingText = line.replace(descMatch[0], '').trim();
        } else {
          // Strategy 2: Remove known patterns and use remaining text
          remainingText = line;
          
          // Remove quantity
          const qtyMatch = remainingText.match(patterns.quantity);
          if (qtyMatch) {
            remainingText = remainingText.replace(qtyMatch[0], ' ').trim();
          }
          
          // Remove location
          const locMatch = remainingText.match(patterns.location);
          if (locMatch) {
            remainingText = remainingText.replace(locMatch[0], ' ').trim();
          }
          
          description = remainingText;
        }

        // Extract quantity and location
        const quantity = patterns.quantity.test(line) 
          ? parseInt(line.match(patterns.quantity)![1]) 
          : 1;
        
        const location = patterns.location.test(line)
          ? line.match(patterns.location)![1]
          : '';

        // Clean up description
        description = description
          .replace(patterns.removeWords, ' ')
          .replace(patterns.numbers, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // Try to combine with next line if needed
        if (description.length < 10 && i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim()
            .replace(/[^\w\s\-.,()&+#'"/\\]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          // Only combine if next line looks like part of the description
          if (!patterns.quantity.test(nextLine) && 
              !patterns.location.test(nextLine) && 
              !/^\d+/.test(nextLine)) {
            description = `${description} ${nextLine}`.trim();
            i++;
          }
        }

        // Final cleanup and validation
        if (description.length >= 3) {
          // Remove any remaining unwanted patterns
          description = description
            .replace(/^\W+|\W+$/g, '') // Remove non-word characters from start/end
            .replace(/\s+/g, ' ')
            .trim();

          // Format description properly
          description = description
            .toLowerCase()
            .replace(/\b\w/g, c => c.toUpperCase()) // Capitalize first letter of each word
            .replace(/\b(Of|And|The|In|On|At|To|For|With|By)\b/g, word => word.toLowerCase()); // Common words lowercase

          const finalProduct: Product = {
            id: `PROD-${products.length + 1}`,
            sku: `ITEM-${products.length + 1}`,
            name: description,
            quantity,
            location: location.toUpperCase(),
            imageUrl: '',
            status: 'pending' as const
          };

          // Only add if we have a unique, valid description
          if (!products.some(p => p.name.toLowerCase() === description.toLowerCase())) {
            products.push(finalProduct);
            console.log('Extracted product:', finalProduct);
          }
        }

      } catch (err) {
        console.warn(`Error parsing line ${i + 1}:`, err);
      }
    }

    return products;
  };

  // Add function to clear Tesseract cache
  const clearTesseractCache = async () => {
    try {
      const worker = await createWorker();
      await worker.terminate();
      // Clear IndexedDB cache
      const databases = await window.indexedDB.databases();
      databases.forEach(db => {
        if (db.name?.includes('tesseract')) {
          window.indexedDB.deleteDatabase(db.name);
        }
      });
      console.log('Tesseract cache cleared');
    } catch (err) {
      console.warn('Error clearing Tesseract cache:', err);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Clear cache before processing
      await clearTesseractCache();

      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png'].includes(fileExt || '')) {
        await parseImage(file);
      } else if (['xlsx', 'xls', 'csv'].includes(fileExt || '')) {
        await parseExcel(file);
      } else {
        setError('Unsupported file format');
      }
    } catch (err) {
      setError(`Error processing file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    try {
      // Clear cache before processing
      await clearTesseractCache();

      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png'].includes(fileExt || '')) {
        await parseImage(file);
      } else if (['xlsx', 'xls', 'csv'].includes(fileExt || '')) {
        await parseExcel(file);
      } else {
        setError('Please upload an Excel, CSV, or image file');
      }
    } catch (err) {
      setError(`Error processing file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const handleImageUpload = (sku: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);

    setImageUploads(prev => ({
      ...prev,
      [sku]: { file, previewUrl }
    }));

    // Update preview data with new image
    setPreview(prev => prev.map(product => 
      product.sku === sku 
        ? { ...product, imageUrl: previewUrl }
        : product
    ));
  };

  const handleConfirmUpload = async () => {
    try {
      setLoading(true);

      // Process images first
      const updatedProducts = await Promise.all(
        preview.map(async (product) => {
          const imageData = imageUploads[product.sku];
          if (imageData?.file) {
            // In a real app, you would upload to a server and get a URL back
            // For now, we'll use the local preview URL
            return {
              ...product,
              imageUrl: imageData.previewUrl || ''
            };
          }
          return product;
        })
      );

      onUploadSuccess(updatedProducts);
      setShowPreview(false);
      setPreview([]);
      setImageUploads({});
    } catch (error) {
      setError('Error uploading images');
    } finally {
      setLoading(false);
    }
  };

  // Clean up function to clear cache and resources
  useEffect(() => {
    return () => {
      // Clear cache when component unmounts
      clearTesseractCache();
      
      // Clean up image URLs
      Object.values(imageUploads).forEach(upload => {
        if (upload.previewUrl) {
          URL.revokeObjectURL(upload.previewUrl);
        }
      });
    };
  }, [imageUploads]);

  return (
    <Paper 
      sx={{ 
        p: 3, 
        mb: 3,
        border: dragActive ? '2px dashed #1976d2' : '2px dashed #ccc',
        backgroundColor: dragActive ? 'rgba(25, 118, 210, 0.04)' : 'transparent',
        transition: 'all 0.2s ease',
      }}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <Box sx={{ textAlign: 'center' }}>
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.jpg,.jpeg,.png"
          style={{ display: 'none' }}
          id="product-sheet-upload"
          onChange={handleFileUpload}
        />
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 2 }}>
          <label htmlFor="product-sheet-upload">
            <Button
              variant="contained"
              component="span"
              startIcon={<UploadIcon />}
              disabled={loading}
            >
              Upload Sheet or Image
            </Button>
          </label>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={downloadTemplate}
          >
            Download Template
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Drag and drop your file here or click to upload
        </Typography>
        <Typography variant="caption" display="block" color="text.secondary">
          Supported formats: Excel (.xlsx, .xls), CSV, Images (.jpg, .jpeg, .png)
        </Typography>
      </Box>

      {loading && (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={24} />
            <Typography>
              {ocrProgress > 0 ? `Processing image: ${ocrProgress}%` : 'Processing file...'}
            </Typography>
          </Box>
          {ocrProgress > 0 && (
            <Box sx={{ width: '100%', mt: 2 }}>
              <LinearProgress 
                variant="determinate" 
                value={ocrProgress} 
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          )}
        </Box>
      )}

      {error && (
        <Alert 
          severity="error" 
          sx={{ mt: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setError(null)}>
              DISMISS
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Dialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Preview Products
          <Typography variant="caption" display="block" color="text.secondary">
            {preview.length} items found
          </Typography>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {preview.map((product, index) => (
              <Box 
                key={index} 
                sx={{ 
                  mb: 2, 
                  p: 2, 
                  bgcolor: 'grey.50', 
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: 'grey.100',
                  },
                }}
              >
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {/* Image Preview */}
                  <Box
                    sx={{
                      width: 100,
                      height: 100,
                      bgcolor: 'grey.200',
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                        }}
                      />
                    ) : (
                      <ImageIcon sx={{ fontSize: 40, color: 'grey.400' }} />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      id={`image-upload-${product.sku}`}
                      onChange={(e) => handleImageUpload(product.sku, e)}
                    />
                    <label htmlFor={`image-upload-${product.sku}`}>
                      <Button
                        component="span"
                        sx={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          bgcolor: 'rgba(0,0,0,0.5)',
                          color: 'white',
                          '&:hover': {
                            bgcolor: 'rgba(0,0,0,0.7)',
                          },
                        }}
                        size="small"
                      >
                        Upload
                      </Button>
                    </label>
                  </Box>

                  {/* Product Details */}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {product.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      SKU: {product.sku} | Quantity: {product.quantity}
                    </Typography>
                    {product.location && (
                      <Typography variant="body2" color="text.secondary">
                        Location: {product.location}
                      </Typography>
                    )}
                    {(product.category || product.subcategory) && (
                      <Typography variant="body2" color="text.secondary">
                        {product.category}
                        {product.category && product.subcategory && ' > '}
                        {product.subcategory}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirmUpload} 
            variant="contained"
            color="primary"
            disabled={loading}
          >
            {loading ? 'Uploading...' : `Confirm Upload (${preview.length} items)`}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ProductSheetUpload; 