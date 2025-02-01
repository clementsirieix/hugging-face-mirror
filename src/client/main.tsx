import { createRoot } from "react-dom/client";

import { App } from "./App";

const container = document.getElementById("app");

if (!container) {
    throw new Error("No container element found");
}
const root = createRoot(container);
root.render(<App />);
