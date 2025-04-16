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
} from "@mui/material"
import SearchIcon from "@mui/icons-material/Search"
import AddIcon from "@mui/icons-material/Add"
import RemoveIcon from "@mui/icons-material/Remove"
import api from "../services/api"

const FileManager = () => {
  const [files, setFiles] = useState([])
  const [inchatFiles, setInchatFiles] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

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

  const filteredFiles = files.filter((file) => file.toLowerCase().includes(searchTerm.toLowerCase()))

  if (isLoading && files.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "200px" }}>
        <CircularProgress sx={{ color: "#000" }} />
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
      sx={{
        maxHeight: "400px",
        overflow: "auto",
        boxShadow: "none",
        border: "1px solid #f0f0f0",
        borderRadius: "12px",
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography
          variant="h6"
          gutterBottom
          sx={{
            fontWeight: 600,
            fontSize: "16px",
          }}
        >
          Repository Files
        </Typography>

        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search files..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          margin="normal"
          size="small"
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: "20px",
              backgroundColor: "#f5f5f5",
              "& fieldset": {
                border: "none",
              },
              "&:hover fieldset": {
                border: "none",
              },
              "&.Mui-focused fieldset": {
                border: "none",
              },
            },
            "& .MuiInputBase-input": {
              padding: "10px 14px",
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

        <Typography
          variant="body2"
          sx={{
            mt: 1,
            color: "#666",
            fontSize: "13px",
          }}
        >
          {inchatFiles.length} of {files.length} files in chat
        </Typography>
      </Box>

      <Divider sx={{ borderColor: "#f0f0f0" }} />

      <List dense>
        {filteredFiles.map((file) => {
          const isInChat = inchatFiles.includes(file)

          return (
            <ListItem
              key={file}
              secondaryAction={
                <IconButton
                  edge="end"
                  aria-label={isInChat ? "remove from chat" : "add to chat"}
                  onClick={() => handleToggleFile(file)}
                  sx={{
                    color: isInChat ? "#f44336" : "#000",
                    "&:hover": {
                      backgroundColor: isInChat ? "rgba(244, 67, 54, 0.04)" : "rgba(0, 0, 0, 0.04)",
                    },
                  }}
                >
                  {isInChat ? <RemoveIcon /> : <AddIcon />}
                </IconButton>
              }
            >
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={isInChat}
                  onChange={() => handleToggleFile(file)}
                  disableRipple
                  sx={{
                    color: "#000",
                    "&.Mui-checked": {
                      color: "#000",
                    },
                  }}
                />
              </ListItemIcon>
              <ListItemText
                primary={file}
                primaryTypographyProps={{
                  style: {
                    fontWeight: isInChat ? 600 : 400,
                    fontSize: "14px",
                    color: isInChat ? "#000" : "#333",
                  },
                }}
              />
            </ListItem>
          )
        })}

        {filteredFiles.length === 0 && (
          <ListItem>
            <ListItemText
              primary="No matching files found"
              primaryTypographyProps={{
                style: {
                  fontSize: "14px",
                  color: "#666",
                  fontStyle: "italic",
                },
              }}
            />
          </ListItem>
        )}
      </List>
    </Paper>
  )
}

export default FileManager
