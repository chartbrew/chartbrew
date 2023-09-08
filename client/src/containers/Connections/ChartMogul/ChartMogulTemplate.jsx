import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Divider, Input, Link, Select, SelectItem, Spacer,
} from "@nextui-org/react";
import {
  ArrowUp, CloseSquare, Plus, TickSquare
} from "react-iconly";
import { FaExternalLinkSquareAlt } from "react-icons/fa";
import cookie from "react-cookies";
import _ from "lodash";

import { generateDashboard } from "../../../actions/project";
import { API_HOST } from "../../../config/settings";
import Container from "../../../components/Container";
import Text from "../../../components/Text";
import Row from "../../../components/Row";

/*
  The Form used to configure the ChartMogul template
*/
function ChartMogulTemplate(props) {
  const {
    teamId, projectId, addError, onComplete, connections,
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

  const _getConnectionName = () => (
    availableConnections
      && availableConnections.find(
        (c) => c.value === parseInt(selectedConnection, 10)
      )?.text
  );

  return (
    <div style={styles.container}>
      <Container
        className={"bg-content2 rounded-md"}
        size="md"
        justify="flex-start"
      >
        <Row align="center">
          <Text h3>Configure the template</Text>
        </Row>

        {availableConnections && availableConnections.length > 0 && (
          <>
            <Row>
              <Select
                isDisabled={formVisible}
                label="Select an existing connection"
                placeholder="Click to select a connection"
                value={_getConnectionName()}
                selectedKeys={[selectedConnection]}
                onSelectionChange={(key) => setSelectedConnection(key)}
                selectionMode="single"
              >
                {availableConnections.map((connection) => (
                  <SelectItem key={connection.key}>
                    {connection.text}
                  </SelectItem>
                ))}
              </Select>
            </Row>
            <Spacer y={2} />
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
                  startContent={<ArrowUp />}
                  variant="ghost"
                  auto
                  onClick={() => setFormVisible(false)}
                >
                  Use an existing connection
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
            <Spacer y={4} />
            <Row align="center">
              <Input
                label="Enter your ChartMogul API key"
                placeholder="de2bf2bc6de5266d11ea6b918b674780"
                value={connection.key || ""}
                onChange={(e) => {
                  setConnection({ ...connection, key: e.target.value, token: e.target.value });
                }}
                color={errors.key ? "danger" : "primary"}
                description={errors.key}
                variant="bordered"
                fullWidth
              />
            </Row>
            <Spacer y={2} />
            <Row align="center">
              <Link
                href="https://chartbrew.com/blog/how-to-create-chartmogul-charts-in-chartbrew/#connecting-to-the-chartmogul-data-source"
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center text-secondary"
              >
                <Text className={"text-secondary"}>
                  {"Click here to learn how to find your ChartMogul API key"}
                </Text>
                <Spacer x={1} />
                <FaExternalLinkSquareAlt size={16} />
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
            <Spacer y={2} />
            <Row align="center">
              <div className="grid grid-cols-12">
                {configuration.Charts && configuration.Charts.map((chart) => (
                  <div key={chart.tid} className="col-span-12 sm:col-span-12 md:col-span-6 lg:col-span-3">
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

        {testError && (
          <Row>
            <Container className={"bg-danger-100 p-10 rounded-md"}>
              <Row>
                <Text h5>{"Cannot make the connection"}</Text>
              </Row>
              <Row>
                <Text>{"Please make sure you copied the right token and API key from your ChartMogul dashboard."}</Text>
              </Row>
              <Row align="center">
                <Link href="https://app.chartmogul.com/#/admin/api" target="_blank" rel="noreferrer">
                  <Text>{"Click here to go to the dashboard"}</Text>
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
              (!connection.key && formVisible) || selectedCharts.length === 0
            }
            onClick={_onGenerateDashboard}
            auto
            isLoading={loading}
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

ChartMogulTemplate.defaultProps = {
  addError: null,
};

ChartMogulTemplate.propTypes = {
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired,
  connections: PropTypes.array.isRequired,
  addError: PropTypes.bool,
};

export default ChartMogulTemplate;
