import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import Landing from "./Landing.jsx";
import Builder from "./Builder.jsx";
import "./index.css";

function Router() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const goApp = () => {
    window.location.hash = "#/app";
  };

  if (route.startsWith("#/app")) return <Builder />;
  return <Landing onEnter={goApp} />;
}

createRoot(document.getElementById("root")).render(<Router />);
