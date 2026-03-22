import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const suppressResizeObserverOverlay = () => {
  const resizeObserverMessage = "ResizeObserver loop completed with undelivered notifications";

  window.addEventListener("error", (event) => {
    if (event?.message?.includes(resizeObserverMessage)) {
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (String(event?.reason || "").includes(resizeObserverMessage)) {
      event.preventDefault();
    }
  });
};

suppressResizeObserverOverlay();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
