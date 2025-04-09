import React, { useState, useEffect, useRef } from 'react';
import { Button, TextField, Paper, Typography, Box, Divider, CircularProgress, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import api, { addEventListener, removeEventListener, SESSION_ID } from '../services/api';

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef(null);

  // Effect to initialize the session
  useEffect(() => {
    const initSession = async () => {
      try {
        const response = await api.initSession();
        if (response.status === 'success') {
          setMessages(response.messages || []);
        }
        setIsInitializing(false);
      } catch (error) {
        console.error('Failed to initialize session:', error);
        setIsInitializing(false);
      }
    };

    initSession();
  }, []);

  // Effect to set up event listeners
  useEffect(() => {
    // Message chunk handler
    const handleMessageChunk = (data) => {
      console.log('Message chunk received:', data);
      if (data.session_id === SESSION_ID) {
        console.log('Setting streaming content:', data.chunk);
        setStreamingContent((prev) => prev + (data.chunk || ''));
      }
    };

    // Message complete handler
    const handleMessageComplete = (data) => {
      console.log('Message complete received:', data);
      if (data.session_id === SESSION_ID) {
        if (streamingContent) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: streamingContent }
          ]);
        }
        setStreamingContent('');
        setIsLoading(false);
      }
    };

    // Files edited handler
    const handleFilesEdited = (data) => {
      if (data.session_id === SESSION_ID) {
        setMessages((prev) => [
          ...prev,
          { 
            role: 'info', 
            content: `Files edited: ${data.files.join(', ')}` 
          }
        ]);
      }
    };

    // Commit handler
    const handleCommit = (data) => {
      if (data.session_id === SESSION_ID) {
        setMessages((prev) => [
          ...prev,
          { 
            role: 'commit', 
            content: `Commit: ${data.hash}\nMessage: ${data.message}`,
            hash: data.hash,
            message: data.message,
            diff: data.diff
          }
        ]);
      }
    };

    // Error handler
    const handleError = (data) => {
      if (data.session_id === SESSION_ID) {
        setMessages((prev) => [
          ...prev,
          { role: 'error', content: data.message }
        ]);
        setIsLoading(false);
      }
    };

    // Set up event listeners
    addEventListener('message_chunk', handleMessageChunk);
    addEventListener('message_complete', handleMessageComplete);
    addEventListener('files_edited', handleFilesEdited);
    addEventListener('commit', handleCommit);
    addEventListener('error', handleError);

    // Clean up event listeners
    return () => {
      removeEventListener('message_chunk', handleMessageChunk);
      removeEventListener('message_complete', handleMessageComplete);
      removeEventListener('files_edited', handleFilesEdited);
      removeEventListener('commit', handleCommit);
      removeEventListener('error', handleError);
    };
  }, [streamingContent]);

  // Effect to scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Handle send message
  const handleSendMessage = async (e) => {
    console.log('Sending message:', input);
    e?.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    const userMessage = input;
    setInput('');
    setIsLoading(true);
    
    // Add user message immediately
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    
    try {
      await api.sendMessage(userMessage);
      // The response will come via event listeners
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
      
      // Add error message
      setMessages((prev) => [
        ...prev,
        { role: 'error', content: 'Failed to send message. Please try again.' }
      ]);
    }
  };

  // Render message based on role
  const renderMessage = (message, index) => {
    const { role, content } = message;
    
    let backgroundColor;
    let textColor = '#000';
    
    switch (role) {
      case 'user':
        backgroundColor = '#e3f2fd';
        break;
      case 'assistant':
        backgroundColor = '#f1f8e9';
        break;
      case 'info':
        backgroundColor = '#fff8e1';
        break;
      case 'error':
        backgroundColor = '#ffebee';
        textColor = '#c62828';
        break;
      case 'commit':
        backgroundColor = '#e8f5e9';
        break;
      default:
        backgroundColor = '#f5f5f5';
    }
    
    return (
      <Paper 
        key={index} 
        elevation={1} 
        style={{ 
          padding: '10px 15px', 
          marginBottom: '10px',
          backgroundColor,
          color: textColor
        }}
      >
        <Typography variant="caption" display="block" gutterBottom>
          {role.toUpperCase()}
        </Typography>
        <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>
          {content}
        </Typography>
        
        {role === 'commit' && message.diff && (
          <Box mt={1}>
            <Button 
              size="small" 
              variant="outlined" 
              color="primary" 
              onClick={() => api.undoCommit(message.hash)}
            >
              Undo Commit
            </Button>
            <Typography 
              variant="body2" 
              component="pre" 
              style={{ 
                marginTop: '10px',
                padding: '10px',
                backgroundColor: '#f5f5f5',
                overflowX: 'auto',
                fontSize: '0.8rem'
              }}
            >
              {message.diff}
            </Typography>
          </Box>
        )}
      </Paper>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: '800px', mx: 'auto' }}>
      <Typography variant="h4" sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
        Aider Browser
      </Typography>
      
      {isInitializing ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
            {messages.map(renderMessage)}
            
            {streamingContent && (
              <Paper elevation={1} style={{ 
                padding: '10px 15px', 
                marginBottom: '10px',
                backgroundColor: '#f1f8e9',
              }}>
                <Typography variant="caption" display="block" gutterBottom>
                  ASSISTANT
                </Typography>
                <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>
                  {streamingContent}
                </Typography>
              </Paper>
            )}
            
            <div ref={messagesEndRef} />
          </Box>
          
          <Divider />
          
          <Box component="form" onSubmit={handleSendMessage} sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
            <TextField
              fullWidth
              variant="outlined"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message here..."
              disabled={isLoading}
            />
            <IconButton 
              type="submit" 
              color="primary" 
              disabled={isLoading || !input.trim()}
              sx={{ ml: 1 }}
            >
              {isLoading ? <CircularProgress size={24} /> : <SendIcon />}
            </IconButton>
          </Box>
        </>
      )}
    </Box>
  );
};

export default ChatInterface; 