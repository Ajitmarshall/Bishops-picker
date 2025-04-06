import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  Camera as CameraIcon,
  FlipCameraIos as FlipCameraIcon,
  PhotoCamera as PhotoCameraIcon,
  Close as CloseIcon 
} from '@mui/icons-material';
import { utils, read, WorkBook, Sheet } from 'xlsx';
import { Product } from '../../types';
import { downloadTemplate } from '../../utils/exportTemplate';
import { createWorker, CreateWorkerOptions } from 'tesseract.js';

interface ProductSheetUploadProps {
  onUploadSuccess: (products: Product[]) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

interface ExcelRow {
  Item: string;
  Category: string;
  Description: string;
  'Selling Unit': string;
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

interface OCRFeedback {
  originalText: string;
  correctedText: string;
  timestamp: number;
}

// Add worker pool for parallel processing
const WORKER_POOL_SIZE = 4;
let workerPool: any[] = [];

// Add at the top with other interfaces
interface WorkerOptions {
  tessedit_ocr_engine_mode?: string;
  tessedit_pageseg_mode?: string;
  tessedit_char_whitelist?: string;
  preserve_interword_spaces?: string;
  textord_heavy_nr?: string;
  textord_min_linesize?: string;
  tessedit_create_txt?: string;
  tessedit_optimize_enable?: string;
  tessedit_fix_hyphens?: string;
  textord_space_size_is_variable?: string;
  textord_tabfind_vertical_text?: string;
  textord_tabfind_force_vertical_text?: string;
  textord_tabfind_find_tables?: string;
}

// Add clearCache function
const clearCache = async () => {
  try {
    // Clear Tesseract cache
    if (workerPool.length > 0) {
      await Promise.all(workerPool.map(worker => worker.terminate()));
      workerPool = [];
    }

    // Clear browser cache for images
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName.includes('tesseract') || cacheName.includes('image')) {
            return caches.delete(cacheName);
          }
        })
      );
    }

    // Clear local storage cache
    localStorage.removeItem('ocrCache');
    localStorage.removeItem('imageCache');
  } catch (err) {
    console.warn('Error clearing cache:', err);
  }
};

// Update the WorkerPoolManager class
class WorkerPoolManager {
  private workers: any[] = [];
  private setProgress: React.Dispatch<React.SetStateAction<number>>;

  constructor(setProgress: React.Dispatch<React.SetStateAction<number>>) {
    this.setProgress = setProgress;
  }

  async initialize(poolSize: number) {
    if (this.workers.length === 0) {
      for (let i = 0; i < poolSize; i++) {
        const worker = await createWorker({
          logger: (m: TesseractLogger) => {
            if (m.status === 'recognizing text') {
              this.setProgress((prev: number) => {
                return Math.round((prev + m.progress) / poolSize);
              });
            }
          },
          workerOptions: {
            tessedit_ocr_engine_mode: '1',
            tessedit_pageseg_mode: '6',
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.,()& ',
            preserve_interword_spaces: '1',
            textord_heavy_nr: '1',
            textord_min_linesize: '2.5',
            tessedit_create_txt: '1',
            tessedit_optimize_enable: '0',
            tessedit_fix_hyphens: '1',
            textord_space_size_is_variable: '1',
            textord_tabfind_vertical_text: '0',
            textord_tabfind_force_vertical_text: '0',
            textord_tabfind_find_tables: '1'
          } as WorkerOptions
        });
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        this.workers.push(worker);
      }
    }
  }

  getWorker(index: number) {
    return this.workers[index % this.workers.length];
  }

  async terminateAll() {
    await Promise.all(this.workers.map(worker => worker.terminate()));
    this.workers = [];
  }

  get size() {
    return this.workers.length;
  }
}

