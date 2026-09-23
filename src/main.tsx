
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { readStoredTheme, readStoredMode } from './context/ThemeContext'

// Set before first paint so the stored theme/mode never flash the defaults first.
document.documentElement.setAttribute("data-theme", readStoredTheme());
document.documentElement.classList.toggle("dark", readStoredMode() === "dark");

createRoot(document.getElementById("root")!).render(<App />);
