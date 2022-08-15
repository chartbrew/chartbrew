import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Button, Checkbox, Container, Divider, Dropdown, Grid, Input,
  Loading, Row, Spacer, Text,
} from "@nextui-org/react";
import {
  ChevronDown, CloseSquare, Plus, TickSquare
} from "react-iconly";
import { FaGoogle } from "react-icons/fa";
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
    teamId, projectId, addError, onComplete, connections,
    testRequest, selection, addConnection,
  } = props;

  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState({ name: "Google analytics", type: "googleAnalytics" });
  const [errors, setErrors] = useState({});
  const [configuration, setConfiguration] = useState({
    accountId: "",
    propertyId: "",
    viewId: "",
  });
  const [selectedCharts, setSelectedCharts] = useState(false);
  const [availableConnections, setAvailableConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [formVisible, setFormVisible] = useState(true);
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

    generateDashboard(projectId, data, "googleAnalytics")
      .then(() => {
        setTimeout(() => {
          onComplete();
        }, 2000);
      })
      .catch(() => {
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
    const connectionObj = connections.filter((c) => c.id === parseInt(value, 10))[0];
    return testRequest(projectId, connectionObj)
      .then((data) => {
        return data.json();
      })
      .then((data) => {
        setAccountsData(data);
      })
      .catch(() => {
        //
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

  const _getListName = (list, value, isInt) => (
    list
      && value
      && list.find(
        (c) => c.value === (isInt ? parseInt(value, 10) : value)
      )?.text
  );

  return (
    <div style={styles.container}>
      <Container
        css={{
          backgroundColor: "$backgroundContrast",
          br: "$md",
          p: 10,
          "@xs": {
            p: 20,
          },
          "@sm": {
            p: 20,
          },
          "@md": {
            p: 20,
          },
        }}
        md
        justify="flex-start"
      >
        <Row align="center">
          <Text h3>Configure the template</Text>
        </Row>

        {availableConnections && availableConnections.length > 0 && (
          <>
            <Row align="center">
              <Dropdown
                isDisabled={formVisible}
              >
                <Dropdown.Trigger>
                  <Input
                    label="Select an existing connection"
                    value={_getListName(availableConnections, selectedConnection, true)}
                    placeholder="Click to select a connection"
                    bordered
                    fullWidth
                    contentRight={<ChevronDown />}
                  />
                </Dropdown.Trigger>
                <Dropdown.Menu
                  onAction={(key) => _onSelectConnection(key)}
                  selectedKeys={[selectedConnection]}
                  selectionMode="single"
                  disabled={formVisible}
                >
                  {availableConnections.map((connection) => (
                    <Dropdown.Item key={connection.key}>
                      {connection.text}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Row>
            <Spacer y={1} />
            <Row align="center">
              {!formVisible && (
                <Button
                  ghost
                  icon={<Plus />}
                  onClick={() => setFormVisible(true)}
                  auto
                >
                  Or create a new connection
                </Button>
              )}
              {formVisible && (
                <Button
                  ghost
                  auto
                  onClick={() => setFormVisible(false)}
                >
                  Use an existing connection instead
                </Button>
              )}
            </Row>
            <Spacer y={1} />
            <Row>
              <Grid.Container gap={1}>
                {selectedConnection && !formVisible && (
                  <>
                    <Grid xs={12} sm={12} md={4}>
                      <Dropdown>
                        <Dropdown.Trigger>
                          <Input
                            placeholder="Select an account"
                            label="Account"
                            value={_getListName(accountOptions, configuration.accountId)}
                            bordered
                            fullWidth
                            contentRight={<ChevronDown />}
                          />
                        </Dropdown.Trigger>
                        <Dropdown.Menu
                          onAction={(key) => _onAccountSelected(key)}
                          selectedKeys={[configuration.accountId]}
                          selectionMode="single"
                        >
                          {accountOptions.map((option) => (
                            <Dropdown.Item key={option.key}>
                              {option.text}
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Menu>
                      </Dropdown>
                    </Grid>
                    <Grid xs={12} sm={12} md={4}>
                      <Dropdown isDisabled={!configuration.accountId}>
                        <Dropdown.Trigger>
                          <Input
                            placeholder="Select a property"
                            label="Property"
                            value={_getListName(propertyOptions, configuration.propertyId)}
                            bordered
                            fullWidth
                            contentRight={<ChevronDown />}
                          />
                        </Dropdown.Trigger>
                        <Dropdown.Menu
                          onAction={(key) => _onPropertySelected(key)}
                          selectedKeys={[configuration.propertyId]}
                          selectionMode="single"
                        >
                          {propertyOptions.map((option) => (
                            <Dropdown.Item key={option.key}>
                              {option.text}
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Menu>
                      </Dropdown>
                    </Grid>
                    <Grid xs={12} sm={12} md={4}>
                      <Dropdown isDisabled={!configuration.accountId || !configuration.propertyId}>
                        <Dropdown.Trigger>
                          <Input
                            placeholder="Select a view"
                            label="View"
                            value={_getListName(viewOptions, configuration.viewId)}
                            bordered
                            fullWidth
                            contentRight={<ChevronDown />}
                          />
                        </Dropdown.Trigger>
                        <Dropdown.Menu
                          onAction={(key) => _onViewSelected(key)}
                          selectedKeys={[configuration.viewId]}
                          selectionMode="single"
                        >
                          {viewOptions.map((option) => (
                            <Dropdown.Item key={option.key}>
                              {option.text}
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Menu>
                      </Dropdown>
                    </Grid>
                  </>
                )}
              </Grid.Container>
            </Row>
          </>
        )}

        {formVisible && (
          <>
            {availableConnections && availableConnections.length > 0 && (
              <Row>
                <Divider />
              </Row>
            )}
            <Spacer y={1} />
            <Row align="center">
              <Input
                placeholder="Google analytics"
                label="Enter a name for your connection"
                value={connection.name || ""}
                onChange={(e) => {
                  setConnection({ ...connection, name: e.target.value });
                }}
                bordered
                fullWidth
                helperColor="error"
                helperText={errors.name}
              />
            </Row>
            <Spacer y={1} />
            <Row align="center">
              <Button
                color={"secondary"}
                iconRight={<FaGoogle size={20} />}
                onClick={_onGoogleAuth}
                auto
              >
                {"Authenticate with Google"}
              </Button>
            </Row>
            {errors.auth && (<Row><p>{errors.auth}</p></Row>)}
          </>
        )}

        {configuration && (
          <>
            <Spacer y={1} />
            <Row>
              <Text b>{"Select which charts you want Chartbrew to create for you"}</Text>
            </Row>
            <Spacer y={1} />
            <Row align="center">
              <Grid.Container>
                {configuration.Charts && configuration.Charts.map((chart) => (
                  <Grid key={chart.tid} xs={12} sm={6}>
                    <Checkbox
                      isSelected={
                        _.indexOf(selectedCharts, chart.tid) > -1
                      }
                      onChange={() => _onChangeSelectedCharts(chart.tid)}
                      size="sm"
                    >
                      {chart.name}
                    </Checkbox>
                  </Grid>
                ))}
              </Grid.Container>
            </Row>

            <Spacer y={1} />
            <Row>
              <Button
                bordered
                icon={<TickSquare />}
                auto
                onClick={_onSelectAll}
                size="sm"
              >
                Select all
              </Button>
              <Spacer x={0.2} />
              <Button
                bordered
                icon={<CloseSquare />}
                auto
                onClick={_onDeselectAll}
                size="sm"
              >
                Deselect all
              </Button>
            </Row>
          </>
        )}

        {addError && (
          <Row>
            <Container css={{ backgroundColor: "$red300", p: 10 }}>
              <Row>
                <Text h5>{"Server error while trying to save your connection"}</Text>
              </Row>
              <Row>
                <Text>Please try again</Text>
              </Row>
            </Container>
          </Row>
        )}

        <Spacer y={2} />
        <Row>
          <Button
            disabled={
              (!formVisible && !selectedConnection)
              || !configuration.accountId
              || !configuration.propertyId
              || !configuration.viewId
              || (!selectedCharts || selectedCharts.length < 1)
            }
            onClick={_onGenerateDashboard}
            auto
          >
            {loading && <Loading type="points" color="currentColor" />}
            {!loading && "Create the charts"}
          </Button>
        </Row>
      </Container>
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
  selection: -1,
};

GaTemplate.propTypes = {
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired,
  connections: PropTypes.array.isRequired,
  addError: PropTypes.bool,
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
