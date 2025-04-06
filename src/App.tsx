import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import theme from './theme';
import Navbar from './components/Navigation/Navbar';
import Home from './pages/Home';
import PickingListPage from './pages/PickingListPage';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ 
          minHeight: '100vh',
          backgroundColor: 'background.default',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Navbar />
          <Box sx={{ flex: 1, py: 3 }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/picking-lists" element={<PickingListPage />} />
              <Route path="/picking-lists/:id" element={<PickingListPage />} />
            </Routes>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App; 