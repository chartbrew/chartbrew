import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Divider, Input, Link, Select, SelectItem, Spacer,
} from "@nextui-org/react";
import {
  ChevronDown, CloseSquare, Plus, TickSquare
} from "react-iconly";
import { FaExternalLinkSquareAlt } from "react-icons/fa";
import _ from "lodash";
import cookie from "react-cookies";

import { generateDashboard } from "../../../actions/project";
import { API_HOST } from "../../../config/settings";
import Container from "../../../components/Container";
import Text from "../../../components/Text";
import Row from "../../../components/Row";

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
              <div className="grid grid-cols-12 gap-1">
                <div className="col-span-12 sm:col-span-12 md:col-span-6 lg:col-span-6">
                  <Select
                    isDisabled={formVisible}
                    label="Select an existing connection"
                    placeholder="Click to select a connection"
                    value={_getConnectionName()}
                    onSelectionChange={(key) => setSelectedConnection(key)}
                    variant="bordered"
                    selectionMode="single"
                    selectedKeys={[selectedConnection]}
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
                    label="Enter your Mailgun domain"
                    placeholder="mg.domain.com"
                    value={(!formVisible && connection.domain) || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, domain: e.target.value });
                    }}
                    color={errors.domain ? "danger" : "default"}
                    description={errors.domain}
                    variant="bordered"
                    fullWidth
                    disabled={formVisible}
                  />
                </div>
              </div>
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
              <Select
                variant="bordered"
                label="Select your Mailgun domain location"
                placeholder="Domain location"
                value={_getCountryName() || ""}
                selectedKeys={[connection.domainLocation]}
                onSelectionChange={(key) => setConnection({ ...connection, domainLocation: key })}
                selectionMode="single"
                endContent={<ChevronDown />}
              >
                {countryOptions.map((location) => (
                  <SelectItem key={location.key}>
                    {location.text}
                  </SelectItem>
                ))}
              </Select>
            </Row>
            <Spacer y={2} />
            <Row align="center">
              <Input
                label="Enter your Mailgun domain"
                placeholder="mg.example.com"
                value={connection.domain || ""}
                onChange={(e) => {
                  setConnection({ ...connection, domain: e.target.value });
                }}
                color={errors.domain ? "danger" : "default"}
                description={errors.domain}
                variant="bordered"
                fullWidth
              />
            </Row>
            <Spacer y={2} />
            <Row align="center">
              <Input
                label="Enter your Mailgun Private API Key"
                placeholder="**********2bPvT"
                value={connection.apiKey || ""}
                onChange={(e) => {
                  setConnection({ ...connection, apiKey: e.target.value });
                }}
                color={errors.apiKey ? "danger" : "default"}
                description={errors.apiKey}
                variant="bordered"
                fullWidth
              />
            </Row>
            <Spacer y={1} />
            <Row align="center">
              <Link
                href="https://app.mailgun.com/app/account/security/api_keys"
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center text-secondary"
              >
                <Text className={"text-secondary"}>
                  {"Get your Private API Key from here"}
                </Text>
                <Spacer x={1} />
                <FaExternalLinkSquareAlt size={16} />
              </Link>
            </Row>
          </>
        )}

        {configuration && (
          <>
            <Spacer y={2} />
            <Row>
              <Text b>{"Select which charts you want Chartbrew to create for you"}</Text>
            </Row>
            <Spacer y={2} />
            <Row align="center">
              <div className="grid grid-cols-12">
                {configuration.Charts && configuration.Charts.map((chart) => (
                  <div className="col-span-12 sm:col-span-12 md:col-span-6 lg:col-span-6" key={chart.tid}>
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

            <Spacer y={2} />
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
                <Text>{"Please make sure you copied the right token and API key from your Mailgun dashboard."}</Text>
              </Row>
              <Row align="center">
                <Link href="https://app.mailgun.com/app/account/security/api_keys" target="_blank" rel="noreferrer">
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
              (!formVisible && (!selectedConnection || (selectedConnection && !connection.domain)))
              || (formVisible
                && (!connection.domainLocation || !connection.domain || !connection.apiKey)
              )
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
