import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Segment, Form, Button, Icon, Header, Label, Message, Container, Divider, Grid, Checkbox, Dropdown,
} from "semantic-ui-react";
import cookie from "react-cookies";
import _ from "lodash";

import { generateDashboard } from "../../../actions/project";
import { API_HOST } from "../../../config/settings";

/*
  The Form used to configure the ChartMogul template
*/
function ChartMogulTemplate(props) {
  const {
    teamId, projectId, addError, onComplete, connections, onBack,
  } = props;

  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState({});
  const [errors, setErrors] = useState({});
  const [testError, setTestError] = useState(false);
  const [configuration, setConfiguration] = useState(null);
  const [selectedCharts, setSelectedCharts] = useState([]);
  const [availableConnections, setAvailableConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [formVisible, setFormVisible] = useState(true);

  useEffect(() => {
    _getTemplateConfig();
  }, []);

  useEffect(() => {
    if (connections && connections.length > 0) {
      _getAvailableConnections();
    }
  }, [connections]);

  const _onGenerateDashboard = () => {
    setErrors({});

    if (formVisible && !connection.token) {
      setTimeout(() => {
        setErrors({ ...errors, token: "Please enter your ChartMogul account token" });
      }, 100);
      return;
    }

    if (formVisible && !connection.key) {
      setTimeout(() => {
        setErrors({ ...errors, key: "Please enter your ChartMogul account API key" });
      }, 100);
      return;
    }

    const data = { ...connection, team_id: teamId, charts: selectedCharts };

    if (!formVisible && selectedConnection) {
      data.connection_id = selectedConnection;
    }

    setLoading(true);
    setTestError(false);

    generateDashboard(projectId, data, "chartmogul")
      .then(() => {
        setTimeout(() => {
          onComplete();
        }, 2000);
      })
      .catch(() => {
        setTestError(true);
        setLoading(false);
      });
  };

  const _getAvailableConnections = () => {
    const foundConnections = [];
    connections.forEach((connection) => {
      if (connection.host === "https://api.chartmogul.com/v1" && connection.type === "api") {
        foundConnections.push({
          key: connection.id,
          value: connection.id,
          text: connection.name,
        });
      }
    });

    setAvailableConnections(foundConnections);

    if (!selectedConnection && foundConnections.length > 0) {
      setSelectedConnection(foundConnections[0].value);
      setFormVisible(false);
    }
  };

  const _getTemplateConfig = () => {
    const url = `${API_HOST}/team/${teamId}/template/community/chartmogul`;
    const method = "GET";
    const headers = new Headers({
      accept: "application/json",
      authorization: `Bearer ${cookie.load("brewToken")}`,
    });

    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) {
          return Promise.reject(response.status);
        }

        return response.json();
      })
      .then((config) => {
        setConfiguration(config);
        if (config.Charts && config.Charts.length > 0) {
          const charts = [];
          config.Charts.forEach((chart) => {
            charts.push(chart.tid);
          });

          setSelectedCharts(charts);
        }
      })
      .catch(() => {});
  };

  const _onChangeSelectedCharts = (tid) => {
    const newCharts = [].concat(selectedCharts) || [];
    const isSelected = _.indexOf(selectedCharts, tid);

    if (isSelected === -1) {
      newCharts.push(tid);
    } else {
      newCharts.splice(isSelected, 1);
    }

    setSelectedCharts(newCharts);
  };

  const _onSelectAll = () => {
    if (configuration && configuration.Charts) {
      const newSelectedCharts = [];
      configuration.Charts.forEach((chart) => {
        newSelectedCharts.push(chart.tid);
      });
      setSelectedCharts(newSelectedCharts);
    }
  };

  const _onDeselectAll = () => {
    setSelectedCharts([]);
  };

  return (
    <div style={styles.container}>
      <Segment style={styles.mainSegment}>
        <Header as="h3" style={{ marginBottom: 20 }}>
          Configure the template
        </Header>

        <div style={styles.formStyle}>
          {availableConnections && availableConnections.length > 0 && (
            <>
              <Header size="small">
                {"Select an existing connection"}
              </Header>
              <Dropdown
                options={availableConnections}
                value={selectedConnection || ""}
                placeholder="Click to select a connection"
                onChange={(e, data) => setSelectedConnection(data.value)}
                selection
                style={{ marginRight: 20 }}
                disabled={formVisible}
              />

              {!formVisible && (
                <Button
                  primary
                  className="tertiary"
                  icon="plus"
                  content="Or create a new one"
                  onClick={() => setFormVisible(true)}
                />
              )}

              {formVisible && (
                <Button
                  primary
                  className="tertiary"
                  icon="arrow left"
                  content="Use an existing connection instead"
                  onClick={() => setFormVisible(false)}
                />
              )}
            </>
          )}

          {formVisible && (
            <>
              {availableConnections && availableConnections.length > 0 && <Divider />}
              <Form>
                <Form.Field error={!!errors.token} required>
                  <label>Enter your ChartMogul account token</label>
                  <Form.Input
                    value={connection.token || ""}
                    onChange={(e, data) => {
                      setConnection({ ...connection, token: data.value });
                    }}
                    placeholder="487cd43d3656609a32e92d1e7d17cd25"
                  />
                  {errors.token
                    && (
                      <Label basic color="red" pointing>
                        {errors.token}
                      </Label>
                    )}
                </Form.Field>

                <Form.Field error={!!errors.key} required>
                  <label>
                    {"Enter your ChartMogul secret key "}
                  </label>
                  <Form.Input
                    value={connection.key || ""}
                    onChange={(e, data) => {
                      setConnection({ ...connection, key: data.value });
                    }}
                    placeholder="de2bf2bc6de5266d11ea6b918b674780"
                  />
                  {errors.key
                    && (
                      <Label basic color="red" pointing>
                        {errors.key}
                      </Label>
                    )}
                </Form.Field>

                <Form.Field>
                  <Message compact>
                    <p>
                      {"You can get your account token and API key "}
                      <a href="https://app.chartmogul.com/#/admin/api" target="_blank" rel="noreferrer">
                        {"from your ChartMogul dashboard. "}
                        <Icon name="external" />
                      </a>
                    </p>
                  </Message>
                </Form.Field>
              </Form>
            </>
          )}

          {configuration && (
            <>
              <Divider hidden />
              <Header size="small">{"Select which charts you want Chartbrew to create for you"}</Header>
              <Grid columns={2} stackable>
                {configuration.Charts && configuration.Charts.map((chart) => (
                  <Grid.Column key={chart.tid}>
                    <Checkbox
                      label={chart.name}
                      checked={
                        _.indexOf(selectedCharts, chart.tid) > -1
                      }
                      onClick={() => _onChangeSelectedCharts(chart.tid)}
                    />
                  </Grid.Column>
                ))}
              </Grid>

              <Divider hidden />
              <Button
                icon="check"
                content="Select all"
                basic
                onClick={_onSelectAll}
                size="small"
              />
              <Button
                icon="x"
                content="Deselect all"
                basic
                onClick={_onDeselectAll}
                size="small"
              />
            </>
          )}
        </div>

        {addError
          && (
            <Message negative>
              <Message.Header>{"Server error while trying to save your connection"}</Message.Header>
              <p>Please try adding your connection again.</p>
            </Message>
          )}
        {testError && (
          <Container>
            <Message negative>
              <Message.Header>{"Cannot make the connection"}</Message.Header>
              <div>
                <p>{"Please make sure you copied the right token and API key from your ChartMogul dashboard."}</p>
                <p>
                  <a href="https://app.chartmogul.com/#/admin/api" target="_blank" rel="noreferrer">
                    {"Click here to go to the dashboard "}
                    <Icon name="external" />
                  </a>
                </p>
              </div>
            </Message>
          </Container>
        )}

        <Divider hidden />
        <Container fluid textAlign="right">
          {onBack && (
            <Button
              basic
              icon="chevron left"
              content="Go back"
              onClick={onBack}
            />
          )}
          <Button
            primary
            loading={loading}
            onClick={_onGenerateDashboard}
            icon
            labelPosition="right"
            style={styles.saveBtn}
            disabled={(
              (!connection.token || !connection.key) && formVisible)
              || selectedCharts.length === 0}
          >
            <Icon name="magic" />
            Create the charts
          </Button>
        </Container>
      </Segment>
    </div>
  );
}
const styles = {
  container: {
    flex: 1,
  },
  mainSegment: {
    padding: 20,
  },
  formStyle: {
    marginTop: 20,
    marginBottom: 20,
  },
  saveBtn: {
    marginRight: 0,
  },
};

ChartMogulTemplate.defaultProps = {
  addError: null,
  onBack: null,
};

ChartMogulTemplate.propTypes = {
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired,
  connections: PropTypes.array.isRequired,
  addError: PropTypes.bool,
  onBack: PropTypes.func,
};

export default ChartMogulTemplate;
