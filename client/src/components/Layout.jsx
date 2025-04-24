"use client"

import { useState } from "react"
import { Box, Typography, Drawer, IconButton, AppBar, Toolbar, Divider, Button } from "@mui/material"
import MenuIcon from "@mui/icons-material/Menu"
import CloseIcon from "@mui/icons-material/Close"
import AutorenewIcon from "@mui/icons-material/Autorenew"
import WebIcon from "@mui/icons-material/Web"
import WifiIcon from "@mui/icons-material/Wifi"
import AnalyticsIcon from "@mui/icons-material/Analytics"
import OpenInNewIcon from "@mui/icons-material/OpenInNew"

import ChatInterface from "./ChatInterface"
import FileManager from "./FileManager"
import WebPageAdder from "./WebPageAdder"
import TestConnection from "./TestConnection"
import PRDAnalyzer from "./PRDAnalyzer"
import api from "../services/api"

const drawerWidth = 320

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showWebAdder, setShowWebAdder] = useState(false)
  const [showTestConnection, setShowTestConnection] = useState(false)
  const [showPRDAnalyzer, setShowPRDAnalyzer] = useState(false)

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to clear the chat history? This cannot be undone.")) {
      try {
        await api.clearHistory()
        // Force reload to refresh the UI
        window.location.reload()
      } catch (error) {
        console.error("Error clearing history:", error)
        alert("Failed to clear chat history. Please try again.")
      }
    }
  }

  const drawer = (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
       
        <IconButton onClick={handleDrawerToggle} sx={{ display: { sm: "none" } }}>
          <CloseIcon />
        </IconButton>
      </Box>

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

      <Button
        variant="outlined"
        fullWidth
        startIcon={<OpenInNewIcon />}
        onClick={() => window.open("http://localhost:8080", "_blank")}
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
        Show Preview
      </Button>

      {/**<Button
        variant="outlined"
        fullWidth
        startIcon={<WifiIcon />}
        onClick={() => setShowTestConnection(true)}
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
        Test Connection
      </Button>**/}

      {/**<Button
        variant="outlined"
        fullWidth
        startIcon={<AnalyticsIcon />}
        onClick={() => setShowPRDAnalyzer(true)}
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
        Analyze PRD
      </Button>**/}

      <Divider sx={{ my: 2 }} />

      <FileManager />
    </Box>
  )

  return (
    <Box
      sx={{
        display: "flex",
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          backgroundColor: "#fff",
          color: "#000",
          boxShadow: "none",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <Toolbar>
          <IconButton
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{
              fontWeight: 600,
              fontSize: "20px",
            }}
          >
            Newrev.io
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              borderRight: "1px solid #f0f0f0",
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              borderRight: "1px solid #f0f0f0",
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
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#fff",
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          <ChatInterface />
        </Box>
      </Box>

      {showWebAdder && <WebPageAdder open={showWebAdder} onClose={() => setShowWebAdder(false)} />}

      {showTestConnection && <TestConnection open={showTestConnection} onClose={() => setShowTestConnection(false)} />}

      {showPRDAnalyzer && <PRDAnalyzer open={showPRDAnalyzer} onClose={() => setShowPRDAnalyzer(false)} />}
    </Box>
  )
}

export default Layout
