import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Divider, Input, Link, Select, SelectItem, Spacer,
} from "@nextui-org/react";
import _ from "lodash";
import cookie from "react-cookies";
import {
  ChevronRight, CloseSquare, Plus, TickSquare
} from "react-iconly";
import { FaExternalLinkSquareAlt } from "react-icons/fa";

import { generateDashboard } from "../../../actions/project";
import { API_HOST } from "../../../config/settings";
import Container from "../../../components/Container";
import Row from "../../../components/Row";
import Text from "../../../components/Text";

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
        className="bg-content2 rounded-md"
        size="md"
        justify="flex-start"
      >
        <Row align="center">
          <Text size="h3">Configure the template</Text>
        </Row>

        {availableConnections && availableConnections.length > 0 && (
          <>
            <Row>
              <div className="grid grid-cols-12 gap-1">
                <div className="sm:col-span-12 md:col-span-6 lg:col-span-6">
                  <Select
                    isDisabled={formVisible}
                    label="Select an existing connection"
                    placeholder="Click to select a connection"
                    selectedKeys={[selectedConnection]}
                    onSelectionChange={(key) => setSelectedConnection(key)}
                    selectionMode="single"
                    variant="bordered"
                    value={
                      availableConnections.find((c) => c.value === selectedConnection)?.text
                    }
                  >
                    {availableConnections.map((connection) => (
                      <SelectItem key={connection.key}>
                        {connection.text}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-12 md:col-span-6 lg:col-span-6">
                  <Input
                    label="Enter your Simple Analytics website"
                    placeholder="example.com"
                    value={(!formVisible && connection.website) || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, website: e.target.value });
                    }}
                    color={errors ? "danger" : "primary"}
                    description={errors.website}
                    variant="bordered"
                    fullWidth
                    disabled={formVisible}
                  />
                </div>
              </div>
            </Row>
            <Spacer y={4} />
            <Row align="center">
              {!formVisible && (
                <Button
                  variant="ghost"
                  startContent={<Plus />}
                  onClick={() => setFormVisible(true)}
                  auto
                >
                  Or create a new connection
                </Button>
              )}
              {formVisible && (
                <Button
                  variant="ghost"
                  auto
                  onClick={() => setFormVisible(false)}
                >
                  Use an existing connection instead
                </Button>
              )}
            </Row>
          </>
        )}
        <Spacer y={4} />
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
                color={errors.website ? "danger" : "primary"}
                description={errors.website}
                variant="bordered"
                fullWidth
              />
            </Row>
            <Spacer y={4} />
            <Row align="center">
              <Input
                label="Enter your Simple Analytics API key (if the website is private)."
                placeholder="sa_api_key_*"
                value={connection.apiKey || ""}
                onChange={(e) => {
                  setConnection({ ...connection, apiKey: e.target.value });
                }}
                variant="bordered"
                fullWidth
              />
            </Row>
            <Spacer y={2} />
            <Row align="center">
              <Link href="https://simpleanalytics.com/account#api" target="_blank" rel="noreferrer" css={{ ai: "center", color: "$secondary" }}>
                <Text className={"text-secondary"}>{"Get your API key here "}</Text>
                <Spacer x={1} />
                <FaExternalLinkSquareAlt size={12} />
              </Link>
            </Row>
          </>
        )}

        {configuration && (
          <>
            <Spacer y={4} />
            <Row>
              <Text b>{"Select which charts you want Chartbrew to create for you"}</Text>
            </Row>
            <Spacer y={4} />
            <Row align="center">
              <div className="grid grid-cols-12">
                {configuration.Charts && configuration.Charts.map((chart) => (
                  <div className="col-span-12 sm:col-span-12 md:col-span-6 lg:col-span-4" key={chart.tid}>
                    <Checkbox
                      isSelected={
                        _.indexOf(selectedCharts, chart.tid) > -1
                      }
                      onChange={() => _onChangeSelectedCharts(chart.tid)}
                      size="sm"
                    >
                      {chart.name}
                    </Checkbox>
                  </div>
                ))}
              </div>
            </Row>

            <Spacer y={4} />
            <Row>
              <Button
                variant="bordered"
                startContent={<TickSquare />}
                auto
                onClick={_onSelectAll}
                size="sm"
              >
                Select all
              </Button>
              <Spacer x={1} />
              <Button
                variant="bordered"
                startContent={<CloseSquare />}
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
            <Container className={"bg-danger-100 p-10 rounded-md"}>
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
            <Container className={"bg-danger-100 p-10 rounded-md"}>
              <Row>
                <Text h5>{"Your site appears to be set to private"}</Text>
              </Row>
              <Row>
                <Text>{"In order to be able to get the stats from Simple Analytics, please do one of the following:"}</Text>
              </Row>
              <Row align="center">
                <ChevronRight />
                <Spacer x={1} />
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://simpleanalytics.com/account#api"
                >
                  <Text>Click here to get your API key and enter it in the field above.</Text>
                </Link>
                <Spacer x={1} />
                <FaExternalLinkSquareAlt size={12} />
              </Row>
              <Row align="center">
                <ChevronRight />
                <Spacer x={1} />
                <Link
                  href={`https://simpleanalytics.com/${connection.website}/settings#visibility`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Text>{"Alternatively, go to this page and make your website analytics public."}</Text>
                </Link>
                <Spacer x={1} />
                <FaExternalLinkSquareAlt size={12} />
              </Row>
            </Container>
          </Row>
        )}

        {notFound && (
          <Row>
            <Container className={"bg-danger-100 p-10 rounded-md"}>
              <Row>
                <Text h5>{"Your site could not be found"}</Text>
              </Row>
              <Row>
                <Text>{"Make sure your website is spelt correctly and that it is registered with Simple Analytics."}</Text>
              </Row>
              <Row align="center">
                <Link href={`https://simpleanalytics.com/${connection.website}`} target="_blank" rel="noreferrer">
                  <Text>{"Click here to see if your website is registered with Simple Analytics"}</Text>
                  <Spacer x={1} />
                  <FaExternalLinkSquareAlt size={12} />
                </Link>
              </Row>
            </Container>
          </Row>
        )}

        <Spacer y={4} />
        <Row>
          <Button
            disabled={
              (!formVisible && !selectedConnection)
              || !connection.website
              || (!selectedCharts || selectedCharts.length < 1)
            }
            isLoading={loading}
            onClick={_onGenerateDashboard}
            auto
          >
            {"Create the charts"}
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
