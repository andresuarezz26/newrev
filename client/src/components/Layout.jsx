"use client"

import { useState } from "react"
import { Box, Typography, Drawer, IconButton, AppBar, Toolbar, Divider, Button } from "@mui/material"
import OpenInNewIcon from "@mui/icons-material/OpenInNew"
import AutorenewIcon from "@mui/icons-material/Autorenew"
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import WebIcon from "@mui/icons-material/Web"
import CloseIcon from "@mui/icons-material/Close"

import ChatInterface from "./ChatInterface"
import FileManager from "./FileManager"
import WebPageAdder from "./WebPageAdder"
import api from "../services/api"

const drawerWidth = 320
const iframeWidth = 800

const Layout = () => {
  const [showWebAdder, setShowWebAdder] = useState(false)
  const [showPreview, setShowPreview] = useState(true)

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to clear the chat history? This cannot be undone.")) {
      try {
        await api.clearHistory()
        window.location.reload()
      } catch (error) {
        console.error("Error clearing history:", error)
        alert("Failed to clear chat history. Please try again.")
      }
    }
  }

  const togglePreview = () => {
    setShowPreview(!showPreview)
  }

  const drawer = (
    <Box sx={{ p: 2 }}>
      <Divider sx={{ mb: 2 }} />

      <Button
        variant="outlined"
        fullWidth
        startIcon={<WebIcon />}
        onClick={() => setShowWebAdder(true)}
        sx={{
          mb: 2,
          borderRadius: "20px",
          textTransform: "none",
          borderColor: "#000",
          color: "#000",
          "&:hover": {
            borderColor: "#333",
            backgroundColor: "rgba(0, 0, 0, 0.04)",
          },
        }}
      >
        Add Web Page
      </Button>

      <Button
        variant="outlined"
        fullWidth
        startIcon={<AutorenewIcon />}
        onClick={handleClearHistory}
        sx={{
          mb: 2,
          borderRadius: "20px",
          textTransform: "none",
          borderColor: "#f44336",
          color: "#f44336",
          "&:hover": {
            borderColor: "#d32f2f",
            backgroundColor: "rgba(244, 67, 54, 0.04)",
          },
        }}
      >
        Clear Chat History
      </Button>

      <Divider sx={{ my: 2 }} />
      <FileManager />
    </Box>
  )

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <AppBar
        position="static"
        sx={{
          backgroundColor: "#fff",
          color: "#000",
          boxShadow: "none",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600, fontSize: "20px" }}>
            Newrev.io
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            onClick={() => window.open("http://localhost:8080", "_blank")}
            sx={{
              mr: 1,
              textTransform: "none",
              borderColor: "#000",
              color: "#000",
              height: "36px",
              "&:hover": {
                borderColor: "#333",
                backgroundColor: "rgba(0, 0, 0, 0.04)",
              },
            }}
          >
            Open Preview
          </Button>
          <IconButton 
            onClick={togglePreview} 
            sx={{ 
              ml: 1, 
              backgroundColor: showPreview ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.08)'
              }
            }}
          >
            {showPreview ? <CloseIcon /> : <AspectRatioIcon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Box component="nav" sx={{ width: drawerWidth, flexShrink: 0 }}>
          <Drawer
            variant="permanent"
            sx={{
              "& .MuiDrawer-paper": {
                boxSizing: "border-box",
                width: drawerWidth,
                borderRight: "1px solid #f0f0f0",
                height: "100%",
                position: "relative",
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: showPreview ? `calc(100% - ${drawerWidth}px - ${iframeWidth}px)` : `calc(100% - ${drawerWidth}px)`,
            height: "100%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#fff",
          }}
        >
          <Box sx={{ flex: 1, overflow: "hidden" }}>
            <ChatInterface />
          </Box>
        </Box>

        {/* Right-side iframe preview */}
        {showPreview && (
          <Box
            sx={{
              width: `${iframeWidth}px`,
              borderLeft: "1px solid #f0f0f0",
              height: "100%",
              position: "relative",
              zIndex: 1,
            }}
          >
            <iframe
              src="http://localhost:8080"
              style={{ width: "100%", height: "100%", border: "none" }}
              title="Live Preview"
            />
          </Box>
        )}
      </Box>

      {showWebAdder && <WebPageAdder open={showWebAdder} onClose={() => setShowWebAdder(false)} />}
    </Box>
  )
}

export default Layout