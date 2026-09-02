import React from 'react';
import { debug } from '@/lib/debug';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface DashboardErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  componentName: string;
}

interface DashboardErrorBoundaryProps {
  children: React.ReactNode;
  componentName: string;
}

export class DashboardErrorBoundary extends React.Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  constructor(props: DashboardErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, componentName: props.componentName };
  }

  static getDerivedStateFromError(error: Error): Partial<DashboardErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    debug.error(`Dashboard component ${this.state.componentName} crashed:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Erreur dans {this.state.componentName}</span>
            </div>
            <p className="text-sm text-red-500 mt-1">
              {this.state.error?.message || 'Composant indisponible'}
            </p>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}