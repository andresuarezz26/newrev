import React, { useState, useEffect } from 'react';
import { 
  Box, 
  List, 
  ListItem, 
  ListItemText, 
  IconButton, 
  TextField, 
  InputAdornment, 
  Typography,
  Divider,
  Paper,
  CircularProgress,
  Checkbox,
  ListItemIcon
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import api from '../services/api';

const FileManager = () => {
  const [files, setFiles] = useState([]);
  const [inchatFiles, setInchatFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await api.getFiles();
        if (response.status === 'success') {
          setFiles(response.all_files || []);
          setInchatFiles(response.inchat_files || []);
        } else {
          setError('Failed to fetch files');
        }
      } catch (error) {
        setError('Error fetching files: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFiles();
  }, []);

  const handleAddFile = async (filename) => {
    if (inchatFiles.includes(filename)) return;
    
    try {
      setIsLoading(true);
      const response = await api.addFile(filename);
      if (response.status === 'success') {
        setInchatFiles((prev) => [...prev, filename]);
      }
    } catch (error) {
      setError('Error adding file: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFile = async (filename) => {
    if (!inchatFiles.includes(filename)) return;
    
    try {
      setIsLoading(true);
      const response = await api.removeFile(filename);
      if (response.status === 'success') {
        setInchatFiles((prev) => prev.filter(f => f !== filename));
      }
    } catch (error) {
      setError('Error removing file: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFile = async (filename) => {
    if (inchatFiles.includes(filename)) {
      await handleRemoveFile(filename);
    } else {
      await handleAddFile(filename);
    }
  };

  const filteredFiles = files.filter(file => 
    file.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading && files.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 2, bgcolor: '#ffebee' }}>
        <Typography color="error">{error}</Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ maxHeight: '400px', overflow: 'auto' }}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Repository Files
        </Typography>
        
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search files..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          margin="normal"
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {inchatFiles.length} of {files.length} files in chat
        </Typography>
      </Box>
      
      <Divider />
      
      <List dense>
        {filteredFiles.map((file) => {
          const isInChat = inchatFiles.includes(file);
          
          return (
            <ListItem
              key={file}
              secondaryAction={
                <IconButton 
                  edge="end" 
                  aria-label={isInChat ? 'remove from chat' : 'add to chat'}
                  onClick={() => handleToggleFile(file)}
                  color={isInChat ? 'error' : 'primary'}
                >
                  {isInChat ? <RemoveIcon /> : <AddIcon />}
                </IconButton>
              }
            >
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={isInChat}
                  onChange={() => handleToggleFile(file)}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText 
                primary={file} 
                primaryTypographyProps={{
                  style: {
                    fontWeight: isInChat ? 'bold' : 'normal',
                  },
                }}
              />
            </ListItem>
          );
        })}
        
        {filteredFiles.length === 0 && (
          <ListItem>
            <ListItemText primary="No matching files found" />
          </ListItem>
        )}
      </List>
    </Paper>
  );
};

export default FileManager; 