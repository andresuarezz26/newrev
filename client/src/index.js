import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import socketIOClient from 'socket.io-client';
import App from './App';

const TestConnection = () => {
    const [apiStatus, setApiStatus] = useState(null);
    const [socketStatus, setSocketStatus] = useState('disconnected');
    const [messages, setMessages] = useState([]);
    const [socket, setSocket] = useState(null);

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

        // Initialize Socket.IO connection
        const socket = socketIOClient('http://localhost:5000');
        setSocket(socket);

        socket.on('connect', () => {
            setSocketStatus('connected');
            console.log('Socket.IO connected');
        });

        socket.on('disconnect', () => {
            setSocketStatus('disconnected');
            console.log('Socket.IO disconnected');
        });

        socket.on('test_response', (data) => {
            console.log('Received test response:', data);
            setMessages(prev => [...prev, data]);
        });

        testApiConnection();

        return () => {
            socket.disconnect();
        };
    }, []);

    const sendTestMessage = () => {
        if (socket) {
            socket.emit('test_message', {
                session_id: 'test_session',
                message: 'Hello from client!'
            });
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2>Connection Test</h2>
            
            <div style={{ marginBottom: '20px' }}>
                <h3>HTTP API Status:</h3>
                <pre>{JSON.stringify(apiStatus, null, 2)}</pre>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h3>Socket.IO Status: {socketStatus}</h3>
                <button onClick={sendTestMessage} disabled={socketStatus !== 'connected'}>
                    Send Test Message
                </button>
            </div>

            <div>
                <h3>Received Messages:</h3>
                <ul>
                    {messages.map((msg, index) => (
                        <li key={index}>
                            <pre>{console.log("msg: "+ JSON.stringify(msg, null, 2))}</pre>
                        </li>
                    ))}
                </ul>
            </div>
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