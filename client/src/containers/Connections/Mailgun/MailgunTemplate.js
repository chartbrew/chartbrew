import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Container, Divider, Dropdown, Grid, Input,
  Link, Loading, Row, Spacer, Text,
} from "@nextui-org/react";
import {
  ChevronDown, CloseSquare, Plus, TickSquare
} from "react-iconly";
import { FaExternalLinkSquareAlt } from "react-icons/fa";
import _ from "lodash";
import cookie from "react-cookies";

import { generateDashboard } from "../../../actions/project";
import { API_HOST } from "../../../config/settings";

const countryOptions = [{
  key: "eu", value: "eu", text: "🇪🇺 Europe", flag: "eu"
}, {
  key: "us", value: "us", text: "🇺🇸 US", flag: "us"
}];

/*
  The Form used to configure the Mailgun template
*/
function MailgunTemplate(props) {
  const {
    teamId, projectId, addError, onComplete, connections,
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

  const _getConnectionName = () => (
    availableConnections
      && availableConnections.find(
        (c) => c.value === parseInt(selectedConnection, 10)
      )?.text
  );

  const _getCountryName = () => (
    connection.domainLocation && countryOptions.find(
      (c) => c.value === connection.domainLocation
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
            <Row>
              <Grid.Container gap={1}>
                <Grid xs={12} sm={6} md={6}>
                  <Dropdown
                    isDisabled={formVisible}
                  >
                    <Dropdown.Trigger>
                      <Input
                        label="Select an existing connection"
                        value={_getConnectionName()}
                        placeholder="Click to select a connection"
                        fullWidth
                      />
                    </Dropdown.Trigger>
                    <Dropdown.Menu
                      onAction={(key) => setSelectedConnection(key)}
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
                </Grid>
                <Grid xs={12} sm={6} md={6}>
                  <Input
                    label="Enter your Mailgun domain"
                    placeholder="mg.domain.com"
                    value={(!formVisible && connection.domain) || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, domain: e.target.value });
                    }}
                    helperColor="error"
                    helperText={errors.domain}
                    bordered
                    fullWidth
                    disabled={formVisible}
                  />
                </Grid>
              </Grid.Container>
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
          </>
        )}
        <Spacer y={1} />
        {formVisible && (
          <>
            {availableConnections && availableConnections.length > 0 && (
              <Row>
                <Divider />
              </Row>
            )}
            <Spacer y={1} />
            <Row align="center">
              <Dropdown>
                <Dropdown.Trigger css={{ ta: "left" }}>
                  <Input
                    label="Select your Mailgun domain location"
                    placeholder="Domain location"
                    value={_getCountryName() || ""}
                    contentRight={<ChevronDown />}
                    bordered
                    fullWidth
                    helperColor="error"
                    helperText={errors.domainLocation}
                    style={{ textAlign: "left" }}
                  />
                </Dropdown.Trigger>
                <Dropdown.Menu
                  onAction={(key) => setConnection({ ...connection, domainLocation: key })}
                  selectedKeys={[connection.domainLocation]}
                  selectionMode="single"
                >
                  {countryOptions.map((location) => (
                    <Dropdown.Item key={location.key}>
                      {location.text}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Row>
            <Spacer y={1} />
            <Row align="center">
              <Input
                label="Enter your Mailgun domain"
                placeholder="mg.example.com"
                value={connection.domain || ""}
                onChange={(e) => {
                  setConnection({ ...connection, domain: e.target.value });
                }}
                helperColor="error"
                helperText={errors.domain}
                bordered
                fullWidth
              />
            </Row>
            <Spacer y={1} />
            <Row align="center">
              <Input
                label="Enter your Mailgun Private API Key"
                placeholder="**********2bPvT"
                value={connection.apiKey || ""}
                onChange={(e) => {
                  setConnection({ ...connection, apiKey: e.target.value });
                }}
                helperColor="error"
                helperText={errors.apiKey}
                bordered
                fullWidth
              />
            </Row>
            <Spacer y={0.5} />
            <Row align="center">
              <Link
                href="https://app.mailgun.com/app/account/security/api_keys"
                target="_blank"
                rel="noreferrer noopener"
                css={{ color: "$secondary", ai: "center" }}
              >
                <Text css={{ color: "$secondary" }}>
                  {"Get your Private API Key from here"}
                </Text>
                <Spacer x={0.2} />
                <FaExternalLinkSquareAlt size={16} />
              </Link>
            </Row>
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

        {testError && (
          <Row>
            <Container css={{ backgroundColor: "$red300", p: 10 }}>
              <Row>
                <Text h5>{"Cannot make the connection"}</Text>
              </Row>
              <Row>
                <Text>{"Please make sure you copied the right token and API key from your Mailgun dashboard."}</Text>
              </Row>
              <Row align="center">
                <Link href="https://app.mailgun.com/app/account/security/api_keys" target="_blank" rel="noreferrer">
                  <Text>{"Click here to go to the dashboard"}</Text>
                  <Spacer x={0.2} />
                  <FaExternalLinkSquareAlt size={12} />
                </Link>
              </Row>
            </Container>
          </Row>
        )}

        <Spacer y={2} />
        <Row>
          <Button
            disabled={
              (!formVisible && (!selectedConnection || (selectedConnection && !connection.domain)))
              || (formVisible
                && (!connection.domainLocation || !connection.domain || !connection.apiKey)
              )
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

MailgunTemplate.defaultProps = {
  addError: null,
};

MailgunTemplate.propTypes = {
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired,
  connections: PropTypes.array.isRequired,
  addError: PropTypes.bool,
};

export default MailgunTemplate;
