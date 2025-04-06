import React, { useState, useEffect, useMemo } from 'react';
import { Container, CircularProgress, Box, Typography, Button } from '@mui/material';
import PickingList from '../components/PickingList/PickingList';
import SearchBar from '../components/Search/SearchBar';
import ProductSheetUpload from '../components/Upload/ProductSheetUpload';
import { PickingList as PickingListType, Product } from '../types';
import ImageService from '../services/imageService';

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
  const [pickingList, setPickingList] = useState<PickingListType>(DEMO_PICKING_LIST);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);

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

  const handleUploadSuccess = (products: Product[]) => {
    setPickingList((prev: PickingListType) => ({
      ...prev,
      items: products
    }));
    setShowUpload(false);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Picking List
        </Typography>
        <Button
          variant="contained"
          onClick={() => setShowUpload(!showUpload)}
        >
          {showUpload ? 'Hide Upload' : 'Upload List'}
        </Button>
      </Box>
      
      {showUpload && (
        <ProductSheetUpload onUploadSuccess={handleUploadSuccess} />
      )}

      <SearchBar 
        onSearch={handleSearch}
        onFilter={handleFilter}
      />

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