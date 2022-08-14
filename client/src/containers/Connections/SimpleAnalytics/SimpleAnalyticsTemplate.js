import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Container, Divider, Dropdown, Grid, Input,
  Link, Loading, Row, Spacer, Text,
} from "@nextui-org/react";
import _ from "lodash";
import cookie from "react-cookies";
import {
  ChevronRight, CloseSquare, Plus, TickSquare
} from "react-iconly";
import { FaExternalLinkSquareAlt } from "react-icons/fa";

import { generateDashboard } from "../../../actions/project";
import { API_HOST } from "../../../config/settings";

/*
  The Form used to configure the SimpleAnalytics template
*/
function SimpleAnalyticsTemplate(props) {
  const {
    teamId, projectId, addError, onComplete, connections,
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
                        value={
                          availableConnections.find((c) => c.value === selectedConnection)?.text
                        }
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
                    label="Enter your Simple Analytics website"
                    placeholder="example.com"
                    value={(!formVisible && connection.website) || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, website: e.target.value });
                    }}
                    helperColor="error"
                    helperText={errors.website}
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
              <Input
                label="Enter your Simple Analytics website"
                placeholder="example.com"
                value={connection.website || ""}
                onChange={(e) => {
                  setConnection({ ...connection, website: e.target.value });
                }}
                helperColor="error"
                helperText={errors.website}
                bordered
                fullWidth
              />
            </Row>
            <Spacer y={1} />
            <Row align="center">
              <Input
                label="Enter your Simple Analytics API key (if the website is private)."
                placeholder="sa_api_key_*"
                value={connection.apiKey || ""}
                onChange={(e) => {
                  setConnection({ ...connection, apiKey: e.target.value });
                }}
                bordered
                fullWidth
              />
            </Row>
            <Spacer y={0.5} />
            <Row align="center">
              <Link href="https://simpleanalytics.com/account#api" target="_blank" rel="noreferrer" css={{ ai: "center", color: "$secondary" }}>
                <Text css={{ color: "$secondary" }}>{"Get your API key here "}</Text>
                <Spacer x={0.2} />
                <FaExternalLinkSquareAlt size={12} />
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

        {notPublic && (
          <Row>
            <Container css={{ backgroundColor: "$red300", p: 10 }}>
              <Row>
                <Text h5>{"Your site appears to be set to private"}</Text>
              </Row>
              <Row>
                <Text>{"In order to be able to get the stats from Simple Analytics, please do one of the following:"}</Text>
              </Row>
              <Row align="center">
                <ChevronRight />
                <Spacer x={0.2} />
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://simpleanalytics.com/account#api"
                >
                  <Text>Click here to get your API key and enter it in the field above.</Text>
                </Link>
                <Spacer x={0.2} />
                <FaExternalLinkSquareAlt size={12} />
              </Row>
              <Row align="center">
                <ChevronRight />
                <Spacer x={0.2} />
                <Link
                  href={`https://simpleanalytics.com/${connection.website}/settings#visibility`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Text>{"Alternatively, go to this page and make your website analytics public."}</Text>
                </Link>
                <Spacer x={0.2} />
                <FaExternalLinkSquareAlt size={12} />
              </Row>
            </Container>
          </Row>
        )}

        {notFound && (
          <Row>
            <Container css={{ backgroundColor: "$red300", p: 10 }}>
              <Row>
                <Text h5>{"Your site could not be found"}</Text>
              </Row>
              <Row>
                <Text>{"Make sure your website is spelt correctly and that it is registered with Simple Analytics."}</Text>
              </Row>
              <Row align="center">
                <Link href={`https://simpleanalytics.com/${connection.website}`} target="_blank" rel="noreferrer">
                  <Text>{"Click here to see if your website is registered with Simple Analytics"}</Text>
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
              (!formVisible && !selectedConnection)
              || !connection.website
              || (!selectedCharts || selectedCharts.length < 1)
              || loading
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

SimpleAnalyticsTemplate.defaultProps = {
  addError: null,
};

SimpleAnalyticsTemplate.propTypes = {
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired,
  connections: PropTypes.array.isRequired,
  addError: PropTypes.bool,
};

export default SimpleAnalyticsTemplate;
