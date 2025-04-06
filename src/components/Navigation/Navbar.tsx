import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  IconButton,
  Badge,
} from '@mui/material';
import {
  Home as HomeIcon,
  ListAlt as ListIcon,
  Notifications as NotificationsIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AppBar position="sticky" sx={{ backgroundColor: 'white', color: 'text.primary' }}>
      <Container maxWidth="lg">
        <Toolbar disableGutters>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <img 
              src="/logo.png" 
              alt="Bishop's Picker" 
              style={{ height: 40, marginRight: 16 }}
              onError={(e: any) => {
                e.target.style.display = 'none';
              }}
            />
            <Typography variant="h6" component="div" color="primary">
              Bishop's Picker
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<HomeIcon />}
              color={location.pathname === '/' ? 'primary' : 'inherit'}
              onClick={() => navigate('/')}
            >
              Home
            </Button>
            <Button
              startIcon={<ListIcon />}
              color={location.pathname.includes('/picking-lists') ? 'primary' : 'inherit'}
              onClick={() => navigate('/picking-lists')}
            >
              Lists
            </Button>
            <IconButton color="inherit">
              <Badge badgeContent={3} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <IconButton color="inherit">
              <PersonIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Navbar; 