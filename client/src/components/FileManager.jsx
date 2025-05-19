"use client"

import { useState, useEffect } from "react"
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
  ListItemIcon,
  Chip,
  Tooltip,
  alpha
} from "@mui/material"
import SearchIcon from "@mui/icons-material/Search"
import AddIcon from "@mui/icons-material/Add"
import RemoveIcon from "@mui/icons-material/Remove"
import FolderIcon from "@mui/icons-material/Folder"
import CodeIcon from "@mui/icons-material/Code"
import api from "../services/api"

const FileManager = () => {
  const [files, setFiles] = useState([])
  const [inchatFiles, setInchatFiles] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Get file extension
  const getFileExtension = (filename) => {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2)
  }
  
  // Get file icon based on extension
  const getFileIcon = (filename) => {
    const ext = getFileExtension(filename).toLowerCase()
    
    // Return appropriate icon based on file type
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rb'].includes(ext)) {
      return <CodeIcon fontSize="small" sx={{ color: '#555' }} />
    }
    
    return <FolderIcon fontSize="small" sx={{ color: '#555' }} />
  }

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await api.getFiles()
        if (response.status === "success") {
          setFiles(response.all_files || [])
          setInchatFiles(response.inchat_files || [])
        } else {
          setError("Failed to fetch files")
        }
      } catch (error) {
        setError("Error fetching files: " + error.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchFiles()
  }, [])

  const handleAddFile = async (filename) => {
    if (inchatFiles.includes(filename)) return

    try {
      setIsLoading(true)
      const response = await api.addFile(filename)
      if (response.status === "success") {
        setInchatFiles((prev) => [...prev, filename])
      }
    } catch (error) {
      setError("Error adding file: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveFile = async (filename) => {
    if (!inchatFiles.includes(filename)) return

    try {
      setIsLoading(true)
      const response = await api.removeFile(filename)
      if (response.status === "success") {
        setInchatFiles((prev) => prev.filter((f) => f !== filename))
      }
    } catch (error) {
      setError("Error removing file: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleFile = async (filename) => {
    if (inchatFiles.includes(filename)) {
      await handleRemoveFile(filename)
    } else {
      await handleAddFile(filename)
    }
  }

  const filteredFiles = (() => {
    const matchingFiles = files.filter((file) => file.toLowerCase().includes(searchTerm.toLowerCase()));
    const inChatMatching = matchingFiles.filter(file => inchatFiles.includes(file));
    const notInChatMatching = matchingFiles.filter(file => !inchatFiles.includes(file));
    return [...inChatMatching, ...notInChatMatching];
  })();

  if (isLoading && files.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "200px" }}>
        <CircularProgress sx={{ color: "#1976d2" }} />
      </Box>
    )
  }

  if (error) {
    return (
      <Paper
        sx={{
          p: 2,
          bgcolor: "#ffebee",
          borderRadius: "12px",
          boxShadow: "none",
          border: "1px solid #ffcdd2",
        }}
      >
        <Typography color="error" sx={{ fontSize: "14px" }}>
          {error}
        </Typography>
      </Paper>
    )
  }

  return (
    <Paper
      elevation={0}
      sx={{
        maxHeight: "calc(100vh - 200px)",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        border: "1px solid #eaeaea",
        borderRadius: "16px",
      }}
    >
      <Box sx={{ p: 2.5, borderBottom: "1px solid #f0f0f0" }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            fontSize: "18px",
            mb: 2,
            color: "#111",
          }}
        >
          Project Files
        </Typography>

        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search files..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{
            mb: 2,
            "& .MuiOutlinedInput-root": {
              borderRadius: "12px",
              backgroundColor: "#f9f9f9",
              transition: "all 0.2s ease",
              "& fieldset": {
                borderColor: "#e0e0e0",
              },
              "&:hover fieldset": {
                borderColor: "#bdbdbd",
              },
              "&.Mui-focused fieldset": {
                borderColor: "#1976d2",
              },
            },
            "& .MuiInputBase-input": {
              padding: "12px 14px",
              fontSize: "14px",
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "#666" }} />
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Chip 
            label={`${inchatFiles.length} files in chat`} 
            size="small"
            sx={{ 
              backgroundColor: inchatFiles.length > 0 ? alpha('#1976d2', 0.1) : '#f5f5f5',
              color: inchatFiles.length > 0 ? '#1976d2' : '#666',
              fontWeight: 500,
              borderRadius: '8px',
              '& .MuiChip-label': {
                px: 1
              }
            }}
          />
          <Typography
            variant="body2"
            sx={{
              color: "#666",
              fontSize: "13px",
            }}
          >
            {files.length} total files
          </Typography>
        </Box>
      </Box>

      <Box sx={{ overflow: "auto", flex: 1 }}>
        <List disablePadding>
          {filteredFiles.map((file) => {
            const isInChat = inchatFiles.includes(file)
            const fileExt = getFileExtension(file)

            return (
              <ListItem
                key={file}
                disablePadding
                sx={{
                  px: 2,
                  py: 0.75,
                  borderLeft: isInChat ? '3px solid #1976d2' : '3px solid transparent',
                  backgroundColor: isInChat ? alpha('#1976d2', 0.04) : 'transparent',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    backgroundColor: isInChat ? alpha('#1976d2', 0.08) : alpha('#000', 0.02),
                  },
                }}
                secondaryAction={
                  <Tooltip title={isInChat ? "Remove from chat" : "Add to chat"}>
                    <IconButton
                      edge="end"
                      size="small"
                      aria-label={isInChat ? "remove from chat" : "add to chat"}
                      onClick={() => handleToggleFile(file)}
                      sx={{
                        color: isInChat ? "#f44336" : "#1976d2",
                        width: 32,
                        height: 32,
                        "&:hover": {
                          backgroundColor: isInChat ? alpha("#f44336", 0.08) : alpha("#1976d2", 0.08),
                        },
                      }}
                    >
                      {isInChat ? <RemoveIcon fontSize="small" /> : <AddIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {getFileIcon(file)}
                </ListItemIcon>
                <ListItemText
                  primary={file}
                  secondary={fileExt.toUpperCase()}
                  primaryTypographyProps={{
                    sx: {
                      fontWeight: isInChat ? 600 : 400,
                      fontSize: "14px",
                      color: isInChat ? "#1976d2" : "#333",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }
                  }}
                  secondaryTypographyProps={{
                    sx: {
                      fontSize: "11px",
                      color: "#888",
                      textTransform: "uppercase",
                    }
                  }}
                />
              </ListItem>
            )
          })}

          {filteredFiles.length === 0 && (
            <ListItem sx={{ py: 4, justifyContent: "center" }}>
              <Box sx={{ textAlign: "center", py: 2 }}>
                <SearchIcon sx={{ fontSize: 40, color: "#ccc", mb: 1 }} />
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: "14px",
                    color: "#888",
                  }}
                >
                  No matching files found
                </Typography>
              </Box>
            </ListItem>
          )}
        </List>
      </Box>
    </Paper>
  )
}

export default FileManager
