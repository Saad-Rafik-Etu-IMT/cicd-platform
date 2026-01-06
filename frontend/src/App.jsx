import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import PipelineDetail from './pages/PipelineDetail'
import EnvVariables from './pages/EnvVariables'
import Users from './pages/Users'
import SonarDashboard from './pages/SonarDashboard'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Layout from './components/Layout'
import { ToastProvider, useToast } from './components/Toast'
import { socket } from './services/api'

function AppContent() {
  const { addToast } = useToast()

  useEffect(() => {
    // Listen to pipeline events
    socket.on('pipeline:started', (data) => {
      addToast(`Pipeline #${data.id} démarré`, 'info', 3000)
    })

    socket.on('pipeline:completed', (data) => {
      addToast(`Pipeline #${data.id} terminé avec succès`, 'success', 5000)
    })

    socket.on('pipeline:failed', (data) => {
      addToast(`Pipeline #${data.id} a échoué`, 'error', 6000)
    })

    socket.on('pipeline:log', (data) => {
      // Silent, just for real-time log updates
      console.log('Pipeline log:', data)
    })

    return () => {
      socket.off('pipeline:started')
      socket.off('pipeline:completed')
      socket.off('pipeline:failed')
      socket.off('pipeline:log')
    }
  }, [addToast])

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          
          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="/pipeline/:id" element={<PipelineDetail />} />
            <Route path="/env" element={
              <ProtectedRoute requiredPermission="manage_env">
                <EnvVariables />
              </ProtectedRoute>
            } />
            <Route path="/sonar" element={<SonarDashboard />} />
            <Route path="/users" element={
              <ProtectedRoute requiredPermission="manage_users">
                <Users />
              </ProtectedRoute>
            } />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

export default App
