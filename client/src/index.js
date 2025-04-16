import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Simple function to create a unique session ID
const generateSessionId = () => {
    return 'test_session_' + Math.random().toString(36).substring(2, 15);
};

const SESSION_ID = generateSessionId();

const TestConnection = () => {
    const [apiStatus, setApiStatus] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [messages, setMessages] = useState([]);
    const [streamingContent, setStreamingContent] = useState('');
    const [eventSource, setEventSource] = useState(null);

    useEffect(() => {
        // Test HTTP endpoint
        const testApiConnection = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/test_connection');
                const data = await response.json();
                setApiStatus(data);
            } catch (error) {
                setApiStatus({ status: 'error', message: error.message });
            }
        };

        // Initialize EventSource connection
        const source = new EventSource(`http://localhost:5000/api/stream?session_id=${SESSION_ID}`);
        setEventSource(source);

        source.addEventListener('connected', (event) => {
            setConnectionStatus('connected');
            console.log('EventSource connected:', JSON.parse(event.data));
        });

        source.addEventListener('message_chunk', (event) => {
            const data = JSON.parse(event.data);
            console.log('Received message chunk:', data);
            if (data.chunk) {
                setStreamingContent(current => current + data.chunk);
            }
        });

        source.addEventListener('message_complete', (event) => {
            console.log('Message complete:', JSON.parse(event.data));
            if (streamingContent) {
                setMessages(prev => [...prev, streamingContent]);
                setStreamingContent('');
            }
        });

        source.onerror = (error) => {
            console.error('EventSource error:', error);
            setConnectionStatus('error');
        };

        testApiConnection();

        return () => {
            source.close();
        };
    }, [streamingContent]);

    const sendTestMessage = async () => {
        if (connectionStatus === 'connected') {
            try {
                const response = await fetch('http://localhost:5000/api/test_message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        session_id: SESSION_ID,
                        message: 'Hello from client!'
                    })
                });
                const data = await response.json();
                console.log('Test message sent:', data);
            } catch (error) {
                console.error('Error sending test message:', error);
            }
        }
    };

    return (
        <div>
        {/** <div style={{ padding: '20px' }}>
            <h2>Connection Test</h2>
            
            <div style={{ marginBottom: '20px' }}>
                <h3>HTTP API Status:</h3>
                <pre>{JSON.stringify(apiStatus, null, 2)}</pre>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h3>Connection Status: {connectionStatus}</h3>
                <button onClick={sendTestMessage} disabled={connectionStatus !== 'connected'}>
                    Send Test Message
                </button>
            </div>

            {streamingContent && (
                <div style={{ marginBottom: '20px' }}>
                    <h3>Streaming Content:</h3>
                    <pre style={{ backgroundColor: '#f5f5f5', padding: '10px' }}>
                        {streamingContent}
                    </pre>
                </div>
            )}

            <div>
                <h3>Received Messages:</h3>
                <ul>
                    {messages.map((msg, index) => (
                        <li key={index}>
                            <pre style={{ backgroundColor: '#f5f5f5', padding: '10px' }}>
                                {msg}
                            </pre>
                        </li>
                    ))}
                </ul>
            </div>
        </div>*/}
        </div> 
    );
};

const root = createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <TestConnection />
        <App />
    </React.StrictMode>
); 