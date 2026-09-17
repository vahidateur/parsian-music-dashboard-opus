import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AccessGate } from "./security/AccessGate";

/*
  The access gate wraps the entire app, above every provider and route, so a
  visitor without the secret path never mounts auth, never touches storage and
  never sees a single branded pixel.
*/
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AccessGate>
      <App />
    </AccessGate>
  </StrictMode>
);
