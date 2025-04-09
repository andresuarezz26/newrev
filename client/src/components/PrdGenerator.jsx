import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Divider,
  Alert,
  List,
  ListItem,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DescriptionIcon from '@mui/icons-material/Description';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import CodeIcon from '@mui/icons-material/Code';

import api, { socket, SESSION_ID } from '../services/api';

const steps = ['Project Description', 'Generate PRD', 'Generate Tasks', 'Execute Tasks'];

const PrdGenerator = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [projectDescription, setProjectDescription] = useState('');
  const [prd, setPrd] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState(null);
  const [taskResults, setTaskResults] = useState([]);
  const [executionStarted, setExecutionStarted] = useState(false);
  const [executionComplete, setExecutionComplete] = useState(false);

  useEffect(() => {
    // Socket event handlers for PRD generation
    const handlePrdChunk = (data) => {
      if (data.session_id === SESSION_ID) {
        setStreamingContent((prev) => prev + (data.chunk || ''));
      }
    };

    const handlePrdComplete = (data) => {
      if (data.session_id === SESSION_ID) {
        setPrd(data.prd);
        setLoading(false);
        setActiveStep(2); // Move to the next step
      }
    };

    // Socket event handlers for Task generation
    const handleTasksChunk = (data) => {
      if (data.session_id === SESSION_ID) {
        setStreamingContent((prev) => prev + (data.chunk || ''));
      }
    };

    const handleTasksComplete = (data) => {
      if (data.session_id === SESSION_ID) {
        if (data.tasks) {
          setTasks(data.tasks.tasks || []);
        } else if (data.tasks_text) {
          // Handle non-JSON response
          setError('Tasks were generated but not in the expected format');
          setStreamingContent(data.tasks_text);
        }
        setLoading(false);
        setActiveStep(3); // Move to the next step
      }
    };

    // Socket event handlers for Task execution
    const handleTaskStarted = (data) => {
      if (data.session_id === SESSION_ID) {
        setTaskResults((prev) => [
          ...prev,
          {
            task_name: data.task_name,
            description: data.description,
            result: '',
            status: 'running'
          }
        ]);
      }
    };

    const handleTaskChunk = (data) => {
      if (data.session_id === SESSION_ID) {
        setTaskResults((prev) => {
          const updatedResults = [...prev];
          const index = updatedResults.findIndex(r => r.task_name === data.task_name);
          if (index !== -1) {
            updatedResults[index].result += data.chunk;
          }
          return updatedResults;
        });
      }
    };

    const handleTaskCompleted = (data) => {
      if (data.session_id === SESSION_ID) {
        setTaskResults((prev) => {
          const updatedResults = [...prev];
          const index = updatedResults.findIndex(r => r.task_name === data.task_result.task_name);
          if (index !== -1) {
            updatedResults[index] = {
              ...data.task_result,
              status: 'completed'
            };
          }
          return updatedResults;
        });
      }
    };

    const handleTasksExecutionStarted = (data) => {
      if (data.session_id === SESSION_ID) {
        setExecutionStarted(true);
      }
    };

    const handleTasksExecutionCompleted = (data) => {
      if (data.session_id === SESSION_ID) {
        setExecutionComplete(true);
        setLoading(false);
      }
    };

    // Set up socket event listeners
    socket.on('prd_chunk', handlePrdChunk);
    socket.on('prd_complete', handlePrdComplete);
    socket.on('tasks_chunk', handleTasksChunk);
    socket.on('tasks_complete', handleTasksComplete);
    socket.on('task_started', handleTaskStarted);
    socket.on('task_chunk', handleTaskChunk);
    socket.on('task_completed', handleTaskCompleted);
    socket.on('tasks_execution_started', handleTasksExecutionStarted);
    socket.on('tasks_execution_completed', handleTasksExecutionCompleted);

    // Clean up event listeners
    return () => {
      socket.off('prd_chunk', handlePrdChunk);
      socket.off('prd_complete', handlePrdComplete);
      socket.off('tasks_chunk', handleTasksChunk);
      socket.off('tasks_complete', handleTasksComplete);
      socket.off('task_started', handleTaskStarted);
      socket.off('task_chunk', handleTaskChunk);
      socket.off('task_completed', handleTaskCompleted);
      socket.off('tasks_execution_started', handleTasksExecutionStarted);
      socket.off('tasks_execution_completed', handleTasksExecutionCompleted);
    };
  }, []);

  const handleGeneratePRD = async () => {
    if (!projectDescription.trim()) return;
    
    setLoading(true);
    setError(null);
    setStreamingContent('');
    
    try {
      await api.generatePRD(projectDescription);
      // Wait for socket events to complete the process
    } catch (error) {
      setError('Error generating PRD: ' + error.message);
      setLoading(false);
    }
  };

  const handleGenerateTasks = async () => {
    if (!prd.trim()) return;
    
    setLoading(true);
    setError(null);
    setStreamingContent('');
    
    try {
      await api.generateTasks(prd);
      // Wait for socket events to complete the process
    } catch (error) {
      setError('Error generating tasks: ' + error.message);
      setLoading(false);
    }
  };

  const handleExecuteTasks = async () => {
    if (tasks.length === 0) return;
    
    setLoading(true);
    setError(null);
    setTaskResults([]);
    setExecutionStarted(false);
    setExecutionComplete(false);
    
    try {
      await api.executeTasks(tasks);
      // Wait for socket events to complete the process
    } catch (error) {
      setError('Error executing tasks: ' + error.message);
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Describe Your Project
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              variant="outlined"
              placeholder="Describe what you want to build..."
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              disabled={loading}
            />
            <Box mt={2} display="flex" justifyContent="flex-end">
              <Button
                variant="contained"
                color="primary"
                onClick={handleGeneratePRD}
                disabled={loading || !projectDescription.trim()}
              >
                {loading ? <CircularProgress size={24} /> : 'Generate PRD'}
              </Button>
            </Box>
          </Box>
        );
      
      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Generating PRD...
            </Typography>
            {streamingContent ? (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  maxHeight: '400px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {streamingContent}
              </Paper>
            ) : (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            )}
          </Box>
        );
      
      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Product Requirements Document
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                maxHeight: '300px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                mb: 3
              }}
            >
              {prd}
            </Paper>
            
            <Box mt={2} display="flex" justifyContent="flex-end">
              <Button
                variant="contained"
                color="primary"
                onClick={handleGenerateTasks}
                disabled={loading || !prd.trim()}
              >
                {loading ? <CircularProgress size={24} /> : 'Generate Tasks'}
              </Button>
            </Box>
            
            {loading && streamingContent && (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  mt: 2,
                  maxHeight: '200px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {streamingContent}
              </Paper>
            )}
          </Box>
        );
      
      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Implementation Tasks
            </Typography>
            
            {tasks.length > 0 ? (
              <>
                <List>
                  {tasks.map((task, index) => (
                    <ListItem key={index} divider>
                      <ListItemText
                        primary={<Typography variant="subtitle1">{task.name}</Typography>}
                        secondary={
                          <>
                            <Typography variant="body2" color="text.secondary">
                              {task.description}
                            </Typography>
                            
                            {task.subtasks && task.subtasks.length > 0 && (
                              <List dense sx={{ pl: 2 }}>
                                {task.subtasks.map((subtask, idx) => (
                                  <ListItem key={idx}>
                                    <ListItemText
                                      primary={subtask.name}
                                      secondary={subtask.description}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            )}
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
                
                <Box mt={2} display="flex" justifyContent="flex-end">
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleExecuteTasks}
                    disabled={loading || tasks.length === 0}
                  >
                    {loading ? <CircularProgress size={24} /> : 'Execute Tasks'}
                  </Button>
                </Box>
              </>
            ) : (
              <Alert severity="info">No tasks have been generated yet.</Alert>
            )}
            
            {loading && !executionStarted && (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            )}
          </Box>
        );
      
      case 4:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Task Execution Results
            </Typography>
            
            {taskResults.length > 0 ? (
              <Box>
                {taskResults.map((result, index) => (
                  <Accordion key={index} sx={{ mb: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography sx={{ flexGrow: 1 }}>{result.task_name}</Typography>
                      <Chip 
                        label={result.status === 'running' ? 'Running' : 'Completed'} 
                        color={result.status === 'running' ? 'primary' : 'success'}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="body2" gutterBottom>
                        {result.description}
                      </Typography>
                      
                      {result.edited_files && result.edited_files.length > 0 && (
                        <Box mb={2}>
                          <Typography variant="subtitle2">Files Modified:</Typography>
                          <Box component="ul" sx={{ pl: 2 }}>
                            {result.edited_files.map((file, idx) => (
                              <li key={idx}>{file}</li>
                            ))}
                          </Box>
                        </Box>
                      )}
                      
                      {result.commit_hash && (
                        <Box mb={2}>
                          <Typography variant="subtitle2">
                            Commit: {result.commit_hash}
                          </Typography>
                          <Typography variant="body2">
                            {result.commit_message}
                          </Typography>
                        </Box>
                      )}
                      
                      <Divider />
                      
                      <Typography 
                        variant="body2" 
                        component="pre"
                        sx={{ 
                          mt: 2, 
                          p: 1, 
                          backgroundColor: '#f5f5f5',
                          maxHeight: '300px',
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {result.result || 'No output yet'}
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
                
                {executionComplete && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    All tasks have been completed!
                  </Alert>
                )}
              </Box>
            ) : (
              <Alert severity="info">No tasks have been executed yet.</Alert>
            )}
          </Box>
        );
      
      default:
        return null;
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: '800px', mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Project Automation
      </Typography>
      
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label, index) => (
          <Step key={label}>
            <StepLabel 
              StepIconProps={{
                icon: index === 0 ? <DescriptionIcon /> : 
                      index === 1 ? <DescriptionIcon /> :
                      index === 2 ? <FormatListBulletedIcon /> : <CodeIcon />
              }}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {renderStepContent()}
    </Paper>
  );
};

export default PrdGenerator; 