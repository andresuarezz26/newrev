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
import socketIOClient from 'socket.io-client';

const TestConnection = ({ open, onClose }) => {
    const [apiStatus, setApiStatus] = useState(null);
    const [socketStatus, setSocketStatus] = useState('disconnected');
    const [messages, setMessages] = useState([]);
    const [socket, setSocket] = useState(null);
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

    // Handle Socket.IO connection and events
    useEffect(() => {
        // Create socket connection
        const newSocket = socketIOClient('http://localhost:5000', {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5
        });

        // Set up event listeners
        newSocket.on('connect', () => {
            console.log('Socket.IO connected');
            setSocketStatus('connected');
            setSocket(newSocket);
        });

        newSocket.on('disconnect', () => {
            console.log('Socket.IO disconnected');
            setSocketStatus('disconnected');
        });

        newSocket.on('connect_error', (error) => {
            console.error('Socket.IO connection error:', error);
            setSocketStatus('error');
        });

        // Handle incoming message chunks
        newSocket.on('message_chunk', (data) => {
            console.log('Received chunk:', data);
            setStreamingContent(current => current + (data.chunk || ''));
        });

        // Handle message completion
        newSocket.on('message_complete', (data) => {
            console.log('Message complete:', data);
            setMessages(current => [...current, streamingContent]);
            setStreamingContent('');
            setIsSending(false);
        });

        // Cleanup function
        return () => {
            console.log('Cleaning up socket connection');
            newSocket.disconnect();
        };
    }, []);

    const sendTestMessage = () => {
        if (socket && socketStatus === 'connected') {
            setIsSending(true);
            setStreamingContent(''); // Clear previous content
            socket.emit('test_message', {
                session_id: 'test_session',
                message: 'Hello from client!'
            });
        } else {
            console.error('Cannot send message: Socket not connected');
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
                    <Typography variant="h6" gutterBottom>Socket.IO Status: {socketStatus}</Typography>
                    <Button 
                        variant="contained" 
                        onClick={sendTestMessage} 
                        disabled={socketStatus !== 'connected' || isSending}
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
                        {messages.map((msg, index) => (
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
                        ))}
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