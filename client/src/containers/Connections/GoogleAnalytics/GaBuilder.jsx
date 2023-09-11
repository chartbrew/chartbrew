import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Button, Popover, Divider, Input, Tooltip, Spacer, Chip, Checkbox,
  Select, SelectItem,
} from "@nextui-org/react";
import AceEditor from "react-ace";
import _ from "lodash";
import { toast } from "react-toastify";
import { Calendar } from "react-date-range";
import { format, sub } from "date-fns";
import { enGB } from "date-fns/locale";
import {
  InfoCircle, Play, Calendar as CalendarIcon, Delete,
} from "react-iconly";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";
import "ace-builds/webpack-resolver";

import {
  runDataRequest as runDataRequestAction,
} from "../../../actions/dataRequest";
import {
  testRequest as testRequestAction,
  getConnection as getConnectionAction,
} from "../../../actions/connection";
import { getMetadata } from "./apiBoilerplate";
import { secondary } from "../../../config/colors";
import Container from "../../../components/Container";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import useThemeDetector from "../../../modules/useThemeDetector";

const validDate = /[0-9]{4}-[0-9]{2}-[0-9]{2}|today|yesterday|[0-9]+(daysAgo)/g;
const validEndDate = /[0-9]{4}-[0-9]{2}-[0-9]{2}|today|yesterday|[0-9]+(daysAgo)/g;

