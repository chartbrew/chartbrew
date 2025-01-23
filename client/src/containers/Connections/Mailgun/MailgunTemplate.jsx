import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Divider, Input, Link, Select, SelectItem, Spacer,
} from "@heroui/react";
import _ from "lodash";
import cookie from "react-cookies";
import { LuArrowLeft, LuArrowRight, LuArrowUp, LuCheckCheck, LuExternalLink, LuPlus, LuX } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";

import { createProject, generateDashboard } from "../../../slices/project";
import { API_HOST } from "../../../config/settings";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import { selectConnections } from "../../../slices/connection";

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
    teamId, projectId, addError, onComplete, onBack, projectName,
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

  const connections = useSelector(selectConnections);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    _getTemplateConfig();
    setConnection({ ...connection, domainLocation: countryOptions[0].value });
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

    dispatch(generateDashboard({ project_id: newProjectId, data, template: "mailgun" }))
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
          <Spacer y={2} />
          <Row className={"gap-2"}>
            <Select
              isDisabled={formVisible}
              label="Select an existing connection"
              placeholder="Click to select a connection"
              value={_getConnectionName()}
              onSelectionChange={(keys) => setSelectedConnection(keys.currentKey)}
              variant="bordered"
              selectionMode="single"
              selectedKeys={[selectedConnection]}
              aria-label="Select a connection"
            >
              {availableConnections.map((connection) => (
                <SelectItem key={connection.key} textValue={connection.text}>
                  {connection.text}
                </SelectItem>
              ))}
            </Select>

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
              isDisabled={formVisible}
            />
          </Row>
          <Spacer y={2} />
          <Row align="center">
            {!formVisible && (
              <Button
                variant="ghost"
                startContent={<LuPlus />}
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
                startContent={<LuArrowUp />}
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
              onSelectionChange={(keys) => setConnection({ ...connection, domainLocation: keys.currentKey })}
              selectionMode="single"
              className="max-w-[400px]"
              aria-label="Select a domain location"
            >
              {countryOptions.map((location) => (
                <SelectItem key={location.key} textValue={location.text}>
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
              className="max-w-[400px]"
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
              className="max-w-[400px]"
            />
          </Row>
          <Spacer y={2} />
          <Row align="center">
            <Link
              href="https://app.mailgun.com/app/account/security/api_keys"
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center text-secondary"
            >
              <Text size="sm" className={"text-secondary"}>
                {"Get your Private API Key from here"}
              </Text>
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
          <Spacer y={2} />
          <Row align="center">
            <div className="grid grid-cols-12 gap-2">
              {configuration.Charts && configuration.Charts.map((chart) => (
                <div className="col-span-12 sm:col-span-12 md:col-span-6 lg:col-span-6 flex items-start" key={chart.tid}>
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
              variant="ghost"
              startContent={<LuCheckCheck />}
              auto
              onClick={_onSelectAll}
              size="sm"
            >
              Select all
            </Button>
            <Spacer x={1} />
            <Button
              variant="ghost"
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
                <Text>{"Please make sure you copied the right token and API key from your Mailgun dashboard."}</Text>
              </Row>
              <Row align="center">
                <Link href="https://app.mailgun.com/app/account/security/api_keys" target="_blank" rel="noreferrer">
                  <Text>{"Click here to go to the dashboard"}</Text>
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
            (!formVisible && (!selectedConnection || (selectedConnection && !connection.domain)))
            || (formVisible
              && (!connection.domainLocation || !connection.domain || !connection.apiKey)
            )
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
  projectName: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired,
  addError: PropTypes.bool,
  onBack: PropTypes.func.isRequired,
};

export default MailgunTemplate;
