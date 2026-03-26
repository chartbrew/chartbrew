import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Separator, Input, Link, Select, Label, ListBox,
} from "@heroui/react";
import _ from "lodash";
import cookie from "react-cookies";
import { LuArrowLeft, LuArrowUp, LuCheckCheck, LuChevronRight, LuExternalLink, LuPlus, LuX } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";

import { createProject, generateDashboard } from "../../../slices/project";
import { API_HOST } from "../../../config/settings";
import Text from "../../../components/Text";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import Row from "../../../components/Row";
import { selectConnections } from "../../../slices/connection";

/*
  The Form used to configure the Plausible template
*/
function PlausibleTemplate(props) {
  const {
    teamId, projectId, addError, onComplete, onBack, projectName,
  } = props;

  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState({});
  const [errors, setErrors] = useState({});
  const [generationError, setGenerationError] = useState(false);
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

    if (formVisible && !connection.website) {
      setTimeout(() => {
        setErrors({ ...errors, website: "Please enter your website" });
      }, 100);
      return;
    }

    if (formVisible && !connection.apiKey) {
      setTimeout(() => {
        setErrors({ ...errors, apiKey: "Please enter the API key" });
      }, 100);
      return;
    }

    const data = { ...connection, team_id: teamId, charts: selectedCharts };
    if (!formVisible && selectedConnection) {
      data.connection_id = selectedConnection;
    }

    setLoading(true);
    setGenerationError(false);

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

    dispatch(generateDashboard({ project_id: newProjectId, data, template: "plausible" }))
      .then(() => {
        setTimeout(() => {
          navigate(`/dashboard/${newProjectId}`);
          onComplete();
        }, 2000);
      })
      .catch(() => {
        setGenerationError(true);
        setLoading(false);
      });
  };

  const _getAvailableConnections = () => {
    const foundConnections = [];
    connections.forEach((connection) => {
      if (connection.host && connection.host.indexOf("https://plausible.io") > -1 && connection.type === "api") {
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
    const url = `${API_HOST}/team/${teamId}/template/community/plausible`;
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
      <Row align="center" className={"gap-2"}>
        <Button
          isIconOnly
          variant="tertiary"
          onClick={onBack}
          size="sm"
        >
          <LuArrowLeft />
        </Button>
        <span className="font-bold">Configure the template</span>
      </Row>
      {availableConnections && availableConnections.length > 0 && (
        <>
          <div className="h-4" />
          <Row className={"gap-2"}>
            <Select
              isDisabled={formVisible}
              variant="secondary"
              placeholder="Click to select a connection"
              value={selectedConnection || null}
              selectionMode="single"
              onChange={(value) => setSelectedConnection(value)}
              aria-label="Select a connection"
            >
              <Label>Select an existing connection</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {availableConnections.map((connection) => (
                    <ListBox.Item key={connection.key} id={connection.key} textValue={connection.text}>
                      {connection.text}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Input
              label="Enter your Plausible site ID"
              placeholder="example.com"
              value={(!formVisible && connection.website) || ""}
              onChange={(e) => {
                if (e.target.value && (e.target.value.indexOf("http://") > -1 || e.target.value.indexOf("https://") > -1)) {
                  setErrors({ ...errors, website: "Http:// and https:// are not needed." });
                  return;
                } else {
                  setErrors({ ...errors, website: "" });
                }
                setConnection({ ...connection, website: e.target.value });
              }}
              color={errors.website ? "danger" : "default"}
              description={errors.website}
              variant="secondary"
              fullWidth
              isDisabled={formVisible}
            />
          </Row>

          <div className="h-2" />
          <Row align="center">
            {!formVisible && (
              <Button
                variant="secondary"
                onClick={() => setFormVisible(true)}
              >
                <LuPlus />
                Or create a new connection
              </Button>
            )}
            {formVisible && (
              <Button
                variant="secondary"
                onClick={() => setFormVisible(false)}
              >
                <LuArrowUp />
                Use an existing connection instead
              </Button>
            )}
          </Row>
        </>
      )}
      <div className="h-2" />
      {formVisible && (
        <>
          {availableConnections && availableConnections.length > 0 && (
            <Row>
              <Separator />
            </Row>
          )}
          <div className="h-2" />
          <Row align="center">
            <Input
              label="Enter your Plausible site ID"
              placeholder="example.com"
              value={connection.website || ""}
              onChange={(e) => {
                setConnection({ ...connection, website: e.target.value });
              }}
              color={errors.website ? "danger" : "default"}
              description={errors.website}
              variant="secondary"
              fullWidth
            />
          </Row>
          <div className="h-2" />
          <Row align="center">
            <Input
              label="Enter your Plausible API key."
              placeholder="JtwBmY**************************"
              value={connection.apiKey || ""}
              onChange={(e) => {
                setConnection({ ...connection, apiKey: e.target.value });
              }}
              variant="secondary"
              fullWidth
            />
          </Row>
          <div className="h-2" />
          <Row align="center">
            <Link
              href="https://plausible.io/settings#api-keys"
              target="_blank"
              rel="noreferrer"
              className="flex items-center text-secondary"
            >
              <Text size="sm" className={"text-secondary"}>{"Get your API key here "}</Text>
              <div className="w-1" />
              <LuExternalLink />
            </Link>
          </Row>
        </>
      )}

      {configuration && (
        <>
          <div className="h-2" />
          <Row>
            <Text b>{"Select which charts you want Chartbrew to create for you"}</Text>
          </Row>
          <div className="h-2" />
          <Row align="center">
            <div className="grid grid-cols-12 gap-2">
              {configuration.Charts && configuration.Charts.map((chart) => (
                <div className="col-span-12 md:col-span-6 lg:col-span-6 flex items-center" key={chart.tid}>
                  <Checkbox
                    id={`plausible-chart-${chart.tid}`}
                    isSelected={_.indexOf(selectedCharts, chart.tid) > -1}
                    onChange={(selected) => {
                      const wasSelected = _.indexOf(selectedCharts, chart.tid) > -1;
                      if (selected !== wasSelected) _onChangeSelectedCharts(chart.tid);
                    }}
                  >
                    <Checkbox.Control className="size-4 shrink-0">
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Content>
                      <Label htmlFor={`plausible-chart-${chart.tid}`} className="text-sm">{chart.name}</Label>
                    </Checkbox.Content>
                  </Checkbox>
                </div>
              ))}
            </div>
          </Row>

          <div className="h-4" />
          <Row>
            <Button
              variant="ghost"
              auto
              onClick={_onSelectAll}
              size="sm"
            >
              <LuCheckCheck />
              Select all
            </Button>
            <div className="w-1" />
            <Button
              variant="ghost"
              auto
              onClick={_onDeselectAll}
              size="sm"
            >
              <LuX />
              Deselect all
            </Button>
          </Row>
        </>
      )}

      {addError && (
        <>
          <div className="h-2" />
          <Row>
            <div className={"bg-danger-50 rounded-md p-5"}>
              <Row>
                <Text h5>{"Server error while trying to save your connection"}</Text>
              </Row>
              <Row>
                <Text>Please try again</Text>
              </Row>
            </div>
          </Row>
        </>
      )}

      {generationError && (
        <>
          <div className="h-2" />
          <Row>
            <div className={"bg-danger-50 rounded-md p-5"}>
              <Row>
                <Text h5>{"Invalid site ID or API Key"}</Text>
              </Row>
              <Row>
                <Text>{"Make sure your site ID is spelt correctly and you used the correct API Key"}</Text>
              </Row>
              <Row align="center">
                <LuChevronRight />
                <div className="w-1" />
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://plausible.io/${connection.website}`}
                >
                  <Text>You can log in and check if your site ID exists here</Text>
                </Link>
                <div className="w-1" />
                <LuExternalLink />
              </Row>
              <Row align="center">
                <LuChevronRight />
                <div className="w-1" />
                <Link
                  href="https://plausible.io/settings#api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Text>{"Then check if your API Key is correct or generate a new one here"}</Text>
                </Link>
                <div className="w-1" />
                <LuExternalLink />
              </Row>
            </div>
          </Row>
        </>
      )}

      <div className="h-8" />
      <Row>
        <Button
          isDisabled={
            loading
            || (!formVisible && !selectedConnection)
            || !connection.website
            || (!selectedCharts || selectedCharts.length < 1)
          }
          onClick={_onGenerateDashboard}
          color="primary"
        >
          {loading ? <ButtonSpinner /> : null}
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

PlausibleTemplate.defaultProps = {
  addError: null,
};

PlausibleTemplate.propTypes = {
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  projectName: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired,
  connections: PropTypes.array.isRequired,
  addError: PropTypes.bool,
  onBack: PropTypes.func.isRequired,
};

export default PlausibleTemplate;
