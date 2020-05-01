import React, { useState, useEffect } from "react";
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
import ChartDescription from "./components/ChartDescription";

import {
  createChart as createChartAction,
} from "../../actions/chart";

/*
  Container used for setting up a new chart
*/
function AddChart(props) {
  const [connectionActive, setConnectionActive] = useState(false);
  const [titleScreen, setTitleScreen] = useState(true);
  const [newChart, setNewChart] = useState({ name: "Test chart" });
  const [editingTitle, setEditingTitle] = useState(false);

  const {
    match, createChart, history, charts,
  } = props;

  useEffect(() => {
    if (match.params.chartId) {
      charts.map((chart) => {
        if (chart.id === parseInt(match.params.chartId, 10)) {
          setNewChart(chart);
        }
        return chart;
      });
      setTitleScreen(false);
    }
  }, []);

  const _onConnectionClicked = () => {
    setConnectionActive(true);
  };

  const _onConnectionClosed = () => {
    setConnectionActive(false);
  };

  const _onNameChange = (value) => {
    setNewChart({ ...newChart, name: value });
  };

  const _onCreateClicked = () => {
    return createChart(match.params.projectId, newChart)
      .then((createdChart) => {
        setTitleScreen(false);
        history.push(`chart/${createdChart.id}/edit`);
      })
      .catch(() => {
      });
  };

  if (titleScreen) {
    return (
      <ChartDescription
        name={newChart.name}
        onChange={_onNameChange}
        onCreate={_onCreateClicked}
        history={history}
      />
    );
  }

  return (
    <div style={styles.container}>
      <Grid columns={2} divided centered>
        <Grid.Column width={9}>
          <Grid.Row>
            {!editingTitle
              && (
                <Header textAlign="left" dividing onClick={() => setEditingTitle(true)}>
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
                          onChange={(e, data) => _onNameChange(data.value)}
                        />
                      </Form.Field>
                      <Form.Field>
                        <Button
                          secondary
                          icon
                          labelPosition="right"
                          type="submit"
                          onClick={() => setEditingTitle(false)}
                        >
                          <Icon name="checkmark" />
                          Save
                        </Button>
                      </Form.Field>
                    </Form.Group>
                  </Form>
                </Container>
              )}
            <ChartPreview />
          </Grid.Row>
          <Grid.Row style={styles.topBuffer}>
            <ChartSettings />
          </Grid.Row>
        </Grid.Column>

        <Grid.Column width={6}>
          <Header>Datasets</Header>
          <Divider />
          <Button
            primary
            icon
            labelPosition="right"
            onClick={_onConnectionClicked}
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
            onCloseConnection={_onConnectionClosed}
          />
        </Grid.Column>
      </Grid>
    </div>
  );
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
  createChart: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
  charts: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => {
  return {
    charts: state.chart.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    createChart: (projectId, data) => dispatch(createChartAction(projectId, data)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(AddChart));