// Optimize image preprocessing
const preprocessImage = async (file: File): Promise<ImageData[]> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

        // Increase scale for better text recognition
        const scale = Math.min(3, Math.max(400 / img.width, 400 / img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        // Optimize for text
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.filter = 'contrast(120%) brightness(110%)';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Enhance text contrast
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const threshold = 180;
          const value = avg > threshold ? 255 : 0;
          data[i] = value;     // R
          data[i + 1] = value; // G
          data[i + 2] = value; // B
        }

        ctx.putImageData(imageData, 0, 0);
        resolve([imageData]);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// Add camera interface
interface CameraState {
  isOpen: boolean;
  stream: MediaStream | null;
  facingMode: 'user' | 'environment';
}

const ProductSheetUpload: React.FC<ProductSheetUploadProps> = ({ onUploadSuccess, setError, setLoading }) => {
  const [loading, setLoadingState] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [preview, setPreview] = useState<Product[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [imageUploads, setImageUploads] = useState<ImageUploadState>({});
  const [ocrProgress, setOcrProgress] = useState(0);
  const workerPoolRef = useRef<WorkerPoolManager | null>(null);
  // Add camera state
  const [camera, setCamera] = useState<CameraState>({
    isOpen: false,
    stream: null,
    facingMode: 'environment'
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize worker pool manager immediately
  useEffect(() => {
    const initializePool = async () => {
      try {
        if (!workerPoolRef.current) {
          workerPoolRef.current = new WorkerPoolManager(setOcrProgress);
          await workerPoolRef.current.initialize(4); // Initialize with 4 workers
        }
      } catch (err) {
        console.error('Error initializing worker pool:', err);
        setErrorState('Failed to initialize OCR system. Please try again.');
      }
    };

    initializePool();

    // Cleanup function
    return () => {
      if (workerPoolRef.current) {
        workerPoolRef.current.terminateAll();
        workerPoolRef.current = null;
      }
      // Clear any image URLs
      Object.values(imageUploads).forEach(upload => {
        if (upload.previewUrl) {
          URL.revokeObjectURL(upload.previewUrl);
        }
      });
    };
  }, []); // Empty dependency array as we only want to initialize once

  // Move processImageSections inside component
  const processImageSections = async (sections: ImageData[]): Promise<string> => {
    if (!workerPoolRef.current) {
      throw new Error('OCR system not initialized');
    }

    try {
      const results = await Promise.all(
        sections.map(async (section, index) => {
          const worker = workerPoolRef.current?.getWorker(index);
          if (!worker) {
            throw new Error('Worker not available');
          }

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          canvas.width = section.width;
          canvas.height = section.height;
          ctx.putImageData(section, 0, 0);
          
          const { data: { text } } = await worker.recognize(canvas);
          return text;
        })
      );

      return results.join('\n');
    } catch (err) {
      throw new Error(`Error processing image sections: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const parseExcel = async (file: File) => {
    try {
      setLoadingState(true);
      setErrorState(null);

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook: WorkBook = read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet: Sheet = workbook.Sheets[sheetName];
          
          // Convert sheet to JSON with specific headers
          const jsonData = utils.sheet_to_json(sheet) as ExcelRow[];

          if (jsonData.length === 0) {
            throw new Error('No data found in the file');
          }

          const products: Product[] = jsonData.map((row: ExcelRow, index: number) => {
            if (!row.Item || !row.Description) {
              throw new Error(`Row ${index + 1} is missing required fields (Item or Description)`);
            }

            return {
              id: `PROD-${index + 1}`,
              sku: row.Item,
              name: row.Description,
              category: row.Category || '',
              quantity: parseInt(row['Selling Unit']) || 1,
              location: '',
              imageUrl: '',
              status: 'pending'
            };
          });

          setPreview(products);
          setShowPreview(true);
          setLoadingState(false);
        } catch (err) {
          setErrorState(`Error parsing file: ${err instanceof Error ? err.message : 'Invalid format'}`);
          setLoadingState(false);
        }
      };

      reader.onerror = () => {
        setErrorState('Error reading file');
        setLoadingState(false);
      };

      reader.readAsBinaryString(file);
    } catch (err) {
      setErrorState('Error processing file');
      setLoadingState(false);
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

  // Enhanced text cleaning
  const cleanText = (text: string): string => {
    return text
      .split('\n')
      .map(line => {
        return line
          .replace(/[^\w\s\-.,()&]/g, ' ')    // Remove special characters
          .replace(/\s+/g, ' ')               // Normalize spaces
          .replace(/[oO](?=\d)/g, '0')        // Convert 'O' to '0' when before numbers
          .replace(/[lI](?=\d)/g, '1')        // Convert 'l' or 'I' to '1' when before numbers
          .replace(/[Ss](?=\d)/g, '5')        // Convert 'S' to '5' when before numbers
          .replace(/[Zz](?=\d)/g, '2')        // Convert 'Z' to '2' when before numbers
          .trim();
      })
      .filter(line => line.length >= 3)
      .join('\n');
  };

  // Parse with multiple strategies
  const parseWithMultipleStrategies = async (text: string): Promise<Product[]> => {
    const strategies = [
      parseDirectText,           // Direct text parsing
      parseStructuredText,       // Try to find structured format
      parseTableFormat,          // Try to parse as table
      parseWithContextLines      // Try to parse with context from surrounding lines
    ];

    const allProducts: Product[] = [];
    
    for (const strategy of strategies) {
      try {
        const products = await strategy(text);
        if (products.length > 0) {
          allProducts.push(...products);
        }
      } catch (err) {
        console.warn(`Strategy failed:`, err);
      }
    }

    // Remove duplicates and validate
    return removeDuplicatesAndValidate(allProducts);
  };

  // Remove duplicates and validate products
  const removeDuplicatesAndValidate = (products: Product[]): Product[] => {
    const seen = new Set<string>();
    return products
      .filter(product => {
        const key = `${product.sku}-${product.name.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .filter(validateProduct);
  };

  // Validate individual product
  const validateProduct = (product: Product): boolean => {
    return (
      product.name.length >= 3 &&
      product.quantity > 0 &&
      /^[A-Z0-9-]+$/.test(product.sku) &&
      (!product.location || /^[A-Z][0-9]/.test(product.location))
    );
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      // Reset states
      setLoadingState(true);
      setErrorState(null);
      setPreview([]);
      setShowPreview(false);
      setOcrProgress(0);

      // Clear worker pool and cache
      if (workerPoolRef.current) {
        await workerPoolRef.current.terminateAll();
        workerPoolRef.current = null;
      }

      // Clear browser cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName.includes('tesseract') || cacheName.includes('image')) {
              return caches.delete(cacheName);
            }
          })
        );
      }

      // Clear local storage
      localStorage.removeItem('ocrCache');
      localStorage.removeItem('imageCache');

      // Reinitialize worker pool
      workerPoolRef.current = new WorkerPoolManager(setOcrProgress);
      await workerPoolRef.current.initialize(4);

      // Process file based on type
      if (file.type.startsWith('image/')) {
        await parseImage(file);
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel' ||
        file.type === 'text/csv'
      ) {
        await parseExcel(file);
      } else {
        throw new Error('Unsupported file format');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setErrorState(`Error uploading file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoadingState(false);
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

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    try {
      const file = event.dataTransfer.files[0];
      if (!file) return;

      // Reset states
      setLoadingState(true);
      setErrorState(null);
      setPreview([]);
      setShowPreview(false);
      setOcrProgress(0);

      // Clear worker pool and cache
      if (workerPoolRef.current) {
        await workerPoolRef.current.terminateAll();
        workerPoolRef.current = null;
      }

      // Clear browser cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName.includes('tesseract') || cacheName.includes('image')) {
              return caches.delete(cacheName);
            }
          })
        );
      }

      // Clear local storage
      localStorage.removeItem('ocrCache');
      localStorage.removeItem('imageCache');

      // Reinitialize worker pool
      workerPoolRef.current = new WorkerPoolManager(setOcrProgress);
      await workerPoolRef.current.initialize(4);

      // Process file based on type
      if (file.type.startsWith('image/')) {
        await parseImage(file);
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel' ||
        file.type === 'text/csv'
      ) {
        await parseExcel(file);
      } else {
        throw new Error('Unsupported file format');
      }
    } catch (err) {
      console.error('Drop error:', err);
      setErrorState(`Error processing file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoadingState(false);
    }
  };

  const handleImageUpload = (sku: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrorState('Please upload an image file');
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
      setLoadingState(true);

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
      setErrorState('Error uploading images');
    } finally {
      setLoadingState(false);
    }
  };

  // Clean up function to clear cache and resources
  useEffect(() => {
    return () => {
      // Clear cache when component unmounts
      clearCache();
      
      // Clean up image URLs
      Object.values(imageUploads).forEach(upload => {
        if (upload.previewUrl) {
          URL.revokeObjectURL(upload.previewUrl);
        }
      });
    };
  }, [imageUploads]);

  const saveFeedback = async (feedback: OCRFeedback) => {
    try {
      // Save to local storage for now
      const feedbacks = JSON.parse(localStorage.getItem('ocrFeedback') || '[]');
      feedbacks.push(feedback);
      localStorage.setItem('ocrFeedback', JSON.stringify(feedbacks));
      
      // In a real app, you would send this to your server
      // await api.post('/ocr-feedback', feedback);
    } catch (err) {
      console.error('Error saving feedback:', err);
    }
  };

  // Update parseDirectText to better handle sheet format
  const parseDirectText = async (text: string): Promise<Product[]> => {
    const products: Product[] = [];
    const lines = text.split('\n');

    console.log('Raw OCR text:', text); // Debug log

    // Try to find the header line more flexibly
    const headerIndex = lines.findIndex(line => {
      const lowerLine = line.toLowerCase();
      // Look for any combination of headers
      return (lowerLine.includes('item') || lowerLine.includes('sku')) &&
             (lowerLine.includes('category') || lowerLine.includes('cat')) &&
             (lowerLine.includes('description') || lowerLine.includes('desc'));
    });

    console.log('Header found at line:', headerIndex); // Debug log

    // Process lines after header, or all lines if no header found
    const startIndex = headerIndex > -1 ? headerIndex + 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      try {
        const line = lines[i].trim();
        if (!line || line.length < 3) continue;

        console.log('Processing line:', line); // Debug log

        // Clean the line
        const cleanedLine = line
          .replace(/[^\w\s\-.,()&+#'"/\\]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // First try to split by multiple spaces or tabs
        let columns = cleanedLine.split(/\s{2,}|\t/);

        // If we don't get enough columns, try other delimiters
        if (columns.length < 3) {
          // Try splitting by single space but preserve phrases in quotes
          columns = cleanedLine.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        }

        console.log('Split columns:', columns); // Debug log

        // Extract data based on position and content
        let item = '';
        let category = '';
        let description = '';
        let sellingUnit = '1';

        // First column should be Item/SKU (alphanumeric with possible hyphens)
        if (columns[0] && /^[A-Z0-9-]+$/i.test(columns[0])) {
          item = columns[0];
          columns.shift();
        }

        // Look for numeric value that might be selling unit
        const numericIndex = columns.findIndex(col => /^\d+$/.test(col));
        if (numericIndex !== -1) {
          sellingUnit = columns[numericIndex];
          columns.splice(numericIndex, 1);
        }

        // If we have 2 or more columns left, first one might be category
        if (columns.length >= 2 && columns[0].length < 20) {
          category = columns.shift() || '';
        }

        // Remaining text is the description
        description = columns.join(' ')
          .replace(/"/g, '') // Remove quotes
          .trim();

        if (item && description) {
          console.log('Extracted data:', { item, category, description, sellingUnit }); // Debug log
          products.push({
            id: `PROD-${products.length + 1}`,
            sku: item,
            name: description,
            category: category,
            quantity: parseInt(sellingUnit) || 1,
            location: '',
            imageUrl: '',
            status: 'pending' as const
          });
        }
      } catch (err) {
        console.warn('Error parsing line:', lines[i], err);
      }
    }

    console.log('Total products found:', products.length); // Debug log
    return products;
  };

  const parseStructuredText = async (text: string): Promise<Product[]> => {
    const products: Product[] = [];
    const lines = text.split('\n');
    
    const structuredPattern = /^([A-Z0-9-]+)\s+(.+?)\s+(\d+)\s+([A-Z][0-9][-]?[A-Z][0-9]|[A-Z]{1,2}[-]?[0-9]{1,3})/i;

    for (const line of lines) {
      const match = line.match(structuredPattern);
      if (match) {
        products.push({
          id: `PROD-${products.length + 1}`,
          sku: match[1],
          name: match[2].trim(),
          quantity: parseInt(match[3]) || 1,
          location: match[4],
          imageUrl: '',
          status: 'pending' as const
        });
      }
    }

    return products;
  };

  const parseTableFormat = async (text: string): Promise<Product[]> => {
    const products: Product[] = [];
    const lines = text.split('\n');
    
    // Skip header line if it exists
    const startIndex = lines[0].toLowerCase().includes('sku') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const columns = lines[i].split(/\s{2,}|\t/);
      if (columns.length >= 3) {
        products.push({
          id: `PROD-${products.length + 1}`,
          sku: columns[0].trim(),
          name: columns[1].trim(),
          quantity: parseInt(columns[2]) || 1,
          location: columns[3]?.trim() || '',
          imageUrl: '',
          status: 'pending' as const
        });
      }
    }

    return products;
  };

  const parseWithContextLines = async (text: string): Promise<Product[]> => {
    const products: Product[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i].trim();
      const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';

      // Look for SKU pattern in current line
      const skuMatch = currentLine.match(/^([A-Z0-9-]+)/);
      if (skuMatch) {
        const name = nextLine.length > 0 ? nextLine : currentLine.replace(skuMatch[1], '').trim();
        if (name.length >= 3) {
          products.push({
            id: `PROD-${products.length + 1}`,
            sku: skuMatch[1],
            name: name,
            quantity: 1,
            location: '',
            imageUrl: '',
            status: 'pending' as const
          });
          i++; // Skip next line if we used it
        }
      }
    }

    return products;
  };

  // Update parseImage function
  const parseImage = async (file: File) => {
    try {
      setLoadingState(true);
      setErrorState(null);
      setOcrProgress(0);

      if (!workerPoolRef.current) {
        throw new Error('OCR system not initialized. Please try again.');
      }

      // Preprocess image
      const sections = await preprocessImage(file);

      // Process image
      const text = await processImageSections(sections);

      // Clean text and extract descriptions
      const cleanedText = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 3)
        .join('\n');

      console.log('Extracted text:', cleanedText);

      // Parse descriptions into products
      const products = await parseDirectText(cleanedText);

      if (products.length === 0) {
        throw new Error('No descriptions found in image');
      }

      setPreview(products);
      setShowPreview(true);
    } catch (err) {
      console.error('OCR Error:', err);
      setErrorState(`Error processing image: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoadingState(false);
      setOcrProgress(0);
    }
  };

  // Add camera control functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: camera.facingMode }
      });
      
      setCamera(prev => ({ ...prev, isOpen: true, stream }));
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      setErrorState('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (camera.stream) {
      camera.stream.getTracks().forEach(track => track.stop());
    }
    setCamera(prev => ({ ...prev, isOpen: false, stream: null }));
  };

  const flipCamera = async () => {
    stopCamera();
    setCamera(prev => ({
      ...prev,
      facingMode: prev.facingMode === 'user' ? 'environment' : 'user'
    }));
    await startCamera();
  };

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      setLoadingState(true);

      // Capture frame from video
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);

      // Convert to file
      const blob = await new Promise<Blob>((resolve) => 
        canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.95)
      );
      const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' });

      // Stop camera and process image
      stopCamera();
      await parseImage(file);
    } catch (err) {
      console.error('Capture error:', err);
      setErrorState('Error capturing image. Please try again.');
    } finally {
      setLoadingState(false);
    }
  };

  // Add cleanup effect
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <>
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
                disabled={loading || camera.isOpen}
              >
                Upload Sheet or Image
              </Button>
            </label>
            <Button
              variant="outlined"
              startIcon={<CameraIcon />}
              onClick={startCamera}
              disabled={loading || camera.isOpen}
            >
              Scan with Camera
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={downloadTemplate}
              disabled={camera.isOpen}
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

        {/* Camera UI */}
        {camera.isOpen && (
          <Box sx={{ position: 'relative', width: '100%', maxWidth: 600, mx: 'auto', mt: 2 }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{
                width: '100%',
                borderRadius: '8px',
                transform: camera.facingMode === 'user' ? 'scaleX(-1)' : 'none'
              }}
            />
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: 2, 
              mt: 2,
              position: 'absolute',
              bottom: 16,
              left: 0,
              right: 0
            }}>
              <Button
                variant="contained"
                color="error"
                startIcon={<CloseIcon />}
                onClick={stopCamera}
              >
                Close
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<PhotoCameraIcon />}
                onClick={captureImage}
              >
                Capture
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<FlipCameraIcon />}
                onClick={flipCamera}
              >
                Flip
              </Button>
            </Box>
          </Box>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

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
              <Button color="inherit" size="small" onClick={() => setErrorState(null)}>
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
    </>
  );
};

export default ProductSheetUpload; 