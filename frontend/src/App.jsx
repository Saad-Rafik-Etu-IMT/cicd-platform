import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import PipelineDetail from './pages/PipelineDetail'
import EnvVariables from './pages/EnvVariables'
import Layout from './components/Layout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="/pipeline/:id" element={<PipelineDetail />} />
          <Route path="/env" element={<EnvVariables />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
