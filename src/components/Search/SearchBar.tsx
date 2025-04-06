import React, { useState } from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  Box,
  Chip,
  Paper,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onFilter: (filter: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onFilter }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch(value);
  };

  const handleFilter = (filter: string) => {
    setActiveFilter(filter);
    onFilter(filter);
  };

  const clearSearch = () => {
    setSearchQuery('');
    onSearch('');
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <TextField
        fullWidth
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search by SKU, name, or location..."
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
          endAdornment: searchQuery && (
            <InputAdornment position="end">
              <IconButton onClick={clearSearch} size="small">
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Chip
          label="All"
          onClick={() => handleFilter('all')}
          color={activeFilter === 'all' ? 'primary' : 'default'}
          variant={activeFilter === 'all' ? 'filled' : 'outlined'}
        />
        <Chip
          label="Pending"
          onClick={() => handleFilter('pending')}
          color={activeFilter === 'pending' ? 'primary' : 'default'}
          variant={activeFilter === 'pending' ? 'filled' : 'outlined'}
        />
        <Chip
          label="Picked"
          onClick={() => handleFilter('picked')}
          color={activeFilter === 'picked' ? 'primary' : 'default'}
          variant={activeFilter === 'picked' ? 'filled' : 'outlined'}
        />
        <Chip
          label="Issues"
          onClick={() => handleFilter('issue')}
          color={activeFilter === 'issue' ? 'primary' : 'default'}
          variant={activeFilter === 'issue' ? 'filled' : 'outlined'}
        />
      </Box>
    </Paper>
  );
};

export default SearchBar; 