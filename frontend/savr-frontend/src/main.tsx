import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "@/components/Themeprovider";

const rootEl = document.getElementById("root")!;
const root = createRoot(rootEl);

root.render(
  <BrowserRouter>
    <ThemeProvider defaultTheme="system" storageKey="savr-theme">
      <App />
    </ThemeProvider>
  </BrowserRouter>
);

// IntersectionObserver for progressive reveal
if (typeof window !== "undefined" && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("in-view");
        else entry.target.classList.remove("in-view");
      });
    },
    { threshold: 0.12 }
  );

  const els = document.querySelectorAll(".section-fade");
  els.forEach((el) => observer.observe(el));
}
