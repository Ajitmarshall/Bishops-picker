import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  CircularProgress,
  Box,
  Typography,
  Button,
  Paper,
  Divider,
  Tabs,
  Tab,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
} from '@mui/icons-material';
import PickingList from '../components/PickingList/PickingList';
import SearchBar from '../components/Search/SearchBar';
import ProductSheetUpload from '../components/Upload/ProductSheetUpload';
import { PickingList as PickingListType, Product } from '../types';
import ImageService from '../services/imageService';
import ProductList from '../components/ProductList/ProductList';

const DEMO_PICKING_LIST: PickingListType = {
  id: "PL001",
  status: "in-progress",
  createdAt: new Date(),
  items: [
    {
      id: "1",
      sku: "WIN-RED-001",
      name: "Château Margaux 2015",
      imageUrl: "",
      quantity: 2,
      location: "A1-B2",
      status: 'pending'
    },
    {
      id: "2",
      sku: "WIN-WHT-002",
      name: "Chablis Grand Cru 2018",
      imageUrl: "",
      quantity: 1,
      location: "A2-B3",
      status: 'pending'
    }
  ]
};

const PickingListPage: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [pickingList, setPickingList] = useState<PickingListType>(DEMO_PICKING_LIST);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const loadImages = async () => {
      try {
        const updatedItems = await ImageService.updateProductImages(pickingList.items);
        setPickingList((prev: PickingListType) => ({
          ...prev,
          items: updatedItems
        }));
      } catch (error) {
        console.error('Error loading images:', error);
      } finally {
        setLoading(false);
      }
    };

    loadImages();
  }, []);

  const filteredItems = useMemo(() => {
    return pickingList.items.filter((item: Product) => {
      const matchesSearch = searchQuery.toLowerCase() === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilter = activeFilter === 'all' ||
        item.status === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [pickingList.items, searchQuery, activeFilter]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleFilter = (filter: string) => {
    setActiveFilter(filter);
  };

  const handleItemStatusChange = (productId: string, status: Product['status']) => {
    setPickingList((prevList: PickingListType) => ({
      ...prevList,
      items: prevList.items.map((item: Product) => 
        item.id === productId 
          ? { ...item, status: status }
          : item
      )
    }));
  };

  const handleUploadSuccess = (uploadedProducts: Product[]) => {
    setProducts(prevProducts => [...prevProducts, ...uploadedProducts]);
    setShowUpload(false);
    setLoading(false);
    setError(null);
  };

  const handleProductUpdate = (updatedProduct: Product) => {
    setProducts(prevProducts =>
      prevProducts.map(product =>
        product.id === updatedProduct.id ? updatedProduct : product
      )
    );
  };

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusCount = (status: Product['status']) => {
    return products.filter(product => product.status === status).length;
  };

  const sortedAndFilteredProducts = useMemo(() => {
    return filteredProducts
      .slice()
      .sort((a, b) => {
        if (sortOrder === 'asc') {
          return a.name.localeCompare(b.name);
        }
        return b.name.localeCompare(a.name);
      });
  }, [filteredProducts, sortOrder]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ 
        mb: 4, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          Picking List
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          >
            Sort {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowUpload(!showUpload)}
          >
            {showUpload ? 'Cancel Upload' : 'Add Products'}
          </Button>
        </Box>
      </Box>

      {showUpload && (
        <Paper 
          sx={{ 
            p: 3, 
            mb: 3, 
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: theme.shadows[2]
          }}
        >
          <ProductSheetUpload 
            onUploadSuccess={handleUploadSuccess}
            setError={setError}
            setLoading={setLoading}
          />
        </Paper>
      )}

      <Paper sx={{ mb: 3, overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{ px: 2, pt: 1 }}
          >
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>All Products</span>
                  <Chip 
                    size="small" 
                    label={products.length}
                    sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}
                  />
                </Box>
              } 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>Pending</span>
                  <Chip 
                    size="small" 
                    label={getStatusCount('pending')}
                    sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}
                  />
                </Box>
              }
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>Picked</span>
                  <Chip 
                    size="small" 
                    label={getStatusCount('picked')}
                    sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}
                  />
                </Box>
              }
            />
          </Tabs>
        </Box>

        <Box sx={{ p: 3 }}>
          <SearchBar 
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            placeholder="Search products..."
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 500 }}>
              Products ({sortedAndFilteredProducts.length})
            </Typography>
            {searchQuery && (
              <Typography variant="body2" color="text.secondary">
                Showing results for "{searchQuery}"
              </Typography>
            )}
          </Box>

          {sortedAndFilteredProducts.length === 0 ? (
            <Box sx={{ 
              py: 8, 
              textAlign: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.02),
              borderRadius: 1
            }}>
              <Typography color="text.secondary">
                No products found
              </Typography>
            </Box>
          ) : (
            <ProductList 
              products={sortedAndFilteredProducts}
              onProductUpdate={handleProductUpdate}
            />
          )}
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Picking List
        </Typography>
      </Box>

      {filteredItems.length === 0 ? (
        <Box sx={{ 
          textAlign: 'center', 
          py: 4,
          bgcolor: 'background.paper',
          borderRadius: 2,
        }}>
          <Typography variant="h6" color="text.secondary">
            No items found matching your search
          </Typography>
        </Box>
      ) : (
        <PickingList 
          pickingList={{
            ...pickingList,
            items: filteredItems
          }}
          onItemStatusChange={handleItemStatusChange}
        />
      )}
    </Container>
  );
};

export default PickingListPage; 