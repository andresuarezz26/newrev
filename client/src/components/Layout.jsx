import React, { useState } from 'react';
import { Box, Typography, Drawer, IconButton, AppBar, Toolbar, Divider, Button } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import WebIcon from '@mui/icons-material/Web';

import ChatInterface from './ChatInterface';
import FileManager from './FileManager';
import WebPageAdder from './WebPageAdder';
import api from '../services/api';

const drawerWidth = 320;

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showWebAdder, setShowWebAdder] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear the chat history? This cannot be undone.')) {
      try {
        await api.clearHistory();
        // Force reload to refresh the UI
        window.location.reload();
      } catch (error) {
        console.error('Error clearing history:', error);
        alert('Failed to clear chat history. Please try again.');
      }
    }
  };

  const drawer = (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Aider Browser</Typography>
        <IconButton 
          onClick={handleDrawerToggle}
          sx={{ display: { sm: 'none' } }}
        >
          <CloseIcon />
        </IconButton>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      <Button 
        variant="outlined" 
        color="primary"
        fullWidth
        startIcon={<WebIcon />}
        onClick={() => setShowWebAdder(true)}
        sx={{ mb: 2 }}
      >
        Add Web Page
      </Button>
      
      <Button 
        variant="outlined" 
        color="error"
        fullWidth
        startIcon={<AutorenewIcon />}
        onClick={handleClearHistory}
        sx={{ mb: 2 }}
      >
        Clear Chat History
      </Button>
      
      <Divider sx={{ my: 2 }} />
      
      <FileManager />
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            Aider Browser
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{ 
          flexGrow: 1, 
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <ChatInterface />
        </Box>
      </Box>
      
      {showWebAdder && (
        <WebPageAdder 
          open={showWebAdder} 
          onClose={() => setShowWebAdder(false)}
        />
      )}
    </Box>
  );
};

export default Layout; 