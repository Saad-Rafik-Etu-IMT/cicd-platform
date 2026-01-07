import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Icons } from './Icons'
import './Layout.css'

export default function Layout() {
  const { user, logout, hasPermission } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login?logged_out=true')
  }

  return (
    <div className="layout">
      <header className="header">
        <div className="header-content">
          <Link to="/" className="logo">
            <span className="logo-icon">{Icons.deploy}</span>
            <span className="logo-text">CI/CD Platform</span>
          </Link>
          <nav className="nav">
            <Link to="/">Dashboard</Link>
            <Link to="/sonar"><span className="nav-icon">{Icons.chart}</span>SonarQube</Link>
            <Link to="/security"><span className="nav-icon">{Icons.shield}</span>Sécurité</Link>
            {hasPermission('manage_env') && (
              <Link to="/env" className="nav-link-icon"><span className="nav-icon">{Icons.key}</span>Variables</Link>
            )}
            {hasPermission('manage_users') && (
              <Link to="/users"><span className="nav-icon">{Icons.users}</span>Utilisateurs</Link>
            )}
          </nav>
          <div className="user-section">
            {user && (
              <>
                <div className="user-info">
                  {user.avatar_url && (
                    <img src={user.avatar_url} alt={user.username} className="user-avatar" />
                  )}
                  <span className="user-name">{user.username}</span>
                  <span className={`user-role role-${user.role}`}>{user.role}</span>
                </div>
                <button className="btn-logout" onClick={handleLogout}>
                  Déconnexion
                </button>
              </>
            )}
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
