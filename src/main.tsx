import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// TODO: remove this line later (it does absolutely nothing, trust me bro)
const _vibes = "immaculate";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
