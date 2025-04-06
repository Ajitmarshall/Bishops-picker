import React from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { Product } from '../../types';

interface ProductListProps {
  products: Product[];
  onProductUpdate: (product: Product) => void;
}

const ProductList: React.FC<ProductListProps> = ({ products, onProductUpdate }) => {
  const getStatusIcon = (status: Product['status']) => {
    switch (status) {
      case 'picked':
        return <CheckCircleIcon sx={{ color: 'success.main' }} />;
      case 'not-found':
        return <ErrorIcon sx={{ color: 'error.main' }} />;
      case 'issue':
        return <WarningIcon sx={{ color: 'warning.main' }} />;
      default:
        return <SearchIcon sx={{ color: 'info.main' }} />;
    }
  };

  return (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>SKU</TableCell>
            <TableCell>Name</TableCell>
            <TableCell align="center">Quantity</TableCell>
            <TableCell>Location</TableCell>
            <TableCell align="center">Status</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>{product.sku}</TableCell>
              <TableCell>{product.name}</TableCell>
              <TableCell align="center">{product.quantity}</TableCell>
              <TableCell>{product.location}</TableCell>
              <TableCell align="center">
                <Chip
                  icon={getStatusIcon(product.status)}
                  label={product.status.replace('-', ' ')}
                  size="small"
                  color={
                    product.status === 'picked' ? 'success' :
                    product.status === 'not-found' ? 'error' :
                    product.status === 'issue' ? 'warning' : 'default'
                  }
                />
              </TableCell>
              <TableCell>
                <IconButton
                  size="small"
                  onClick={() => onProductUpdate(product)}
                >
                  <SearchIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {products.length === 0 && (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No products found
          </Typography>
        </Box>
      )}
    </TableContainer>
  );
};

export default ProductList; 