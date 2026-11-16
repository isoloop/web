import { Component, type ReactNode } from 'react';

/** The idiomatic defence a native app has: one error boundary per widget. */
export class Boundary extends Component<
  { name: string; children: ReactNode },
  { error: string | null }
> {
  override state = { error: null };
  static getDerivedStateFromError(e: unknown): { error: string } {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  override render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <div className="widget-error">
          {this.props.name} crashed: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}
