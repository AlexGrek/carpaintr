// ErrorBoundary.jsx
import React from 'react';
import ErrorMessage from './components/layout/ErrorMessage';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <ErrorMessage errorTitle='Critical failure' errorText={this.state.error.toString()}/>;
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
