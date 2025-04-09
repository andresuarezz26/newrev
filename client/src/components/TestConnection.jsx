import React, { useEffect, useState } from 'react';
import { 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogActions, 
    Button, 
    Typography, 
    Box,
    List,
    ListItem,
    ListItemText,
    CircularProgress
} from '@mui/material';
import { addEventListener, removeEventListener, sendTestMessage } from '../services/api';

const TestConnection = ({ open, onClose }) => {
    const [apiStatus, setApiStatus] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [streamingContent, setStreamingContent] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Handle HTTP API test
    useEffect(() => {
        const testApiConnection = async () => {
            try {
                setIsLoading(true);
                const response = await fetch('http://localhost:5000/api/test_connection');
                const data = await response.json();
                setApiStatus(data);
            } catch (error) {
                setApiStatus({ status: 'error', message: error.message });
            } finally {
                setIsLoading(false);
            }
        };

        testApiConnection();
    }, []);

    // Handle event stream connection and events
    useEffect(() => {
        // Connection event handler
        const handleConnected = (data) => {
            console.log('Event stream connected:', data);
            setConnectionStatus('connected');
        };

        // Message chunk handler
        const handleMessageChunk = (data) => {
            console.log('Received chunk:', data);
            if (data.chunk) {
                setStreamingContent(current => current + data.chunk);
            }
        };

        // Message complete handler
        const handleMessageComplete = () => {
            console.log('Message complete');
            if (streamingContent) {
                setMessages(current => [...current, streamingContent]);
                setStreamingContent('');
            }
            setIsSending(false);
        };

        // Error handler
        const handleError = (error) => {
            console.error('Connection error:', error);
            setConnectionStatus('error');
            setIsSending(false);
        };

        // Set up event listeners
        addEventListener('connected', handleConnected);
        addEventListener('message_chunk', handleMessageChunk);
        addEventListener('message_complete', handleMessageComplete);
        addEventListener('error', handleError);

        // Cleanup function
        return () => {
            removeEventListener('connected', handleConnected);
            removeEventListener('message_chunk', handleMessageChunk);
            removeEventListener('message_complete', handleMessageComplete);
            removeEventListener('error', handleError);
        };
    }, [streamingContent]);

    const handleSendTestMessage = async () => {
        if (connectionStatus !== 'connected') {
            console.error('Cannot send message: Not connected');
            return;
        }

        setIsSending(true);
        setStreamingContent(''); // Clear previous content
        
        try {
            await sendTestMessage('Hello from client!');
        } catch (error) {
            console.error('Error sending test message:', error);
            setIsSending(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Connection Test</DialogTitle>
            <DialogContent>
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>HTTP API Status:</Typography>
                    {isLoading ? (
                        <CircularProgress size={24} />
                    ) : (
                        <pre style={{ 
                            backgroundColor: '#f5f5f5', 
                            padding: '10px', 
                            borderRadius: '4px',
                            overflow: 'auto'
                        }}>
                            {JSON.stringify(apiStatus, null, 2)}
                        </pre>
                    )}
                </Box>

                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>Connection Status: {connectionStatus}</Typography>
                    <Button 
                        variant="contained" 
                        onClick={handleSendTestMessage} 
                        disabled={connectionStatus !== 'connected' || isSending}
                        sx={{ mt: 1 }}
                    >
                        {isSending ? 'Sending...' : 'Send Test Message'}
                    </Button>
                </Box>

                {streamingContent && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" gutterBottom>Streaming Response:</Typography>
                        <pre style={{ 
                            backgroundColor: '#f5f5f5', 
                            padding: '10px', 
                            borderRadius: '4px',
                            overflow: 'auto'
                        }}>
                            {streamingContent}
                        </pre>
                    </Box>
                )}

                <Box>
                    <Typography variant="h6" gutterBottom>Received Messages:</Typography>
                    <List>
                        {messages.length > 0 ? (
                            messages.map((msg, index) => (
                                <ListItem key={index}>
                                    <ListItemText
                                        primary={
                                            <Box>
                                                <Typography variant="caption" color="textSecondary">
                                                    {new Date().toLocaleString()}
                                                </Typography>
                                                <pre style={{ 
                                                    backgroundColor: '#f5f5f5', 
                                                    padding: '10px', 
                                                    borderRadius: '4px',
                                                    overflow: 'auto',
                                                    marginTop: '8px'
                                                }}>
                                                    {msg}
                                                </pre>
                                            </Box>
                                        }
                                    />
                                </ListItem>
                            ))
                        ) : (
                            <ListItem>
                                <ListItemText primary="No messages received yet" />
                            </ListItem>
                        )}
                    </List>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default TestConnection; 