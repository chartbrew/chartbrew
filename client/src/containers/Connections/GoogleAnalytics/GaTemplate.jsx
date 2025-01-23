import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Select, SelectItem, Spacer,
} from "@heroui/react";
import _ from "lodash";
import cookie from "react-cookies";
import { LuArrowLeft, LuArrowRight, LuCheckCheck, LuPlus, LuX } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";

import {
  testRequest, selectConnections,
} from "../../../slices/connection";
import { createProject, generateDashboard } from "../../../slices/project";
import { API_HOST } from "../../../config/settings";
import Text from "../../../components/Text";
import Row from "../../../components/Row";

/*
  The Form used to configure the SimpleAnalytics template
*/
function GaTemplate(props) {
  const {
    teamId, projectId, addError, onComplete, selection, onBack, projectName,
  } = props;

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [configuration, setConfiguration] = useState({
    accountId: "",
    propertyId: "",
  });
  const [selectedCharts, setSelectedCharts] = useState(false);
  const [availableConnections, setAvailableConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [accountOptions, setAccountOptions] = useState([]);
  const [propertyOptions, setPropertyOptions] = useState([]);
  const [accountsData, setAccountsData] = useState(null);

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

  const _onGenerateDashboard = async () => {
    if (!projectId && !projectName) {
      return;
    }

    setErrors({});

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
      team_id: teamId, charts: selectedCharts, configuration
    };
    if (selectedConnection) {
      data.connection_id = selectedConnection;
    }

    setLoading(true);

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

    dispatch(generateDashboard({ project_id: newProjectId, data, template: "googleAnalytics" }))
      .then(() => {
        setTimeout(() => {
          navigate(`/${teamId}/${newProjectId}/dashboard`);
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
  };

  const _onSelectConnection = (value) => {
    setSelectedConnection(value);

    // get the accounts
    const connectionObj = connections.filter((c) => c.id === parseInt(value, 10))[0];
    return dispatch(testRequest({ team_id: teamId, connection: connectionObj }))
      .then((data) => {
        return data.payload.json();
      })
      .then((data) => {
        setAccountsData(data);
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
      <Spacer y={4} />
      {!availableConnections || availableConnections.length === 0 && (
        <>
          <Row align="center">
            <Text b>
              {"You don't have any Google Analytics connections. Please create one first"}
            </Text>
          </Row>
          <Spacer y={2} />
          <Row align="center">
            <Button
              color="primary"
              variant="ghost"
              onClick={() => navigate(`/${teamId}/connection/new?type=googleAnalytics`)}
              startContent={<LuPlus />}
            >
              {"Create a new Google Analytics connection"}
            </Button>
          </Row>
        </>
      )}
      {availableConnections && availableConnections.length > 0 && (
        <>
          <Row align="center" className={"gap-2"}>
            <Select
              label="Select a connection"
              placeholder="Click to select a connection"
              renderValue={_getListName(availableConnections, selectedConnection, true)}
              selectedKeys={[selectedConnection]}
              onSelectionChange={(keys) => _onSelectConnection(keys.currentKey)}
              selectionMode="single"
              variant="bordered"
              fullWidth
              aria-label="Select a connection"
            >
              {availableConnections.map((connection) => (
                <SelectItem key={connection.key} textValue={connection.text}>
                  {connection.text}
                </SelectItem>
              ))}
            </Select>
            
            <Button
              variant="ghost"
              onClick={() => navigate(`/${teamId}/connection/new?type=googleAnalytics`)}
              startContent={<LuPlus />}
              className="min-w-[200px]"
            >
              {"Or create new"}
            </Button>
          </Row>
          <Spacer y={4} />

          <div className="grid grid-cols-12 gap-2">
            {selectedConnection && (
              <>
                <div className="col-span-12 md:col-span-6">
                  <Select
                    variant="bordered"
                    label="Account"
                    placeholder="Select an account"
                    renderValue={_getListName(accountOptions, configuration.accountId)}
                    selectedKeys={[configuration.accountId]}
                    onSelectionChange={(keys) => _onAccountSelected(keys.currentKey)}
                    selectionMode="single"
                    aria-label="Select an account"
                  >
                    {accountOptions.map((option) => (
                      <SelectItem key={option.key} textValue={option.text}>
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
                    aria-label="Select a property"
                  >
                    {propertyOptions.map((option) => (
                      <SelectItem key={option.key} textValue={option.text}>
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
            !selectedConnection
            || !projectName
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
  projectName: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired,
  addError: PropTypes.bool,
  selection: PropTypes.number,
  onBack: PropTypes.func.isRequired,
};

export default GaTemplate;
