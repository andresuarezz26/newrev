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
    LinearProgress,
    Alert,
    Snackbar
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { SESSION_ID } from '../services/api';
import api from '../services/api';

const PRDAnalyzer = ({ open, onClose }) => {
    const [prdContent, setPrdContent] = useState('');
    const [numTasks, setNumTasks] = useState(5);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeStep, setActiveStep] = useState(0);
    const [processingStatus, setProcessingStatus] = useState('');
    const [tasks, setTasks] = useState([]);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);
    const [metadata, setMetadata] = useState(null);
    const [loadingPRD, setLoadingPRD] = useState(false);
    const [prdLoaded, setPrdLoaded] = useState(false);
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });

    const steps = [
        'Input PRD',
        'Task Generation',
        'Complexity Analysis',
        'Subtask Creation',
        'Results'
    ];

    // Load PRD content when component opens
    useEffect(() => {
        if (open) {
            loadPRDContent();
            refreshRepositoryFiles();
        }
    }, [open]);

    const loadPRDContent = async () => {
        setLoadingPRD(true);
        try {
            const response = await api.getPRDContent();
            if (response.status === 'success' && response.prd_content) {
                setPrdContent(response.prd_content);
                setPrdLoaded(true);
                setNotification({
                    open: true,
                    message: 'Loaded existing PRD from repository',
                    severity: 'success'
                });
            }
        } catch (error) {
            console.log('No existing PRD found or error loading it');
            // This is not a critical error, so we don't need to show it to the user
        } finally {
            setLoadingPRD(false);
        }
    };

    // Refresh the repository files list to include new files
    const refreshRepositoryFiles = async () => {
        try {
            await api.getFiles();
            // This updates the files list in the app state through the API
            console.log('Repository files refreshed');
        } catch (error) {
            console.error('Error refreshing repository files:', error);
        }
    };

    const handleCloseNotification = () => {
        setNotification({ ...notification, open: false });
    };

    const handleSubmitPRD = async () => {
        if (!prdContent.trim()) {
            setError('PRD content cannot be empty');
            return;
        }

        setError(null);
        setIsProcessing(true);
        setProcessingStatus('Submitting PRD...');
        setActiveStep(1);
        setProgress(10);

        try {
            // Simulate progress for better UX
            const progressInterval = setInterval(() => {
                setProgress(prev => {
                    if (prev < 90) return prev + 5;
                    return prev;
                });
                
                // Update status message based on progress
                if (progress >= 10 && progress < 40) {
                    setProcessingStatus('Generating tasks...');
                    setActiveStep(1);
                } else if (progress >= 40 && progress < 60) {
                    setProcessingStatus('Analyzing task complexity...');
                    setActiveStep(2);
                } else if (progress >= 60 && progress < 90) {
                    setProcessingStatus('Generating subtasks for complex tasks...');
                    setActiveStep(3);
                }
            }, 800);
            
            // Call the synchronous API endpoint
            const response = await api.generateTasksFromPRD(prdContent, numTasks);
            
            // Clear interval and set final progress
            clearInterval(progressInterval);
            setProgress(100);
            
            // Process response
            if (response.status === 'success') {
                setTasks(response.tasks);
                setMetadata(response.metadata);
                setActiveStep(4);
                setProcessingStatus('Analysis complete');
            } else {
                throw new Error(response.message || 'Failed to analyze PRD');
            }
        } catch (error) {
            console.error('Error submitting PRD:', error);
            setError('Failed to analyze PRD: ' + (error.message || 'Unknown error'));
        } finally {
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
            <Snackbar 
                open={notification.open} 
                autoHideDuration={6000} 
                onClose={handleCloseNotification}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseNotification} severity={notification.severity}>
                    {notification.message}
                </Alert>
            </Snackbar>
            
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
                        {loadingPRD ? (
                            <Box display="flex" justifyContent="center" mt={3} mb={3}>
                                <CircularProgress size={40} />
                            </Box>
                        ) : (
                            <>
                                {prdLoaded && (
                                    <Alert severity="info" sx={{ mb: 2 }}>
                                        An existing PRD was loaded from the repository. You can edit it below if needed.
                                    </Alert>
                                )}
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
                            </>
                        )}
                    </Box>
                )}

                {(activeStep > 0 && activeStep < 4 && isProcessing) && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 4 }}>
                        <Box sx={{ width: '100%', mb: 2 }}>
                            <LinearProgress variant="determinate" value={progress} />
                        </Box>
                        <CircularProgress size={60} sx={{ mb: 2 }} />
                        <Typography variant="h6">{processingStatus}</Typography>
                    </Box>
                )}

                {activeStep === 4 && (
                    <Box>
                        <Typography variant="h6" gutterBottom>Generated Tasks</Typography>
                        
                        {metadata && metadata.prdFile && (
                            <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                <Typography>
                                    PRD saved to: <code>{metadata.prdFile}</code>
                                </Typography>
                            </Box>
                        )}
                        
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
                                                    <Typography variant="subtitle2">
                                                        {subtask.id}: {subtask.title}
                                                        {subtask.estimatedHours && (
                                                            <Chip 
                                                                label={`~${subtask.estimatedHours} hours`}
                                                                size="small"
                                                                color="info"
                                                                sx={{ ml: 1 }}
                                                            />
                                                        )}
                                                    </Typography>
                                                    
                                                    {subtask.description && (
                                                        <Typography variant="body2" sx={{ mt: 1 }}>
                                                            {subtask.description}
                                                        </Typography>
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
                    <Button onClick={handleSubmitPRD} variant="contained" color="primary" disabled={isProcessing || loadingPRD}>
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