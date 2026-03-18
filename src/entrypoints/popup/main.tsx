import { render } from "preact";
import { App } from "../../components/App";
import { ErrorBoundary } from "../../components/ui/ErrorBoundary";
import "../../assets/tailwind.css";

render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
  document.getElementById("app")!
);
