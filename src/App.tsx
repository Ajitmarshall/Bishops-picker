import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Paper,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import { Product } from './types';
import ProductSheetUpload from './components/Upload/ProductSheetUpload';
import ProductList from './components/ProductList/ProductList';
import { HashRouter } from 'react-router-dom';

// Create a custom theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#9c27b0',
      light: '#ba68c8',
      dark: '#7b1fa2',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 500,
    },
    subtitle1: {
      fontSize: '1.1rem',
      fontWeight: 500,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
        },
      },
    },
  },
});

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleUploadSuccess = (uploadedProducts: Product[]) => {
    setProducts(uploadedProducts);
    setSuccessMessage(`Successfully uploaded ${uploadedProducts.length} products`);
    setLoading(false);
    setError(null);
  };

  const handleProductUpdate = (updatedProduct: Product) => {
    setProducts(prevProducts =>
      prevProducts.map(product =>
        product.id === updatedProduct.id ? updatedProduct : product
      )
    );
    setSuccessMessage('Product updated successfully');
  };

  return (
    <HashRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
          <AppBar position="sticky" elevation={0}>
            <Toolbar>
              <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
                Bishop's Picker
              </Typography>
            </Toolbar>
          </AppBar>

          <Container maxWidth="lg" sx={{ py: 4 }}>
            <Paper sx={{ p: 3, mb: 4 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                Upload Products
              </Typography>
              <Typography color="text.secondary" paragraph>
                Upload your product sheet or image to get started. Supported formats: Excel (.xlsx, .xls), CSV, Images (.jpg, .jpeg, .png)
              </Typography>
              <ProductSheetUpload 
                onUploadSuccess={handleUploadSuccess}
                setError={setError}
                setLoading={setLoading}
              />
            </Paper>

            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            )}

            {products.length > 0 && (
              <Paper sx={{ p: 3 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                  Product List
                </Typography>
                <ProductList 
                  products={products} 
                  onProductUpdate={handleProductUpdate}
                />
              </Paper>
            )}
          </Container>

          <Snackbar 
            open={!!successMessage} 
            autoHideDuration={6000} 
            onClose={() => setSuccessMessage(null)}
          >
            <Alert 
              onClose={() => setSuccessMessage(null)} 
              severity="success" 
              sx={{ width: '100%' }}
            >
              {successMessage}
            </Alert>
          </Snackbar>

          <Snackbar 
            open={!!error} 
            autoHideDuration={6000} 
            onClose={() => setError(null)}
          >
            <Alert 
              onClose={() => setError(null)} 
              severity="error" 
              sx={{ width: '100%' }}
            >
              {error}
            </Alert>
          </Snackbar>
        </Box>
      </ThemeProvider>
    </HashRouter>
  );
};

export default App; 