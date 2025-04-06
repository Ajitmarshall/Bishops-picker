import React, { useState } from 'react';
import { List, Paper, Typography, Alert } from '@mui/material';
import { PickingList as PickingListType, Product } from '../../types';
import PickingListItem from './PickingListItem';
import Scanner from '../Scanner/Scanner';

interface Props {
  pickingList: PickingListType;
  onItemStatusChange: (productId: string, status: Product['status']) => void;
}

const PickingList: React.FC<Props> = ({ pickingList, onItemStatusChange }) => {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = (scannedCode: string) => {
    const matchedItem = pickingList.items.find(
      (item: Product) => item.sku === scannedCode || item.id === scannedCode
    );

    if (matchedItem) {
      onItemStatusChange(matchedItem.id, 'picked');
      setScannerOpen(false);
    } else {
      setError(`No matching item found for code: ${scannedCode}`);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Picking List #{pickingList.id}
      </Typography>
      
      <Scanner onScan={handleScan} />
      
      {error && (
        <Alert 
          severity="error"
          sx={{ my: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <List>
        {pickingList.items.map((item: Product) => (
          <PickingListItem
            key={item.id}
            product={item}
            onStatusChange={(status) => onItemStatusChange(item.id, status)}
          />
        ))}
      </List>
    </Paper>
  );
};

export default PickingList; 