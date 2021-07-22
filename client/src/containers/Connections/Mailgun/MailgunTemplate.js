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

const countryOptions = [{
  key: "eu", value: "eu", text: "Europe", flag: "eu"
}, {
  key: "us", value: "us", text: "US", flag: "us"
}];

/*
  The Form used to configure the Mailgun template
*/
function MailgunTemplate(props) {
  const {
    teamId, projectId, addError, onComplete, connections, onBack,
  } = props;

  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState({});
  const [errors, setErrors] = useState({});
  const [testError, setTestError] = useState(false);
  const [configuration, setConfiguration] = useState(null);
  const [selectedCharts, setSelectedCharts] = useState(false);
  const [availableConnections, setAvailableConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [formVisible, setFormVisible] = useState(true);

  useEffect(() => {
    _getTemplateConfig();
    setConnection({ ...connection, domainLocation: countryOptions[0].value });
  }, []);

  useEffect(() => {
    if (connections && connections.length > 0) {
      _getAvailableConnections();
    }
  }, [connections]);

  const _onGenerateDashboard = () => {
    setErrors({});

    if (formVisible && !connection.domain) {
      setTimeout(() => {
        setErrors({ ...errors, domain: "Please enter your website" });
      }, 100);
      return;
    }

    if (formVisible && !connection.domainLocation) {
      setTimeout(() => {
        setErrors({ ...errors, domainLocation: "Please select a domain location" });
      }, 100);
      return;
    }

    if (formVisible && !connection.apiKey) {
      setTimeout(() => {
        setErrors({ ...errors, apiKey: "Please enter your API Key" });
      }, 100);
      return;
    }

    const data = { ...connection, team_id: teamId, charts: selectedCharts };
    if (!formVisible && selectedConnection) {
      data.connection_id = selectedConnection;
    }

    setLoading(true);
    setTestError(false);

    generateDashboard(projectId, data, "mailgun")
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
      if (connection.host
        && (connection.host.indexOf("https://api.mailgun.net") > -1
        || connection.host.indexOf("https://api.eu.mailgun.net") > -1)
        && connection.type === "api"
      ) {
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
    const url = `${API_HOST}/team/${teamId}/template/community/mailgun`;
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
                  <Form.Field error={!!errors.domain} required disabled={formVisible}>
                    <label>Enter your Mailgun domain</label>
                    <Form.Input
                      placeholder="mg.example.com"
                      value={(!formVisible && connection.domain) || ""}
                      onChange={(e, data) => {
                        setConnection({ ...connection, domain: data.value });
                      }}
                    />
                    {errors.domain
                      && (
                        <Label basic color="red" pointing>
                          {errors.domain}
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
                <Form.Field>
                  <label>Select your Mailgun domain location</label>
                  <Dropdown
                    options={countryOptions}
                    selection
                    value={connection.domainLocation || countryOptions[0].value}
                    onChange={(e, data) => {
                      setConnection({ ...connection, domainLocation: data.value });
                    }}
                    compact
                  />
                </Form.Field>
                <Form.Field error={!!errors.domain} required>
                  <label>Enter your Mailgun domain</label>
                  <Form.Input
                    placeholder="mg.example.com"
                    value={connection.domain || ""}
                    onChange={(e, data) => {
                      setConnection({ ...connection, domain: data.value });
                    }}
                  />
                  {errors.domain
                    && (
                      <Label basic color="red" pointing>
                        {errors.domain}
                      </Label>
                    )}
                </Form.Field>

                <Form.Field>
                  <label>
                    {"Enter your Mailgun Private API Key. "}
                    <a href="https://app.mailgun.com/app/account/security/api_keys" target="_blank" rel="noreferrer">
                      {"Get your Private API Key from here "}
                      <Icon name="external" />
                    </a>
                  </label>
                  <Form.Input
                    placeholder="**********2bPvT"
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

        {testError && (
          <Container>
            <Message negative>
              <Message.Header>{"Cannot make the connection"}</Message.Header>
              <div>
                <p>{"Please make sure you copied the right token and API key from your Mailgun dashboard."}</p>
                <p>
                  <a href="https://app.mailgun.com/app/account/security/api_keys" target="_blank" rel="noreferrer">
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
            disabled={
              (!formVisible && (!selectedConnection || (selectedConnection && !connection.domain)))
              || (formVisible
                && (!connection.domainLocation || !connection.domain || !connection.apiKey)
              )
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

MailgunTemplate.defaultProps = {
  addError: null,
  onBack: null,
};

MailgunTemplate.propTypes = {
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired,
  connections: PropTypes.array.isRequired,
  addError: PropTypes.bool,
  onBack: PropTypes.func,
};

export default MailgunTemplate;