/*
  The API Data Request builder
*/
function GaBuilder(props) {
  const {
    dataRequest, match, runDataRequest,
    connection, onSave, requests, testRequest, // eslint-disable-line
    getConnection, onDelete, responses,
  } = props;

  const [gaRequest, setGaRequest] = useState({});
  const [configuration, setConfiguration] = useState({
    accountId: "",
    propertyId: "",
    filters: [],
    metrics: "",
    startDate: "30daysAgo",
    endDate: "yesterday",
  });
  const [result, setResult] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [accountOptions, setAccountOptions] = useState([]);
  const [propertyOptions, setPropertyOptions] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [dateHelp, setDateHelp] = useState(false);
  const [metricsOptions, setMetricsOptions] = useState([]);
  const [dimensionsOptions, setDimensionsOptions] = useState([]);
  const [invalidateCache, setInvalidateCache] = useState(false);
  const [fullConnection, setFullConnection] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const isDark = useThemeDetector();

  useEffect(() => {
    _initRequest();
  }, [dataRequest]);

  useEffect(() => {
    if (connection?.id && !fullConnection?.id) {
      getConnection(match.params.projectId, connection.id)
        .then((data) => {
          setFullConnection(data);
          _onFetchAccountData(data);
        })
        .catch(() => {});
    }
  }, [connection]);

  useEffect(() => {
    if (accountOptions.length > 0
      && dataRequest.configuration
      && dataRequest.configuration.accountId
      && !configuration.accountId
    ) {
      setConfiguration({ ...configuration, accountId: dataRequest.configuration.accountId });
    }
  }, [accountOptions, configuration.accountId]);

  useEffect(() => {
    if (propertyOptions.length > 0
      && dataRequest.configuration
      && dataRequest.configuration.propertyId
      && configuration.accountId
    ) {
      setConfiguration({ ...configuration, propertyId: dataRequest.configuration.propertyId });
    }
  }, [propertyOptions]);

  useEffect(() => {
    if (analyticsData && analyticsData.length > 0) {
      const accountOpt = [];
      analyticsData.forEach((acc) => {
        accountOpt.push({
          key: acc.account,
          value: acc.account,
          text: acc.displayName,
        });
      });

      setAccountOptions(accountOpt);
    }
  }, [analyticsData]);

  useEffect(() => {
    if (configuration.accountId) {
      const acc = _.findLast(analyticsData, { account: configuration.accountId });
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
    if (metricsOptions.length > 0
      && gaRequest.configuration
      && gaRequest.configuration.metrics
    ) {
      setConfiguration({ ...configuration, metrics: gaRequest.configuration.metrics });
    }

    if (dimensionsOptions.length > 0
      && gaRequest.configuration
      && gaRequest.configuration.dimensions
    ) {
      setConfiguration({ ...configuration, dimensions: gaRequest.configuration.dimensions });
    }
  }, [metricsOptions, dimensionsOptions]);

  useEffect(() => {
    if (responses && responses.length > 0) {
      const selectedResponse = responses.find((o) => o.id === dataRequest.id);
      if (selectedResponse?.data) {
        setResult(JSON.stringify(selectedResponse.data, null, 2));
      }
    }
  }, [responses]);

  const _initRequest = () => {
    if (dataRequest) {
      setGaRequest(dataRequest);

      if (dataRequest?.configuration?.startDate && dataRequest?.configuration?.endDate) {
        setConfiguration({
          ...configuration,
          startDate: dataRequest.configuration.startDate,
          endDate: dataRequest.configuration.endDate,
        });
      }

      if (dataRequest?.configuration?.metrics) {
        setConfiguration({
          ...configuration,
          metrics: dataRequest.configuration.metrics,
        });
      }

      if (dataRequest?.configuration?.dimensions) {
        setConfiguration({
          ...configuration,
          dimensions: dataRequest.configuration.dimensions,
        });
      }

      if (dataRequest?.configuration?.propertyId) {
        _populateMetadata(connection, dataRequest.configuration.propertyId);
      }
    }
  };

  const _populateMetadata = (conn = fullConnection, propertyId) => {
    getMetadata(match.params.projectId, conn.id, propertyId)
      .then((metadata) => {
        const metrics = [];
        const dimensions = [];
        if (metadata?.metrics?.length > 0) {
          metadata.metrics.forEach((m) => {
            metrics.push({
              ...m, text: m.uiName, key: m.apiName, value: m.apiName
            });
          });
        }

        if (metadata?.dimensions?.length > 0) {
          metadata.dimensions.forEach((d) => {
            dimensions.push({
              ...d, text: d.uiName, key: d.apiName, value: d.apiName
            });
          });
        }

        setMetricsOptions(metrics);
        setDimensionsOptions(dimensions);
      });
  };

  const _onTest = (request = gaRequest) => {
    setRequestLoading(true);
    _onChangeRequest({ configuration });

    if (request === null) request = gaRequest;
    const requestToSave = { ...request, configuration };
    onSave(requestToSave).then(() => {
      _onRunRequest();
    });
  };

  const _onRunRequest = () => {
    const useCache = !invalidateCache;
    runDataRequest(match.params.projectId, match.params.chartId, dataRequest.id, useCache)
      .then(() => {
        setRequestLoading(false);
      })
      .catch((error) => {
        setRequestLoading(false);
        toast.error("The request failed. Please check your request 🕵️‍♂️");
        setResult(JSON.stringify(error, null, 2));
      });
  };

  const _onFetchAccountData = (conn = fullConnection) => {
    setCollectionsLoading(true);
    return testRequest(match.params.projectId, conn)
      .then((data) => {
        return data.json();
      })
      .then((data) => {
        setCollectionsLoading(false);
        setAnalyticsData(data);
        _initRequest();
      })
      .catch(() => {
        setCollectionsLoading(false);
      });
  };

  const _onChangeRequest = (data) => {
    const changeErrors = {};
    // validation
    if (data.configuration.startDate && !validDate.test(data.configuration.startDate)) {
      changeErrors.startDate = true;
    }
    if (data.configuration.endDate && !validEndDate.test(data.configuration.endDate)) {
      changeErrors.endDate = true;
    }
    if (!data.configuration.metrics) {
      changeErrors.metrics = true;
    }

    setFormErrors(changeErrors);

    if (Object.keys(changeErrors).length > 0) {
      return;
    }

    onSave({ ...gaRequest, ...data });
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
    _populateMetadata(connection, value);
  };

  const _renderCalendar = (type) => (
    <div>
      <Popover>
        <Popover.Trigger>
          <Button
            icon={<CalendarIcon set="bold" />}
            css={{ minWidth: "fit-content" }}
            bordered
            color="secondary"
            disabled={!configuration.propertyId}
          />
        </Popover.Trigger>
        <Popover.Content>
          <Calendar
            date={_getDateForCalendar(configuration[type])}
            onChange={(date) => {
              setConfiguration({ ...configuration, [type]: format(date, "yyyy-MM-dd") });
            }}
            locale={enGB}
            color={secondary}
          />
        </Popover.Content>
      </Popover>
    </div>
  );

  const _getDateForCalendar = (value) => {
    const checkDaysAgo = /[0-9]+daysAgo/g;
    const shortDateFormat = /[0-9]{4}-[0-9]{2}-[0-9]{2}/g;

    if (checkDaysAgo.test(value)) {
      const days = value.substring(0, value.indexOf("days"));
      const newDate = sub(new Date(), { days });
      return newDate;
    }

    if (shortDateFormat.test(value)) {
      return new Date(value);
    }

    if (value === "yesterday") {
      return sub(new Date(), { days: 1 });
    }

    if (value === "today" || !value) {
      return new Date();
    }

    return false;
  };

  const _onSavePressed = () => {
    setSaveLoading(true);
    onSave(gaRequest).then(() => {
      setSaveLoading(false);
    }).catch(() => {
      setSaveLoading(false);
    });
  };

  return (
    <div style={styles.container}>
      <div className="grid grid-cols-12">
        <div className="col-span-7 sm:col-span-12">
          <Container>
            <div className="grid grid-cols-12 gap-1">
              <div className="col-span-12 flex justify-between">
                <Text b size={"lg"}>{connection.name}</Text>
                <div>
                  <Row>
                    <Button
                      color="primary"
                      auto
                      size="sm"
                      onClick={() => _onSavePressed()}
                      isLoading={saveLoading || requestLoading}
                      variant="flat"
                    >
                      {"Save"}
                    </Button>
                    <Spacer x={0.6} />
                    <Tooltip content="Delete this data request" placement="bottom" css={{ zIndex: 99999 }}>
                      <Button
                        color="danger"
                        isIconOnly
                        auto
                        size="sm"
                        variant="bordered"
                        onClick={() => onDelete()}
                      >
                        <Delete />
                      </Button>
                    </Tooltip>
                  </Row>
                </div>
              </div>
              <div className="col-span-12">
                <Divider />
              </div>
              <div className="col-span-6 sm:col-span-12 gabuilder-collections-tut">
                <Select
                  variant="bordered"
                  selectedKeys={[configuration.accountId]}
                  placeholder="Select an account"
                  label="Account"
                  isLoading={collectionsLoading}
                  value={
                    (accountOptions
                      && configuration.accountId
                      && accountOptions.find((a) => a.value === configuration.accountId)?.text)
                    || "Select an account"
                  }
                  onSelectionChange={(key) => _onAccountSelected(key)}
                  selectionMode="single"
                >
                  {accountOptions.map((account) => (
                    <SelectItem key={account.value}>
                      {account.text}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <div className="col-span-6 sm:col-span-12">
                <Select
                  isDisabled={!configuration.accountId}
                  variant="bordered"
                  isLoading={collectionsLoading}
                  selectedKeys={[configuration.propertyId]}
                  placeholder="Select a property"
                  label="Property"
                  value={
                    (propertyOptions
                      && configuration.propertyId
                      && propertyOptions.find((p) => p.value === configuration.propertyId)?.text)
                    || "Select a property"
                  }
                  onSelectionChange={(key) => _onPropertySelected(key)}
                  selectionMode="single"
                >
                  {propertyOptions.map((property) => (
                    <SelectItem key={property.value}>
                      {property.text}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <div className="col-span-12 gabuilder-query-tut">
                <div style={styles.row}>
                  <Text>
                    {"Choose a metric "}
                  </Text>
                  <Spacer x={0.5} />
                  <Tooltip
                    content="You can add multiple metrics by creating another dataset for this chart. Click on 'Build chart', then 'Add new dataset' on the right."
                    css={{ zIndex: 10000, maxWidth: 500 }}
                    className="max-w-[500px]"
                    placement="right-start"
                  >
                    <InfoCircle size="small" />
                  </Tooltip>
                </div>
                <Select
                  isDisabled={!configuration.propertyId}
                  variant="bordered"
                  isLoading={collectionsLoading}
                  selectedKeys={[configuration.metrics]}
                  placeholder="Select a metric"
                  errorMessage={formErrors.metrics}
                  color={formErrors.metrics ? "danger" : "default"}
                  value={
                    (metricsOptions
                      && configuration.metrics
                      && metricsOptions.find((m) => m.value === configuration.metrics)?.text)
                    || "Select a metric"
                  }
                  onSelectionChange={(key) => setConfiguration({ ...configuration, metrics: key })}
                  selectionMode="single"
                >
                  {metricsOptions.map((item) => {
                    return (
                      <SelectItem
                        key={item.key}
                        endContent={item.category}
                        description={item.description}
                      >
                        <Text>
                          {item.text}
                          <Text small className={"text-default-400"}>
                            {" - "}
                            {item.key}
                          </Text>
                        </Text>
                      </SelectItem>
                    );
                  })}
                </Select>
              </div>
              <div className="col-span-12">
                <Text>Choose a dimension</Text>
                <Select
                  isDisabled={!configuration.propertyId}
                  variant="bordered"
                  selectedKeys={[configuration.dimensions]}
                  onSelectionChange={(key) => setConfiguration({ ...configuration, dimensions: key })}
                  selectionMode="single"
                  placeholder="Select a dimension"
                  errorMessage={formErrors.dimensions}
                  color={formErrors.dimensions ? "danger" : "default"}
                  value={
                    (dimensionsOptions
                      && configuration.dimensions
                      && dimensionsOptions
                        .find((d) => d.value === configuration.dimensions)?.text)
                    || "Select a dimension"
                  }
                >
                  {dimensionsOptions.map((item) => {
                    return (
                      <SelectItem
                        key={item.key}
                        endContent={item.category}
                        description={item.description}
                      >
                        <Text>{item.text}</Text>
                      </SelectItem>
                    );
                  })}
                </Select>
              </div>
              <div className="col-span-12">
                <Text>Start date</Text>
                <Input
                  endContent={_renderCalendar("startDate")}
                  placeholder="YYYY-MM-DD"
                  value={configuration.startDate}
                  disabled={!configuration.propertyId}
                  onChange={(e) => {
                    setConfiguration({ ...configuration, startDate: e.target.value });
                  }}
                  variant="bordered"
                  fullWidth
                />
                <Spacer y={0.5} />
                <div style={styles.row}>
                  <Chip
                    is="a"
                    onClick={() => setConfiguration({ ...configuration, startDate: "today" })}
                  >
                    today
                  </Chip>
                  <Spacer x={0.5} />
                  <Chip
                    is="a"
                    onClick={() => setConfiguration({ ...configuration, startDate: "yesterday" })}
                  >
                    yesterday
                  </Chip>
                  <Spacer x={0.5} />
                  <Chip
                    is="a"
                    onClick={() => setConfiguration({ ...configuration, startDate: "30daysAgo" })}
                    variant="default"
                  >
                    30daysAgo
                  </Chip>
                  <Spacer x={0.5} />
                  <Chip
                    is="a"
                    onClick={() => setDateHelp(!dateHelp)}
                    variant="flat"
                    color={dateHelp ? "secondary" : "default"}
                    size="sm"
                  >
                    <InfoCircle size="small" />
                    <Spacer x={0.3} />
                    <span>info</span>
                  </Chip>
                </div>
              </div>
              <div className="col-span-12">
                <Text>End date</Text>
                <Input
                  endContent={_renderCalendar("endDate")}
                  placeholder="YYYY-MM-DD"
                  value={configuration.endDate}
                  disabled={!configuration.propertyId}
                  onChange={(e) => {
                    setConfiguration({ ...configuration, endDate: e.target.value });
                  }}
                  variant="bordered"
                  fullWidth
                />
                <Spacer y={0.5} />
                <div style={styles.row}>
                  <Chip
                    is="a"
                    onClick={() => setConfiguration({ ...configuration, endDate: "today" })}
                  >
                    today
                  </Chip>
                  <Spacer x={0.5} />
                  <Chip
                    is="a"
                    onClick={() => setConfiguration({ ...configuration, endDate: "yesterday" })}
                  >
                    yesterday
                  </Chip>
                  <Spacer x={0.5} />
                  <Chip
                    is="a"
                    onClick={() => setConfiguration({ ...configuration, endDate: "30daysAgo" })}
                  >
                    30daysAgo
                  </Chip>
                  <Spacer x={0.5} />
                  <Chip
                    is="a"
                    onClick={() => setDateHelp(!dateHelp)}
                    variant="flat"
                    color={dateHelp ? "secondary" : "default"}
                    size="sm"
                  >
                    <InfoCircle size="small" />
                    <Spacer x={0.3} />
                    <span>info</span>
                  </Chip>
                </div>
              </div>
              {dateHelp && (
                <div className="col-span-12">
                  <Container
                    className={"bg-content2 rounded-md p-10 pl-15 pr-15"}
                  >
                    <Row>
                      <Text>{"You can use relative dates such as "}</Text>
                      <Spacer x={0.3} />
                      <code>today</code>
                      <Spacer x={0.3} />
                      <Text>{", "}</Text>
                      <Spacer x={0.3} />
                      <code>yesterday</code>
                      <Spacer x={0.3} />
                      <Text>{", and "}</Text>
                      <Spacer x={0.3} />
                      <code>NdaysAgo</code>
                    </Row>
                    <Row>
                      <Text>{"Alternatively, you can type in any date in YYYY-MM-DD format or use the calendar picker next to each field."}</Text>
                    </Row>
                  </Container>
                </div>
              )}
            </div>
          </Container>
        </div>
        <div className="col-span-5 sm:col-span-12">
          <Container>
            <Row className="gabuilder-request-tut">
              <Button
                endContent={<Play />}
                isLoading={requestLoading}
                onClick={() => _onTest()}
                className="w-full"
                variant="shadow"
              >
                Get analytics data
              </Button>
            </Row>
            <Spacer y={1} />
            <Row align="center">
              <Checkbox
                label="Use cache"
                isSelected={!invalidateCache}
                onChange={() => setInvalidateCache(!invalidateCache)}
                size="sm"
              />
              <Spacer x={0.5} />
              <Tooltip
                content="Chartbrew will cache the data to make the edit process faster. The cache will be cleared when you change any of the settings."
                className="max-w-[500px]"
              >
                <InfoCircle size="small" />
              </Tooltip>
            </Row>
            <Spacer y={1} />
            <Row className="gabuilder-result-tut">
              <div className="w-full">
                <AceEditor
                  mode="json"
                  theme={isDark ? "one_dark" : "tomorrow"}
                  style={{ borderRadius: 10 }}
                  height="450px"
                  width="none"
                  value={result || ""}
                  name="resultEditor"
                  readOnly
                  editorProps={{ $blockScrolling: false }}
                />
              </div>
            </Row>
            <Spacer y={1} />
            <Row align="center">
              <InfoCircle size="small" />
              <Spacer x={0.5} />
              <Text small>
                {"This is a preview and it might not show all data in order to keep things fast in the UI."}
              </Text>
            </Row>
          </Container>
        </div>
      </div>
    </div>
  );
}
const styles = {
  container: {
    flex: 1,
  },
  row: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  column: {
    display: "flex",
    flexDirection: "column",
  }
};

GaBuilder.defaultProps = {
  dataRequest: null,
};

GaBuilder.propTypes = {
  connection: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  runDataRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  requests: PropTypes.array.isRequired,
  dataRequest: PropTypes.object,
  testRequest: PropTypes.func.isRequired,
  getConnection: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  responses: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => {
  return {
    responses: state.dataRequest.responses,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    runDataRequest: (projectId, chartId, drId, getCache) => {
      return dispatch(runDataRequestAction(projectId, chartId, drId, getCache));
    },
    testRequest: (projectId, data) => dispatch(testRequestAction(projectId, data)),
    getConnection: (projectId, connectionId) => (
      dispatch(getConnectionAction(projectId, connectionId))
    ),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(GaBuilder));
