import React, { useState } from 'react';
import {
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Typography,
  Box,
  Chip,
  Card,
  CardMedia,
} from '@mui/material';
import { CheckCircle, Cancel, Help } from '@mui/icons-material';
import { Product } from '../../types';

interface Props {
  product: Product;
  onStatusChange: (status: Product['status']) => void;
}

const PickingListItem: React.FC<Props> = ({ product, onStatusChange }) => {
  const [imageError, setImageError] = useState(false);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'picked':
        return 'success';
      case 'not-found':
        return 'error';
      case 'issue':
        return 'warning';
      default:
        return 'default';
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <Card 
      sx={{ 
        mb: 2,
        p: 2,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        },
      }}
    >
      <ListItem
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'flex-start',
          gap: 2,
          px: 0,
          py: 0,
        }}
        secondaryAction={
          <Box sx={{ 
            display: 'flex',
            gap: 1,
            mt: { xs: 2, sm: 0 },
            '& .MuiIconButton-root': {
              transition: 'transform 0.2s',
              '&:hover': {
                transform: 'scale(1.1)',
              },
            },
          }}>
            <IconButton 
              onClick={() => onStatusChange('picked')} 
              color="success"
              size="large"
            >
              <CheckCircle />
            </IconButton>
            <IconButton 
              onClick={() => onStatusChange('not-found')} 
              color="error"
              size="large"
            >
              <Cancel />
            </IconButton>
            <IconButton 
              onClick={() => onStatusChange('issue')} 
              color="warning"
              size="large"
            >
              <Help />
            </IconButton>
          </Box>
        }
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, width: '100%' }}>
          <CardMedia
            component="img"
            sx={{
              width: 120,
              height: 120,
              objectFit: 'contain',
              borderRadius: 2,
              bgcolor: 'grey.50',
              p: 1,
              transition: 'transform 0.2s',
              '&:hover': {
                transform: 'scale(1.05)',
              },
            }}
            image={imageError ? 'https://via.placeholder.com/120x120?text=No+Image' : product.imageUrl}
            alt={product.name}
            onError={handleImageError}
          />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="div" gutterBottom>
              {product.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              SKU: {product.sku} • Qty: {product.quantity}
            </Typography>
            {product.location && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Location: {product.location}
              </Typography>
            )}
            {product.status && (
              <Chip
                label={product.status.toUpperCase()}
                color={getStatusColor(product.status)}
                size="small"
                sx={{ mt: 1 }}
              />
            )}
          </Box>
        </Box>
      </ListItem>
    </Card>
  );
};

export default PickingListItem; 