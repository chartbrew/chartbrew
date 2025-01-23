import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Divider, Input, Link, Select, SelectItem, Spacer,
} from "@heroui/react";
import cookie from "react-cookies";
import _ from "lodash";
import { LuArrowLeft, LuArrowUp, LuCheckCheck, LuLink, LuPlus, LuX } from "react-icons/lu";
import { useDispatch } from "react-redux";
import { useNavigation } from "react-router";

import { createProject, generateDashboard } from "../../../slices/project";
import { API_HOST } from "../../../config/settings";
import Text from "../../../components/Text";
import Row from "../../../components/Row";

/*
  The Form used to configure the ChartMogul template
*/
function ChartMogulTemplate(props) {
  const {
    teamId, projectId, addError, onComplete, connections, onBack, projectName,
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

  const dispatch = useDispatch();
  const navigate = useNavigation();

  useEffect(() => {
    _getTemplateConfig();
  }, []);

  useEffect(() => {
    if (connections && connections.length > 0) {
      _getAvailableConnections();
    }
  }, [connections]);

  const _onGenerateDashboard = async () => {
    if (!projectId && !projectName) {
      return;
    }

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

    let newProjectId = projectId;
    if (!projectId && projectName) {
      await dispatch(createProject({ data: { team_id: teamId, name: projectName } }))
        .then((data) => {
          newProjectId = data.payload?.id;
        });
    }

    if (!newProjectId) {
      setLoading(false);
      return;
    }

    dispatch(generateDashboard({ project_id: newProjectId, data, template: "chartmogul" }))
      .then(() => {
        setTimeout(() => {
          navigate(`/${teamId}/${newProjectId}/dashboard`);
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
      <Row align="center">
        <Button
          isIconOnly
          variant="flat"
          onClick={onBack}
          size="sm"
        >
          <LuArrowLeft />
        </Button>
        <Spacer x={2} />
        <span className="font-bold">Configure the template</span>
      </Row>

      {availableConnections && availableConnections.length > 0 && (
        <>
          <Spacer y={4} />
          <Row>
            <Select
              isDisabled={formVisible}
              label="Select an existing connection"
              placeholder="Click to select a connection"
              value={_getConnectionName()}
              selectedKeys={[selectedConnection]}
              onSelectionChange={(keys) => setSelectedConnection(keys.currentKey)}
              selectionMode="single"
              variant="bordered"
              className="max-w-[400px]"
              aria-label="Select a connection"
            >
              {availableConnections.map((connection) => (
                <SelectItem key={connection.key} textValue={connection.text}>
                  {connection.text}
                </SelectItem>
              ))}
            </Select>
          </Row>
          <Spacer y={2} />
          <Row align="center">
            {!formVisible && (
              <Button
                variant="faded"
                startContent={<LuPlus />}
                onClick={() => setFormVisible(true)}
                color="primary"
              >
                Or create a new connection
              </Button>
            )}
            {formVisible && (
              <Button
                endContent={<LuArrowUp />}
                variant="faded"
                color="primary"
                onClick={() => setFormVisible(false)}
              >
                Use an existing connection
              </Button>
            )}
          </Row>
        </>
      )}
      <Spacer y={2} />
      {formVisible && (
        <>
          {availableConnections && availableConnections.length > 0 && (
            <Row>
              <Divider />
            </Row>
          )}
          <Spacer y={2} />
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
              <span className={"text-sm text-secondary"}>
                {"Click here to learn how to find your ChartMogul API key"}
              </span>
              <Spacer x={1} />
              <LuLink size={16} />
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
          <Row>
            <div className="grid grid-cols-12 gap-2">
              {configuration.Charts && configuration.Charts.map((chart) => (
                <div key={chart.tid} className="col-span-12 sm:col-span-12 md:col-span-6 lg:col-span-3 flex justify-start">
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
              startContent={<LuCheckCheck />}
              auto
              onClick={_onSelectAll}
              size="sm"
            >
              Select all
            </Button>
            <Spacer x={1} />
            <Button
              variant="bordered"
              startContent={<LuX />}
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
        <>
          <Spacer y={4} />
          <Row>
            <div className={"bg-danger-50 p-5 rounded-md"}>
              <Row>
                <Text b>{"Server error while trying to save your connection"}</Text>
              </Row>
              <Row>
                <Text>Please try again</Text>
              </Row>
            </div>
          </Row>
        </>
      )}

      {testError && (
        <>
          <Spacer y={4} />
          <Row>
            <div className={"bg-danger-50 p-5 rounded-md"}>
              <Row>
                <Text b>{"Cannot make the connection"}</Text>
              </Row>
              <Row>
                <Text>{"Please make sure you copied the right token and API key from your ChartMogul dashboard."}</Text>
              </Row>
              <Row align="center">
                <Link href="https://app.chartmogul.com/#/admin/api" target="_blank" rel="noreferrer">
                  <Text>{"Click here to go to the dashboard"}</Text>
                  <Spacer x={1} />
                  <LuLink />
                </Link>
              </Row>
            </div>
          </Row>
        </>
      )}

      <Spacer y={4} />
      <Row>
        <Button
          isDisabled={
            (!connection.key && formVisible) || selectedCharts.length === 0
          }
          onClick={_onGenerateDashboard}
          color="primary"
          isLoading={loading}
        >
          {"Create the charts"}
        </Button>
      </Row>
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
  projectName: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired,
  connections: PropTypes.array.isRequired,
  addError: PropTypes.bool,
  onBack: PropTypes.func.isRequired,
};

export default ChartMogulTemplate;
