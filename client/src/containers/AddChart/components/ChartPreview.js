import React, { Component } from "react";
import PropTypes from "prop-types";
import {
  Container, Button, Icon, Header,
} from "semantic-ui-react";
import { Line } from "react-chartjs-2";

class ChartPreview extends Component {
  render() {
    const { chart } = this.props;
    return (
      <>
        {chart && (
        <Container>
          <Line
            data={chart.chartData.data}
            options={chart.chartData.options}
            height={300}
          />
        </Container>
        )}

        {!chart && (
          <Container text textAlign="center">
            <Header icon>
              <Icon name="chart line" />
              Create a connection and start visualising your data
            </Header>
          </Container>
        )}

        <Container text textAlign="center" style={styles.topBuffer}>
          <Button icon labelPosition="right">
            <Icon name="refresh" />
            Refresh chart
          </Button>
          <Button icon labelPosition="right">
            <Icon name="angle double down" />
            Refresh Data
          </Button>
        </Container>
      </>
    );
  }
}

ChartPreview.propTypes = {
  chart: PropTypes.object.isRequired,
};

const styles = {
  topBuffer: {
    marginTop: 20,
  },
};

export default ChartPreview;
