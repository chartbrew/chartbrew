import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Divider, Input, Select, SelectItem, Spacer,
} from "@nextui-org/react";
import _ from "lodash";
import cookie from "react-cookies";
import { LuArrowRight, LuCheckCheck, LuPlus, LuX } from "react-icons/lu";
import { FcGoogle } from "react-icons/fc";

import {
  testRequest, addConnection, selectConnections,
} from "../../../slices/connection";
import { generateDashboard } from "../../../slices/project";
import { API_HOST } from "../../../config/settings";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import { useDispatch, useSelector } from "react-redux";

/*
  The Form used to configure the SimpleAnalytics template
*/
function GaTemplate(props) {
  const {
    teamId, projectId, addError, onComplete, selection,
  } = props;

  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState({ name: "Google analytics", type: "googleAnalytics" });
  const [errors, setErrors] = useState({});
  const [configuration, setConfiguration] = useState({
    accountId: "",
    propertyId: "",
  });
  const [selectedCharts, setSelectedCharts] = useState(false);
  const [availableConnections, setAvailableConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [formVisible, setFormVisible] = useState(true);
  const [accountOptions, setAccountOptions] = useState([]);
  const [propertyOptions, setPropertyOptions] = useState([]);
  const [accountsData, setAccountsData] = useState(null);

  const connections = useSelector(selectConnections);

  const dispatch = useDispatch();

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
  }, [selectedConnection]);

  useEffect(() => {
    if (accountsData && accountsData.length > 0) {
      const accountOpt = [];
      accountsData.forEach((acc) => {
        accountOpt.push({
          key: acc.account,
          value: acc.account,
          text: acc.displayName,
        });
      });

      setAccountOptions(accountOpt);
    }
  }, [accountsData]);

  useEffect(() => {
    if (configuration.accountId) {
      const acc = _.findLast(accountsData, { account: configuration.accountId });
      const propertyOpt = [];
      if (acc && acc.propertySummaries) {
        acc.propertySummaries.forEach((prop) => {
          propertyOpt.push({
            key: prop.property,
            value: prop.property,
            text: prop.displayName,
          });
        });
      }

      setPropertyOptions(propertyOpt);
    }
  }, [configuration.accountId]);

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

    dispatch(generateDashboard({ project_id: projectId, data, template: "googleAnalytics" }))
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
    return dispatch(testRequest({ team_id: teamId, connection: connectionObj }))
      .then((data) => {
        setAccountsData(data.payload);
      })
      .catch(() => {
        //
      });
  };

  const _onAccountSelected = (value) => {
    if (value !== configuration.accountId) {
      setPropertyOptions([]);
      setConfiguration({
        ...configuration,
        propertyId: "",
      });
    }

    setConfiguration({ ...configuration, accountId: value });
  };

  const _onPropertySelected = (value) => {
    setConfiguration({ ...configuration, propertyId: value });
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
    const data = await dispatch(addConnection({ team_id: teamId, connection }));
    const newConnection = data.payload;

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
      <Row align="center">
        <Text size="h3">Configure the template</Text>
      </Row>
      <Spacer y={2} />
      {availableConnections && availableConnections.length > 0 && (
        <>
          <Row align="center">
            <Select
              isDisabled={formVisible}
              label="Select an existing connection"
              placeholder="Click to select a connection"
              value={_getListName(availableConnections, selectedConnection, true)}
              selectedKeys={[selectedConnection]}
              onSelectionChange={(keys) => _onSelectConnection(keys.currentKey)}
              selectionMode="single"
              variant="bordered"
            >
              {availableConnections.map((connection) => (
                <SelectItem key={connection.key}>
                  {connection.text}
                </SelectItem>
              ))}
            </Select>
          </Row>
          <Spacer y={1} />
          <Row align="center">
            {!formVisible && (
              <Button
                variant="faded"
                startContent={<LuPlus />}
                onClick={() => setFormVisible(true)}
                color="primary"
                size="sm"
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
          <Spacer y={4} />

          <div className="grid grid-cols-12 gap-2">
            {selectedConnection && !formVisible && (
              <>
                <div className="col-span-12 md:col-span-6">
                  <Select
                    variant="bordered"
                    label="Account"
                    placeholder="Select an account"
                    value={_getListName(accountOptions, configuration.accountId)}
                    selectedKeys={[configuration.accountId]}
                    onSelectionChange={(keys) => _onAccountSelected(keys.currentKey)}
                    selectionMode="single"
                  >
                    {accountOptions.map((option) => (
                      <SelectItem key={option.key}>
                        {option.text}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="col-span-12 md:col-span-6">
                  <Select
                    isDisabled={!configuration.accountId}
                    variant="bordered"
                    label="Property"
                    placeholder="Select a property"
                    value={_getListName(propertyOptions, configuration.propertyId)}
                    selectedKeys={[configuration.propertyId]}
                    onSelectionChange={(keys) => _onPropertySelected(keys.currentKey)}
                    selectionMode="single"
                  >
                    {propertyOptions.map((option) => (
                      <SelectItem key={option.key}>
                        {option.text}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              </>
            )}
          </div>
        </>
      )}

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
              placeholder="Google analytics"
              label="Enter a name for your connection"
              value={connection.name || ""}
              onChange={(e) => {
                setConnection({ ...connection, name: e.target.value });
              }}
              variant="bordered"
              fullWidth
              color={errors.name ? "danger" : "default"}
              description={errors.name}
            />
          </Row>
          <Spacer y={2} />
          <Row align="center">
            <Button
              variant={"faded"}
              endContent={<FcGoogle />}
              onClick={_onGoogleAuth}
              color="secondary"
            >
              {"Authenticate with Google"}
            </Button>
          </Row>
          {errors.auth && (<Row><p>{errors.auth}</p></Row>)}
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
                <div className="col-span-12 md:col-span-6 lg:col-span-4 xl:col-span-3 flex items-center" key={chart.tid}>
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

      <Spacer y={8} />
      <Row>
        <Button
          isDisabled={
            (!formVisible && !selectedConnection)
            || !configuration.accountId
            || !configuration.propertyId
            || (!selectedCharts || selectedCharts.length < 1)
          }
          onClick={_onGenerateDashboard}
          color="primary"
          isLoading={loading}
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

GaTemplate.defaultProps = {
  addError: null,
  selection: -1,
};

GaTemplate.propTypes = {
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired,
  addError: PropTypes.bool,
  selection: PropTypes.number,
};

export default GaTemplate;
