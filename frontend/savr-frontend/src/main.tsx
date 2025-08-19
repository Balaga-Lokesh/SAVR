import { createRoot } from 'react-dom/client'
import React from 'react'
import App from './App.tsx'
import './index.css'
import ThemeToggle from './components/ui/ThemeToggle'
import { createPortal } from 'react-dom'

// mount the app
const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(<App />);

// render the ThemeToggle into the portal root (component handles its own portal)
// ThemeToggle uses createPortal internally, so just import it; it will mount when React renders.
// To ensure it's mounted we can render a small invisible React tree into the root as well.
const portalHolder = document.createElement('div');
rootEl.appendChild(portalHolder);
createRoot(portalHolder).render(<ThemeToggle />);

// IntersectionObserver for progressive reveal of elements with .section-fade
if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
	const observer = new IntersectionObserver((entries) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) entry.target.classList.add('in-view');
			else entry.target.classList.remove('in-view');
		});
	}, { threshold: 0.12 });

	const els = document.querySelectorAll('.section-fade');
	els.forEach(el => observer.observe(el));
}
