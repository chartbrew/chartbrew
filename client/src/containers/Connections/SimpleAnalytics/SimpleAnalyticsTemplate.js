import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Segment, Form, Button, Icon, Header, Label, Message,
  Container, Divider, List, Grid, Checkbox, Dropdown,
} from "semantic-ui-react";
import _ from "lodash";
import cookie from "react-cookies";

import { generateDashboard } from "../../../actions/project";
import { API_HOST } from "../../../config/settings";

/*
  The Form used to configure the SimpleAnalytics template
*/
function SimpleAnalyticsTemplate(props) {
  const {
    teamId, projectId, addError, onComplete, connections, onBack,
  } = props;

  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState({});
  const [errors, setErrors] = useState({});
  const [notPublic, setNotPublic] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [configuration, setConfiguration] = useState(null);
  const [selectedCharts, setSelectedCharts] = useState(false);
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

    if (formVisible && !connection.website) {
      setTimeout(() => {
        setErrors({ ...errors, website: "Please enter your website" });
      }, 100);
      return;
    }

    const data = { ...connection, team_id: teamId, charts: selectedCharts };
    if (!formVisible && selectedConnection) {
      data.connection_id = selectedConnection;
    }

    setLoading(true);
    setNotPublic(false);
    setNotFound(false);

    generateDashboard(projectId, data, "simpleanalytics")
      .then(() => {
        setTimeout(() => {
          onComplete();
        }, 2000);
      })
      .catch((err) => {
        if (err && err.message === "403") setNotPublic(true);
        if (err && err.message === "404") setNotFound(true);
        setLoading(false);
      });
  };

  const _getAvailableConnections = () => {
    const foundConnections = [];
    connections.forEach((connection) => {
      if (connection.host === "https://simpleanalytics.com" && connection.type === "api") {
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
    const url = `${API_HOST}/team/${teamId}/template/community/simpleanalytics`;
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
      .catch(() => { });
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
              <Form>
                <Form.Group widths={2}>
                  <Form.Field disabled={formVisible}>
                    <label>{"Select an existing connection"}</label>
                    <Dropdown
                      options={availableConnections}
                      value={selectedConnection || ""}
                      placeholder="Click to select a connection"
                      onChange={(e, data) => setSelectedConnection(data.value)}
                      selection
                      style={{ marginRight: 20 }}
                    />
                  </Form.Field>
                  <Form.Field error={!!errors.name} required disabled={formVisible}>
                    <label>Enter your Simple Analytics website</label>
                    <Form.Input
                      placeholder="chartbrew.com"
                      value={(!formVisible && connection.website) || ""}
                      onChange={(e, data) => {
                        setConnection({ ...connection, website: data.value });
                      }}
                    />
                    {errors.website
                      && (
                        <Label basic color="red" pointing>
                          {errors.website}
                        </Label>
                      )}
                  </Form.Field>
                </Form.Group>
                <Form.Field>
                  {!formVisible && (
                    <Button
                      primary
                      className="tertiary"
                      icon="plus"
                      content="Or create a new connection"
                      onClick={() => setFormVisible(true)}
                    />
                  )}
                  {formVisible && (
                    <>
                      <Button
                        primary
                        className="tertiary"
                        content="Use an existing connection instead"
                        onClick={() => setFormVisible(false)}
                      />
                    </>
                  )}
                </Form.Field>
              </Form>
            </>
          )}
          {formVisible && (
            <>
              {availableConnections && availableConnections.length > 0 && <Divider />}
              <Form>
                <Form.Field error={!!errors.website} required>
                  <label>Enter your Simple Analytics website</label>
                  <Form.Input
                    placeholder="chartbrew.com"
                    value={connection.website || ""}
                    onChange={(e, data) => {
                      setConnection({ ...connection, website: data.value });
                    }}
                  />
                  {errors.website
                    && (
                      <Label basic color="red" pointing>
                        {errors.website}
                      </Label>
                    )}
                </Form.Field>

                <Form.Field>
                  <label>
                    {"Enter your Simple Analytics API key (if the website is private). "}
                    <a href="https://simpleanalytics.com/account#api" target="_blank" rel="noreferrer">
                      {"Get your API key here "}
                      <Icon name="external" />
                    </a>
                  </label>
                  <Form.Input
                    placeholder="sa_api_key_*"
                    value={connection.apiKey || ""}
                    onChange={(e, data) => {
                      setConnection({ ...connection, apiKey: data.value });
                    }}
                  />
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

        {notPublic && (
          <Container>
            <Message negative>
              <Message.Header>{"Your site appears to be set to private"}</Message.Header>
              <div>
                <p>{"In order to be able to get the stats from Simple Analytics, please do one of the following:"}</p>
                <List bulleted>
                  <List.Item>
                    {"Enter your Simple Analytics API key in the field above. "}
                    <a href="https://simpleanalytics.com/account#api" target="_blank" rel="noreferrer">
                      {"Click here to find your API key. "}
                      <Icon name="external" />
                    </a>
                  </List.Item>
                  <List.Item>
                    {"Alternatively, "}
                    <a href={`https://simpleanalytics.com/${connection.website}/settings#visibility`} target="_blank" rel="noreferrer">
                      {"make your site stats public here. "}
                      <Icon name="external" />
                    </a>
                  </List.Item>
                </List>
              </div>
            </Message>
          </Container>
        )}

        {notFound && (
          <Container>
            <Message negative>
              <Message.Header>{"Your site could not be found"}</Message.Header>
              <div>
                <p>{"Make sure your website is spelt correctly and that it is registered with Simple Analytics."}</p>
                <p>
                  {"You can check if it exists here: "}
                  <a href={`https://simpleanalytics.com/${connection.website}`} target="_blank" rel="noreferrer">
                    {`https://simpleanalytics.com/${connection.website} `}
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
            disabled={
              (!formVisible && !selectedConnection)
              || !connection.website
              || (!selectedCharts || selectedCharts.length < 1)
            }
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

SimpleAnalyticsTemplate.defaultProps = {
  addError: null,
  onBack: null,
};

SimpleAnalyticsTemplate.propTypes = {
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired,
  connections: PropTypes.array.isRequired,
  addError: PropTypes.bool,
  onBack: PropTypes.func,
};

export default SimpleAnalyticsTemplate;
