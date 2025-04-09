import React, { useState, useEffect } from 'react';
import { 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogActions, 
    Button, 
    Typography, 
    Box,
    TextField,
    Stepper,
    Step,
    StepLabel,
    CircularProgress,
    Paper,
    Chip,
    Divider,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    LinearProgress
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { addEventListener, removeEventListener, SESSION_ID } from '../services/api';
import api from '../services/api';

const PRDAnalyzer = ({ open, onClose }) => {
    const [prdContent, setPrdContent] = useState('');
    const [numTasks, setNumTasks] = useState(5);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeStep, setActiveStep] = useState(0);
    const [processingStatus, setProcessingStatus] = useState('');
    const [tasks, setTasks] = useState([]);
    const [error, setError] = useState(null);

    const steps = [
        'Input PRD',
        'Task Generation',
        'Complexity Analysis',
        'Subtask Creation',
        'Results'
    ];

    useEffect(() => {
        // Handle status updates
        const handleStatus = (data) => {
            if (data.session_id === SESSION_ID) {
                setProcessingStatus(data.message);
                
                if (data.status === 'started') {
                    setActiveStep(1);
                } else if (data.status === 'analyzing_complexity') {
                    setActiveStep(2);
                } else if (data.status === 'generating_subtasks') {
                    setActiveStep(3);
                }
            }
        };

        // Handle completion
        const handleComplete = (data) => {
            if (data.session_id === SESSION_ID) {
                setTasks(data.tasks);
                setActiveStep(4);
                setIsProcessing(false);
            }
        };

        // Handle errors
        const handleError = (data) => {
            if (data.session_id === SESSION_ID) {
                setError(data.message);
                setIsProcessing(false);
            }
        };

        // Add event listeners
        addEventListener('prd_processing_status', handleStatus);
        addEventListener('prd_processing_complete', handleComplete);
        addEventListener('error', handleError);

        // Clean up
        return () => {
            removeEventListener('prd_processing_status', handleStatus);
            removeEventListener('prd_processing_complete', handleComplete);
            removeEventListener('error', handleError);
        };
    }, []);

    const handleSubmitPRD = async () => {
        if (!prdContent.trim()) {
            setError('PRD content cannot be empty');
            return;
        }

        setError(null);
        setIsProcessing(true);
        setProcessingStatus('Submitting PRD...');
        setActiveStep(0);

        try {
            await api.generateTasksFromPRD(prdContent, numTasks);
            // Status updates will come through the event listeners
        } catch (error) {
            console.error('Error submitting PRD:', error);
            setError('Failed to submit PRD. Please try again.');
            setIsProcessing(false);
        }
    };

    const renderDependencyChip = (dependencyId) => {
        const dependencyTask = tasks.find(task => task.id === dependencyId);
        return (
            <Chip 
                key={dependencyId}
                label={dependencyTask ? dependencyTask.title : `Task ${dependencyId}`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ m: 0.5 }}
            />
        );
    };

    const renderComplexityIndicator = (score) => {
        let color = 'success';
        if (score > 3 && score <= 6) color = 'warning';
        if (score > 6) color = 'error';
        
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 1 }}>
                <Typography variant="body2" mr={1}>
                    Complexity: {score}/10
                </Typography>
                <LinearProgress 
                    variant="determinate" 
                    value={score * 10} 
                    color={color}
                    sx={{ width: '100px', height: '8px', borderRadius: '4px' }}
                />
            </Box>
        );
    };

    return (
        <Dialog open={open} onClose={!isProcessing ? onClose : undefined} maxWidth="lg" fullWidth>
            <DialogTitle>PRD Analysis</DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep} sx={{ mt: 2, mb: 4 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {activeStep === 0 && (
                    <Box>
                        <Typography variant="h6" gutterBottom>Enter your Product Requirements Document</Typography>
                        <TextField
                            label="PRD Content"
                            multiline
                            rows={10}
                            fullWidth
                            value={prdContent}
                            onChange={(e) => setPrdContent(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            label="Number of Tasks"
                            type="number"
                            value={numTasks}
                            onChange={(e) => setNumTasks(parseInt(e.target.value) || 5)}
                            InputProps={{ inputProps: { min: 3, max: 10 } }}
                            sx={{ width: '200px' }}
                        />
                    </Box>
                )}

                {(activeStep > 0 && activeStep < 4 && isProcessing) && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 4 }}>
                        <CircularProgress size={60} sx={{ mb: 2 }} />
                        <Typography variant="h6">{processingStatus}</Typography>
                    </Box>
                )}

                {activeStep === 4 && (
                    <Box>
                        <Typography variant="h6" gutterBottom>Generated Tasks</Typography>
                        {tasks.map((task) => (
                            <Accordion key={task.id} sx={{ mb: 2 }}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                        <Typography variant="subtitle1">
                                            {task.id}. {task.title}
                                        </Typography>
                                        <Box sx={{ display: 'flex', mt: 1 }}>
                                            <Chip 
                                                label={`Priority: ${task.priority || 'medium'}`}
                                                size="small"
                                                color={task.priority === 'high' ? 'error' : task.priority === 'low' ? 'success' : 'warning'}
                                                sx={{ mr: 1 }}
                                            />
                                            {task.complexityScore && renderComplexityIndicator(task.complexityScore)}
                                        </Box>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Typography variant="body1" gutterBottom>{task.description}</Typography>
                                    
                                    {task.dependencies && task.dependencies.length > 0 && (
                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="subtitle2">Dependencies:</Typography>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                                                {task.dependencies.map(renderDependencyChip)}
                                            </Box>
                                        </Box>
                                    )}
                                    
                                    {task.details && (
                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="subtitle2">Implementation Details:</Typography>
                                            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8f9fa' }}>
                                                <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
                                                    {task.details}
                                                </Typography>
                                            </Paper>
                                        </Box>
                                    )}
                                    
                                    {task.testStrategy && (
                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="subtitle2">Test Strategy:</Typography>
                                            <Typography variant="body2">{task.testStrategy}</Typography>
                                        </Box>
                                    )}
                                    
                                    {task.complexityReasoning && (
                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="subtitle2">Complexity Analysis:</Typography>
                                            <Typography variant="body2">{task.complexityReasoning}</Typography>
                                        </Box>
                                    )}
                                    
                                    {task.subtasks && task.subtasks.length > 0 && (
                                        <Box sx={{ mt: 3 }}>
                                            <Divider sx={{ mb: 2 }} />
                                            <Typography variant="subtitle2">Subtasks:</Typography>
                                            
                                            {task.subtasks.map((subtask) => (
                                                <Paper key={subtask.id} variant="outlined" sx={{ p: 2, mt: 1 }}>
                                                    <Typography variant="subtitle2">{subtask.title}</Typography>
                                                    <Typography variant="body2">{subtask.description}</Typography>
                                                    
                                                    {subtask.dependencies && subtask.dependencies.length > 0 && (
                                                        <Box sx={{ mt: 1 }}>
                                                            <Typography variant="caption">Dependencies:</Typography>
                                                            <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                                                                {subtask.dependencies.map(dep => (
                                                                    <Chip 
                                                                        key={dep}
                                                                        label={`Subtask ${dep}`}
                                                                        size="small"
                                                                        variant="outlined"
                                                                        sx={{ m: 0.5 }}
                                                                    />
                                                                ))}
                                                            </Box>
                                                        </Box>
                                                    )}
                                                    
                                                    {subtask.details && (
                                                        <Box sx={{ mt: 1 }}>
                                                            <Typography variant="caption">Implementation Details:</Typography>
                                                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                                                {subtask.details}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </Paper>
                                            ))}
                                        </Box>
                                    )}
                                </AccordionDetails>
                            </Accordion>
                        ))}
                    </Box>
                )}

                {error && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: '#ffebee', borderRadius: 1 }}>
                        <Typography color="error">{error}</Typography>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                {activeStep === 0 && (
                    <Button onClick={handleSubmitPRD} variant="contained" color="primary" disabled={isProcessing}>
                        Analyze PRD
                    </Button>
                )}
                <Button onClick={onClose} disabled={isProcessing}>
                    {activeStep === 4 ? 'Close' : 'Cancel'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default PRDAnalyzer; 