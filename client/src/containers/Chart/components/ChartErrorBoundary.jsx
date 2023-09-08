import React from "react";

import Text from "../../../components/Text";

export default class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  render() {
    const { hasError } = this.state;
    const { children } = this.props; // eslint-disable-line
    if (hasError) {
      // You can render any custom fallback UI
      return <Text>Something went wrong. Please refresh the data in the chart.</Text>;
    }

    return children;
  }
}
