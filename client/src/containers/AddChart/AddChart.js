import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Button, Icon, Header, Divider, Popup, Container,
  Form, Input
} from "semantic-ui-react";

import ChartPreview from "./components/ChartPreview";
import ChartSettings from "./components/ChartSettings";
import Connection from "./components/Connection";

/*
  Container used for setting up a new chart
*/
class AddChart extends Component {
  constructor(props) {
    super(props);

    this.state = {
      connectionActive: false,
      newChart: {
        name: "Untitled chart"
      },
    };
  }

  _onConnectionClicked = () => {
    this.setState({ connectionActive: true });
  }

  _onConnectionClosed = () => {
    this.setState({ connectionActive: false });
  }

  _onNameChange = (value) => {
    const { newChart } = this.state;
    this.setState({ newChart: { ...newChart, name: value } });
  }

  render() {
    const { chart } = this.props;
    const { connectionActive, editingTitle, newChart } = this.state;

    return (
      <div style={styles.container}>
        <Grid columns={2} divided centered>
          <Grid.Column width={9}>
            <Grid.Row>
              {!editingTitle
                && (
                  <Header textAlign="left" dividing onClick={() => this.setState({ editingTitle: true })}>
                    <Popup
                      trigger={(
                        <a style={styles.editTitle}>
                          {newChart.name}
                        </a>
                      )}
                      content="Edit the chart name"
                    />
                  </Header>
                )}

              {editingTitle
                && (
                  <Container fluid textAlign="left">
                    <Form style={{ display: "inline-block" }}>
                      <Form.Group>
                        <Form.Field>
                          <Input
                            placeholder="Enter a title"
                            value={newChart.name}
                            onChange={(e, data) => this._onNameChange(data.value)}
                          />
                        </Form.Field>
                        <Form.Field>
                          <Button
                            secondary
                            icon
                            labelPosition="right"
                            type="submit"
                            onClick={() => this.setState({ editingTitle: false })}
                          >
                            <Icon name="checkmark" />
                            Save
                          </Button>
                        </Form.Field>
                      </Form.Group>
                    </Form>
                  </Container>
                )}
              <ChartPreview chart={chart} />
            </Grid.Row>
            <Grid.Row style={styles.topBuffer}>
              <ChartSettings />
            </Grid.Row>
          </Grid.Column>

          <Grid.Column width={6}>
            <Header>Connections</Header>
            <Divider />
            <Button
              primary
              icon
              labelPosition="right"
              onClick={this._onConnectionClicked}
            >
              <Icon name="plug" />
              ConnectionAPI
            </Button>
            <Button basic icon labelPosition="right">
              <Icon name="plus" />
              New connection
            </Button>

            <Connection
              active={connectionActive}
              onCloseConnection={this._onConnectionClosed}
            />
          </Grid.Column>
        </Grid>
      </div>
    );
  }
}

const styles = {
  container: {
    flex: 1,
    paddingTop: 20,
    backgroundColor: "white",
  },
  mainContent: {
    paddingLeft: 20,
    paddingRight: 20,
  },
  mainSegment: {
    minHeight: 600,
  },
  topBuffer: {
    marginTop: 20,
  },
};

AddChart.propTypes = {
  chart: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    chart: state.chart.data[0],
  };
};

const mapDispatchToProps = () => {
  return {
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(AddChart));
