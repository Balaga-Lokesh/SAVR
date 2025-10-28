import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from './components/ThemeProvider'
import { BrowserRouter } from 'react-router-dom'

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="system" storageKey="savr-theme">
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ThemeProvider>
);
