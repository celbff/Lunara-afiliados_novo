import { AuthProvider } from './components/auth/AuthProvider'
import LoginPage from './components/LoginPage'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  )
}

export default App