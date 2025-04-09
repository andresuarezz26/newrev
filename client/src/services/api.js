import axios from 'axios';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SESSION_ID = localStorage.getItem('sessionId') || `session_${uuidv4()}`;

// Store session ID for future use
if (!localStorage.getItem('sessionId')) {
  localStorage.setItem('sessionId', SESSION_ID);
}

// Socket.io connection
export const socket = io(API_URL.replace('/api', ''), {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10
});

socket.on('connect', () => {
  console.log('Connected to socket server');
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

socket.on('disconnect', () => {
  console.log('Disconnected from socket server');
});

// API service
const api = {
  // Initialize a session
  initSession: async () => {
    try {
      const response = await axios.post(`${API_URL}/init`, {
        session_id: SESSION_ID
      });
      return response.data;
    } catch (error) {
      console.error('Error initializing session:', error);
      throw error;
    }
  },

  // Send a message to Aider
  sendMessage: async (message) => {
    try {
      const response = await axios.post(`${API_URL}/send_message`, {
        session_id: SESSION_ID,
        message
      });
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  // Get file lists
  getFiles: async () => {
    try {
      const response = await axios.get(`${API_URL}/get_files`, {
        params: { session_id: SESSION_ID }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting files:', error);
      throw error;
    }
  },

  // Add a file to the chat
  addFile: async (filename) => {
    try {
      const response = await axios.post(`${API_URL}/add_files`, {
        session_id: SESSION_ID,
        files: [filename]
      });
      return response.data;
    } catch (error) {
      console.error('Error adding file:', error);
      throw error;
    }
  },

  // Remove a file from the chat
  removeFile: async (filename) => {
    try {
      const response = await axios.post(`${API_URL}/remove_files`, {
        session_id: SESSION_ID,
        files: [filename]
      });
      return response.data;
    } catch (error) {
      console.error('Error removing file:', error);
      throw error;
    }
  },

  // Add a web page to the chat
  addWebPage: async (url) => {
    try {
      const response = await axios.post(`${API_URL}/add_web_page`, {
        session_id: SESSION_ID,
        url
      });
      return response.data;
    } catch (error) {
      console.error('Error adding web page:', error);
      throw error;
    }
  },

  // Undo a commit
  undoCommit: async (commitHash) => {
    try {
      const response = await axios.post(`${API_URL}/undo_commit`, {
        session_id: SESSION_ID,
        commit_hash: commitHash
      });
      return response.data;
    } catch (error) {
      console.error('Error undoing commit:', error);
      throw error;
    }
  },

  // Clear chat history
  clearHistory: async () => {
    try {
      const response = await axios.post(`${API_URL}/clear_history`, {
        session_id: SESSION_ID
      });
      return response.data;
    } catch (error) {
      console.error('Error clearing history:', error);
      throw error;
    }
  },

  // Generate a PRD
  generatePRD: async (description) => {
    try {
      const response = await axios.post(`${API_URL}/generate_prd`, {
        session_id: SESSION_ID,
        description
      });
      return response.data;
    } catch (error) {
      console.error('Error generating PRD:', error);
      throw error;
    }
  },

  // Generate tasks from a PRD
  generateTasks: async (prd) => {
    try {
      const response = await axios.post(`${API_URL}/generate_tasks`, {
        session_id: SESSION_ID,
        prd
      });
      return response.data;
    } catch (error) {
      console.error('Error generating tasks:', error);
      throw error;
    }
  },

  // Execute tasks
  executeTasks: async (tasks) => {
    try {
      const response = await axios.post(`${API_URL}/execute_tasks`, {
        session_id: SESSION_ID,
        tasks
      });
      return response.data;
    } catch (error) {
      console.error('Error executing tasks:', error);
      throw error;
    }
  },

  // Get task status
  getTaskStatus: async () => {
    try {
      const response = await axios.get(`${API_URL}/task_status`, {
        params: { session_id: SESSION_ID }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting task status:', error);
      throw error;
    }
  }
};

export { SESSION_ID };
export default api; 