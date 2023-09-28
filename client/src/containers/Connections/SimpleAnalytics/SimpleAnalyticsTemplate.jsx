import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Divider, Input, Link, Select, SelectItem, Spacer,
} from "@nextui-org/react";
import _ from "lodash";
import cookie from "react-cookies";
import { LuArrowRight, LuCheckCheck, LuChevronRight, LuExternalLink, LuPlus, LuX } from "react-icons/lu";

import { generateDashboard } from "../../../actions/project";
import { API_HOST } from "../../../config/settings";
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
      <Row align="center">
        <Text size="h3">Configure the template</Text>
      </Row>
      <Spacer y={2} />
      {availableConnections && availableConnections.length > 0 && (
        <>
          <Row>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-12 md:col-span-6 lg:col-span-6">
                <Select
                  isDisabled={formVisible}
                  label="Select an existing connection"
                  placeholder="Click to select a connection"
                  selectedKeys={[selectedConnection]}
                  onSelectionChange={(keys) => setSelectedConnection(keys.currentKey)}
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
              <div className="col-span-12 sm:col-span-12 md:col-span-6 lg:col-span-6">
                <Input
                  label="Enter your Simple Analytics website"
                  placeholder="example.com"
                  value={(!formVisible && connection.website) || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, website: e.target.value });
                  }}
                  color={errors.website ? "danger" : "default"}
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
                variant="faded"
                endContent={<LuPlus />}
                onClick={() => setFormVisible(true)}
                color="primary"
              >
                Or create a new connection
              </Button>
            )}
            {formVisible && (
              <Button
                variant="faded"
                color="primary"
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
          <Spacer y={2} />
          <Row align="center">
            <Input
              label="Enter your Simple Analytics website"
              placeholder="example.com"
              value={connection.website || ""}
              onChange={(e) => {
                setConnection({ ...connection, website: e.target.value });
              }}
              color={errors.website ? "danger" : "default"}
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
            <Link href="https://simpleanalytics.com/account#api" target="_blank" rel="noreferrer">
              <Text className={"text-secondary"}>{"Get your API key here "}</Text>
              <Spacer x={1} />
              <LuExternalLink />
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
          <Row>
            <div className="grid grid-cols-12 gap-2">
              {configuration.Charts && configuration.Charts.map((chart) => (
                <div className="col-span-12 sm:col-span-12 md:col-span-6 lg:col-span-4 flex justify-start items-start" key={chart.tid}>
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
              onClick={_onSelectAll}
              size="sm"
            >
              Select all
            </Button>
            <Spacer x={1} />
            <Button
              variant="bordered"
              startContent={<LuX />}
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
          <div className={"bg-danger-100 p-10 rounded-md"}>
            <Row>
              <Text h5>{"Server error while trying to save your connection"}</Text>
            </Row>
            <Row>
              <Text>Please try again</Text>
            </Row>
          </div>
        </Row>
      )}

      {notPublic && (
        <>
          <Spacer y={2} />
          <Row>
            <div className={"bg-danger-50 p-5 rounded-md"}>
              <Row>
                <Text b>{"Your site appears to be set to private"}</Text>
              </Row>
              <Row>
                <Text>{"In order to be able to get the stats from Simple Analytics, please do one of the following:"}</Text>
              </Row>
              <Row align="center">
                <LuChevronRight />
                <Spacer x={1} />
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://simpleanalytics.com/account#api"
                >
                  <Text>Click here to get your API key and enter it in the field above.</Text>
                </Link>
                <Spacer x={1} />
                <LuExternalLink size={12} />
              </Row>
              <Row align="center">
                <LuChevronRight />
                <Spacer x={1} />
                <Link
                  href={`https://simpleanalytics.com/${connection.website}/settings#visibility`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Text>{"Alternatively, go to this page and make your website analytics public."}</Text>
                </Link>
                <Spacer x={1} />
                <LuExternalLink size={12} />
              </Row>
            </div>
          </Row>
        </>
      )}

      {notFound && (
        <>
          <Spacer y={2} />
          <Row>
            <div className={"bg-danger-50 p-5 rounded-md"}>
              <Row>
                <Text b>{"Your site could not be found"}</Text>
              </Row>
              <Row>
                <Text>{"Make sure your website is spelt correctly and that it is registered with Simple Analytics."}</Text>
              </Row>
              <Row align="center">
                <Link href={`https://simpleanalytics.com/${connection.website}`} target="_blank" rel="noreferrer">
                  <Text>{"Click here to see if your website is registered with Simple Analytics"}</Text>
                  <Spacer x={1} />
                  <LuExternalLink />
                </Link>
              </Row>
            </div>
          </Row>
        </>
      )}

      <Spacer y={8} />
      <Row>
        <Button
          isDisabled={
            (!formVisible && !selectedConnection)
            || !connection.website
            || (!selectedCharts || selectedCharts.length < 1)
          }
          isLoading={loading}
          onClick={_onGenerateDashboard}
          color="primary"
          endContent={<LuArrowRight />}
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
  formStyle: {
    marginTop: 20,
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
