import { Outlet, Link } from 'react-router-dom'
import './Layout.css'

export default function Layout() {
  return (
    <div className="layout">
      <header className="header">
        <div className="header-content">
          <Link to="/" className="logo">
            <span className="logo-icon">🚀</span>
            <span className="logo-text">CI/CD Platform</span>
          </Link>
          <nav className="nav">
            <Link to="/">Dashboard</Link>
          </nav>
          <div className="header-status">
            <span className="status-dot"></span>
            <span>Connected</span>
          </div>
        </div>
      </header>
      
      <main className="main">
        <Outlet />
      </main>
      
      <footer className="footer">
        <p>BFB Management CI/CD Platform &copy; 2026</p>
      </footer>
    </div>
  )
}
