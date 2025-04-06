import React, { useState } from 'react';
import { TextField, Button, Box, Alert } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';

interface ScannerProps {
  onScan: (code: string) => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScan }) => {
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      setManualInput('');
      setError(null);
    } else {
      setError('Please enter a valid code');
    }
  };

  const handleScannerClick = async () => {
    try {
      // Check if the browser supports the BarcodeDetector API
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'code_128']
        });
        
        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Handle successful scan
        // For now, we'll just use manual input as fallback
        stream.getTracks().forEach(track => track.stop());
      } else {
        setError('Barcode scanning is not supported in this browser. Please use manual input.');
      }
    } catch (err) {
      setError('Failed to access camera. Please use manual input.');
    }
  };

  return (
    <Box sx={{ my: 2 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '1rem' }}>
        <TextField
          fullWidth
          label="Enter SKU or scan barcode"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          variant="outlined"
          size="small"
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleScannerClick}
          startIcon={<QrCodeScannerIcon />}
        >
          Scan
        </Button>
        <Button
          variant="contained"
          type="submit"
        >
          Submit
        </Button>
      </form>
    </Box>
  );
};

export default Scanner; 