import { Component, type ErrorInfo, type ReactNode } from "react";
import { FatalScreen } from "../ui/Feedback.tsx";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Falha de renderização no SAP", error, info.componentStack);
  }

  retry = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error)
      return (
        <FatalScreen
          message="Ocorreu um erro inesperado na interface. Seus dados não foram alterados."
          onRetry={this.retry}
        />
      );
    return this.props.children;
  }
}
