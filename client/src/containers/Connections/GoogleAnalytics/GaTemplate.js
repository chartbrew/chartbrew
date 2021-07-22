import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Segment, Form, Button, Icon, Header, Label, Message,
  Container, Divider, List, Grid, Checkbox, Dropdown,
} from "semantic-ui-react";
import _ from "lodash";
import cookie from "react-cookies";

import {
  testRequest as testRequestAction,
  addConnection as addConnectionAction,
} from "../../../actions/connection";
import { generateDashboard } from "../../../actions/project";
import { API_HOST } from "../../../config/settings";

/*
  The Form used to configure the SimpleAnalytics template
*/
function GaTemplate(props) {
  const {
    teamId, projectId, addError, onComplete, connections, onBack,
    testRequest, selection, addConnection,
  } = props;

  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState({ name: "Google analytics", type: "googleAnalytics" });
  const [errors, setErrors] = useState({});
  const [notPublic, setNotPublic] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [configuration, setConfiguration] = useState({
    accountId: "",
    propertyId: "",
    viewId: "",
  });
  const [selectedCharts, setSelectedCharts] = useState(false);
  const [availableConnections, setAvailableConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [formVisible, setFormVisible] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  const [accountOptions, setAccountOptions] = useState([]);
  const [propertyOptions, setPropertyOptions] = useState([]);
  const [viewOptions, setViewOptions] = useState([]);
  const [accountsData, setAccountsData] = useState(null);

  useEffect(() => {
    _getTemplateConfig();
  }, []);

  useEffect(() => {
    if (connections && connections.length > 0) {
      _getAvailableConnections();
    }
  }, [connections]);

  useEffect(() => {
    setAccountOptions([]);
    setPropertyOptions([]);
    setViewOptions([]);
  }, [selectedConnection]);

  useEffect(() => {
    if (accountsData && accountsData.username) {
      if (accountsData.items && accountsData.items.length > 0) {
        const accountOpt = [];
        accountsData.items.forEach((acc) => {
          accountOpt.push({
            key: acc.id,
            value: acc.id,
            text: acc.name,
          });
        });

        setAccountOptions(accountOpt);
      }
    }
  }, [accountsData]);

  useEffect(() => {
    if (configuration.accountId) {
      const acc = _.findLast(accountsData.items, { id: configuration.accountId });
      const propertyOpt = [];
      if (acc && acc.webProperties) {
        acc.webProperties.forEach((prop) => {
          propertyOpt.push({
            key: prop.id,
            value: prop.id,
            text: prop.name,
          });
        });
      }

      setPropertyOptions(propertyOpt);
    }
  }, [configuration.accountId]);

  useEffect(() => {
    if (configuration.propertyId && configuration.accountId) {
      const acc = _.findLast(accountsData.items, { id: configuration.accountId });

      if (acc) {
        const prop = _.findLast(acc.webProperties, { id: configuration.propertyId });
        const viewOpt = [];
        if (prop && prop.profiles) {
          prop.profiles.forEach((view) => {
            viewOpt.push({
              key: view.id,
              value: view.id,
              text: view.name,
            });
          });
        }

        setViewOptions(viewOpt);
      }
    }
  }, [configuration.propertyId, configuration.accountId]);

  useEffect(() => {
    if (selection > -1) {
      setSelectedConnection(selection);
      _onSelectConnection(selection);
    }
  }, [selection]);

  const _onGenerateDashboard = () => {
    setErrors({});

    if (formVisible && !connection.name) {
      setTimeout(() => {
        setErrors({ ...errors, name: "Please enter a name for your connection" });
      }, 100);
      return;
    }

    if (!configuration.accountId) {
      setTimeout(() => {
        setErrors({ ...errors, accountId: "Please select an account" });
      }, 100);
      return;
    }

    if (!configuration.propertyId) {
      setTimeout(() => {
        setErrors({ ...errors, propertyId: "Please select an account property" });
      }, 100);
      return;
    }

    if (!configuration.viewId) {
      setTimeout(() => {
        setErrors({ ...errors, viewId: "Please select a View" });
      }, 100);
      return;
    }

    if (!selectedConnection) {
      setTimeout(() => {
        setErrors({ ...errors, connection: "Please create or select an existing connection" });
      }, 100);
      return;
    }

    const data = {
      ...connection, team_id: teamId, charts: selectedCharts, configuration
    };
    if (!formVisible && selectedConnection) {
      data.connection_id = selectedConnection;
    }

    setLoading(true);
    setNotPublic(false);
    setNotFound(false);

    generateDashboard(projectId, data, "googleAnalytics")
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
      if (connection.type === "googleAnalytics") {
        foundConnections.push({
          key: connection.id,
          value: connection.id,
          text: connection.name,
        });
      }
    });

    setAvailableConnections(foundConnections);

    if (!selectedConnection && foundConnections.length > 0) {
      setFormVisible(false);
    }
  };

  const _onSelectConnection = (value) => {
    setSelectedConnection(value);

    // get the accounts
    setCollectionsLoading(true);
    const connectionObj = connections.filter((c) => c.id === value)[0];
    return testRequest(projectId, connectionObj)
      .then((data) => {
        return data.json();
      })
      .then((data) => {
        setAccountsData(data);
        setCollectionsLoading(false);
      })
      .catch(() => {
        setCollectionsLoading(false);
      });
  };

  const _onAccountSelected = (value) => {
    if (value !== configuration.accountId) {
      setPropertyOptions([]);
      setViewOptions([]);
      setConfiguration({
        ...configuration,
        propertyId: "",
        viewId: "",
      });
    }

    setConfiguration({ ...configuration, accountId: value });
  };

  const _onPropertySelected = (value) => {
    if (value !== configuration.propertyId) {
      setViewOptions([]);
      setConfiguration({ ...configuration, viewId: "" });
    }
    setConfiguration({ ...configuration, propertyId: value });
  };

  const _onViewSelected = (value) => {
    setConfiguration({ ...configuration, viewId: value });
  };

  const _getTemplateConfig = () => {
    const url = `${API_HOST}/team/${teamId}/template/community/googleAnalytics`;
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

  const _onGoogleAuth = async () => {
    const newConnection = await addConnection(projectId, connection);

    const url = `${API_HOST}/project/${projectId}/connection/${newConnection.id}/google/auth?type=googleAnalyticsTemplate`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": cookie.load("brewToken"),
    });

    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) return Promise.reject(response.status);

        return response.json();
      })
      .then((result) => {
        if (result.url) {
          window.location.href = result.url;
        } else {
          Promise.reject("No URL found");
        }
      })
      .catch(() => {
        setErrors({ ...errors, auth: "Cannot authenticate with Google. Please try again." });
      });
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
                <Form.Field disabled={formVisible}>
                  <label>{"Select an existing connection"}</label>
                  <Dropdown
                    options={availableConnections}
                    value={selectedConnection || ""}
                    placeholder="Click to select a connection"
                    onChange={(e, data) => _onSelectConnection(data.value)}
                    selection
                    style={{ marginRight: 20 }}
                  />
                </Form.Field>
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
                {selectedConnection && !formVisible && (
                  <Form.Group widths={3}>
                    <Form.Field>
                      <label>Account</label>
                      <Dropdown
                        placeholder="Select an account"
                        selection
                        options={accountOptions}
                        onChange={(e, data) => _onAccountSelected(data.value)}
                        loading={collectionsLoading}
                        value={configuration.accountId}
                      />
                    </Form.Field>
                    <Form.Field disabled={!configuration.accountId}>
                      <label>Property</label>
                      <Dropdown
                        placeholder="Select a property"
                        selection
                        options={propertyOptions}
                        onChange={(e, data) => _onPropertySelected(data.value)}
                        loading={collectionsLoading}
                        value={configuration.propertyId}
                      />
                    </Form.Field>
                    <Form.Field disabled={!configuration.accountId || !configuration.propertyId}>
                      <label>View</label>
                      <Dropdown
                        placeholder="Select a view"
                        selection
                        options={viewOptions}
                        onChange={(e, data) => _onViewSelected(data.value)}
                        loading={collectionsLoading}
                        value={configuration.viewId}
                      />
                    </Form.Field>
                  </Form.Group>
                )}
              </Form>
            </>
          )}

          {formVisible && (
            <>
              {availableConnections && availableConnections.length > 0 && <Divider />}
              <Form>
                <Form.Field error={!!errors.name} required>
                  <label>Enter a name for your connection</label>
                  <Form.Input
                    placeholder="Google analytics"
                    value={connection.name || ""}
                    onChange={(e, data) => {
                      setConnection({ ...connection, name: data.value });
                    }}
                  />
                  {errors.name
                    && (
                      <Label basic color="red" pointing>
                        {errors.name}
                      </Label>
                    )}
                </Form.Field>

                <Form.Field>
                  <Button
                    primary
                    icon="google"
                    labelPosition="right"
                    content="Authenticate with Google"
                    onClick={_onGoogleAuth}
                  />
                  {errors.auth && (<p>{errors.auth}</p>)}
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
              || !configuration.accountId
              || !configuration.propertyId
              || !configuration.viewId
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

GaTemplate.defaultProps = {
  addError: null,
  onBack: null,
  selection: -1,
};

GaTemplate.propTypes = {
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired,
  connections: PropTypes.array.isRequired,
  addError: PropTypes.bool,
  onBack: PropTypes.func,
  selection: PropTypes.number,
  testRequest: PropTypes.func.isRequired,
  addConnection: PropTypes.func.isRequired,
};

const mapStateToProps = () => ({});
const mapDispatchToProps = (dispatch) => ({
  testRequest: (projectId, connectionId) => {
    return dispatch(testRequestAction(projectId, connectionId));
  },
  addConnection: (projectId, data) => dispatch(addConnectionAction(projectId, data)),
});

export default connect(mapStateToProps, mapDispatchToProps)(GaTemplate);
