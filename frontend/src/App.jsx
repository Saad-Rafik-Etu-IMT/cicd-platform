import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import PipelineDetail from './pages/PipelineDetail'
import Layout from './components/Layout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="/pipeline/:id" element={<PipelineDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
