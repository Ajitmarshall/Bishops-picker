import React from 'react';
import { Typography, Container, Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container>
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome to Bishop's Picker
        </Typography>
        <Typography variant="body1" gutterBottom>
          A visual picking assistant for warehouse operations
        </Typography>
        <Button 
          variant="contained" 
          color="primary"
          onClick={() => navigate('/picking-lists')}
          sx={{ mt: 2 }}
        >
          View Picking Lists
        </Button>
      </Box>
    </Container>
  );
};

export default Home; 