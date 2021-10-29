import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Segment, Form, Button, Icon, Header, Label, Message,
  Container, Divider, Grid, Checkbox, Dropdown,
} from "semantic-ui-react";
import _ from "lodash";
import cookie from "react-cookies";

import { generateDashboard } from "../../../actions/project";
import { API_HOST } from "../../../config/settings";

/*
  The Form used to configure the Plausible template
*/
function PlausibleTemplate(props) {
  const {
    teamId, projectId, addError, onComplete, connections, onBack,
  } = props;

  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState({});
  const [errors, setErrors] = useState({});
  const [generationError, setGenerationError] = useState(false);
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

    if (formVisible && !connection.apiKey) {
      setTimeout(() => {
        setErrors({ ...errors, apiKey: "Please enter the API key" });
      }, 100);
      return;
    }

    const data = { ...connection, team_id: teamId, charts: selectedCharts };
    if (!formVisible && selectedConnection) {
      data.connection_id = selectedConnection;
    }

    setLoading(true);
    setGenerationError(false);

    generateDashboard(projectId, data, "plausible")
      .then(() => {
        setTimeout(() => {
          onComplete();
        }, 2000);
      })
      .catch(() => {
        setGenerationError(true);
        setLoading(false);
      });
  };

  const _getAvailableConnections = () => {
    const foundConnections = [];
    connections.forEach((connection) => {
      if (connection.host && connection.host.indexOf("https://plausible.io") > -1 && connection.type === "api") {
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
    const url = `${API_HOST}/team/${teamId}/template/community/plausible`;
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
                  <Form.Field error={!!errors.website} required disabled={formVisible}>
                    <label>Enter your Plausible site ID</label>
                    <Form.Input
                      placeholder="example.com"
                      value={(!formVisible && connection.website) || ""}
                      onChange={(e, data) => {
                        if (data.value && (data.value.indexOf("http://") > -1 || data.value.indexOf("https://") > -1)) {
                          setErrors({ ...errors, website: "Http:// and https:// are not needed." });
                          return;
                        } else {
                          setErrors({ ...errors, website: "" });
                        }
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
                  <label>Enter your Plausible site ID</label>
                  <Form.Input
                    placeholder="example.com"
                    value={connection.website || ""}
                    onChange={(e, data) => {
                      if (data.value && (data.value.indexOf("http://") > -1 || data.value.indexOf("https://") > -1)) {
                        setErrors({ ...errors, website: "Http:// and https:// are not needed." });
                        return;
                      } else {
                        setErrors({ ...errors, website: "" });
                      }
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
                    {"Enter your Plausible API key. "}
                    <a href="https://plausible.io/settings#api-keys" target="_blank" rel="noreferrer">
                      {"Get your API key here "}
                      <Icon name="external" />
                    </a>
                  </label>
                  <Form.Input
                    placeholder="JtwBmY**************************"
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

        {generationError && (
          <Container>
            <Message negative>
              <Message.Header>{"Invalid site ID or API Key"}</Message.Header>
              <div>
                <p>{"Make sure your site ID is spelt correctly and you used the correct API Key"}</p>
                <p>
                  {"You can log in and check if your site ID exists here: "}
                  <a href={`https://plausible.io/${connection.website}`} target="_blank" rel="noreferrer">
                    {`https://plausible.io/${connection.website} `}
                    <Icon name="external" />
                  </a>
                </p>
                <p>
                  {"Then check if your API Key is correct or generate a new one here: "}
                  <a href="https://plausible.io/settings#api-keys" target="_blank" rel="noreferrer">
                    {"https://plausible.io/settings#api-keys"}
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

PlausibleTemplate.defaultProps = {
  addError: null,
  onBack: null,
};

PlausibleTemplate.propTypes = {
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired,
  connections: PropTypes.array.isRequired,
  addError: PropTypes.bool,
  onBack: PropTypes.func,
};

export default PlausibleTemplate;
