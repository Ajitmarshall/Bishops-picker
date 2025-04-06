import React, { useState } from 'react';
import { Box, Button, TextField } from '@mui/material';
import { Product } from '../types';

interface OCRFeedback {
  originalText: string;
  correctedText: string;
  timestamp: number;
}

const saveFeedback = async (feedback: OCRFeedback) => {
  try {
    const feedbacks = JSON.parse(localStorage.getItem('ocrFeedback') || '[]');
    feedbacks.push(feedback);
    localStorage.setItem('ocrFeedback', JSON.stringify(feedbacks));
  } catch (err) {
    console.error('Error saving feedback:', err);
  }
};

const ProductPreview: React.FC<{ product: Product; onCorrect: (corrected: Product) => void }> = ({
  product,
  onCorrect
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProduct, setEditedProduct] = useState(product);

  const handleCorrection = () => {
    onCorrect(editedProduct);
    saveFeedback({
      originalText: product.name,
      correctedText: editedProduct.name,
      timestamp: Date.now()
    });
    setIsEditing(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        {isEditing ? (
          <TextField
            value={editedProduct.name}
            onChange={(e) => setEditedProduct({ ...editedProduct, name: e.target.value })}
            fullWidth
            size="small"
            autoFocus
          />
        ) : (
          <Box sx={{ flex: 1 }}>{product.name}</Box>
        )}
        <Button
          size="small"
          color={isEditing ? 'primary' : 'inherit'}
          onClick={() => isEditing ? handleCorrection() : setIsEditing(true)}
        >
          {isEditing ? 'Save' : 'Correct OCR'}
        </Button>
        {isEditing && (
          <Button
            size="small"
            color="inherit"
            onClick={() => {
              setEditedProduct(product);
              setIsEditing(false);
            }}
          >
            Cancel
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default ProductPreview; 