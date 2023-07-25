import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Button, Popover, Container, Row, Text, Divider, Dropdown,
  Input, Loading, Tooltip, Spacer, Badge, useTheme, Checkbox,
} from "@nextui-org/react";
import AceEditor from "react-ace";
import _ from "lodash";
import { toast } from "react-toastify";
import { Calendar } from "react-date-range";
import { format, sub } from "date-fns";
import { enGB } from "date-fns/locale";
import {
  ChevronDown, InfoCircle, Play, Calendar as CalendarIcon, Delete,
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

  const { isDark } = useTheme();

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

    if (request === null) request = gaRequest; // eslint-disable-line
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
      <Grid.Container>
        <Grid xs={12} sm={7} md={7}>
          <Container>
            <Grid.Container gap={1}>
              <Grid xs={12} justify={"space-between"}>
                <Text b size={22}>{connection.name}</Text>
                <div>
                  <Row>
                    <Button
                      color="primary"
                      auto
                      size="sm"
                      onClick={() => _onSavePressed()}
                      disabled={saveLoading || requestLoading}
                      flat
                    >
                      {(!saveLoading && !requestLoading) && "Save"}
                      {(saveLoading || requestLoading) && <Loading type="points-opacity" />}
                    </Button>
                    <Spacer x={0.3} />
                    <Tooltip content="Delete this data request" placement="bottom" css={{ zIndex: 99999 }}>
                      <Button
                        color="error"
                        icon={<Delete />}
                        auto
                        size="sm"
                        bordered
                        css={{ minWidth: "fit-content" }}
                        onClick={() => onDelete()}
                      />
                    </Tooltip>
                  </Row>
                </div>
              </Grid>
              <Grid xs={12}>
                <Divider />
              </Grid>
              <Grid xs={12} sm={6} className="gabuilder-collections-tut">
                <Dropdown isBordered>
                  <Dropdown.Trigger>
                    <Input
                      label="Account"
                      placeholder="Select an account"
                      contentRight={collectionsLoading ? <Loading type="spinner" /> : <ChevronDown set="light" />}
                      bordered
                      animated={false}
                      fullWidth
                      value={
                        (accountOptions
                        && configuration.accountId
                        && accountOptions.find((a) => a.value === configuration.accountId)?.text)
                        || "Select an account"
                      }
                    />
                  </Dropdown.Trigger>
                  <Dropdown.Menu
                    onAction={(key) => _onAccountSelected(key)}
                    selectedKeys={[configuration.accountId]}
                    selectionMode="single"
                  >
                    {accountOptions.map((account) => (
                      <Dropdown.Item key={account.value}>
                        {account.text}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </Grid>
              <Grid xs={12} sm={6}>
                <Dropdown isDisabled={!configuration.accountId} isBordered>
                  <Dropdown.Trigger>
                    <Input
                      label="Property"
                      placeholder="Select a property"
                      contentRight={collectionsLoading ? <Loading type="spinner" /> : <ChevronDown set="light" />}
                      bordered
                      animated={false}
                      fullWidth
                      disabled={!configuration.accountId}
                      value={
                        (propertyOptions
                        && configuration.propertyId
                        && propertyOptions.find((p) => p.value === configuration.propertyId)?.text)
                        || "Select a property"
                      }
                    />
                  </Dropdown.Trigger>
                  <Dropdown.Menu
                    onAction={(key) => _onPropertySelected(key)}
                    selectedKeys={[configuration.propertyId]}
                    selectionMode="single"
                    css={{ minWidth: "max-content" }}
                  >
                    {propertyOptions.map((property) => (
                      <Dropdown.Item key={property.value}>
                        {property.text}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </Grid>
              <Grid xs={12} className="gabuilder-query-tut" direction="column">
                <div style={styles.row}>
                  <Text size={16}>
                    {"Choose a metric "}
                  </Text>
                  <Spacer x={0.2} />
                  <Tooltip
                    content="You can add multiple metrics by creating another dataset for this chart. Click on 'Build chart', then 'Add new dataset' on the right."
                    css={{ zIndex: 10000, maxWidth: 500 }}
                    placement="rightStart"
                  >
                    <InfoCircle size="small" />
                  </Tooltip>
                </div>
                <Dropdown isDisabled={!configuration.propertyId}>
                  <Dropdown.Trigger>
                    <Input
                      placeholder="Select a metric"
                      contentRight={collectionsLoading ? <Loading type="spinner" /> : <ChevronDown set="light" />}
                      bordered
                      animated={false}
                      fullWidth
                      helperColor="error"
                      helperText={formErrors.metrics}
                      color={formErrors.metrics ? "error" : "default"}
                      disabled={!configuration.propertyId}
                      value={
                        (metricsOptions
                        && configuration.metrics
                        && metricsOptions.find((m) => m.value === configuration.metrics)?.text)
                        || "Select a metric"
                      }
                    />
                  </Dropdown.Trigger>
                  <Dropdown.Menu
                    onAction={(key) => setConfiguration({ ...configuration, metrics: key })}
                    selectedKeys={[configuration.metrics]}
                    selectionMode="single"
                    css={{ minWidth: "max-content" }}
                  >
                    {metricsOptions.map((item) => {
                      return (
                        <Dropdown.Item
                          key={item.key}
                          command={item.category}
                          description={item.description}
                        >
                          <Text size={16}>
                            {item.text}
                            <Text small color="$accents8">
                              {" - "}
                              {item.key}
                            </Text>
                          </Text>
                        </Dropdown.Item>
                      );
                    })}
                  </Dropdown.Menu>
                </Dropdown>
              </Grid>
              <Grid xs={12} direction="column">
                <Text size={16}>Choose a dimension</Text>

                <Dropdown isDisabled={!configuration.propertyId} isBordered>
                  <Dropdown.Trigger>
                    <Input
                      placeholder="Select a dimension"
                      contentRight={collectionsLoading ? <Loading type="spinner" /> : <ChevronDown set="light" />}
                      bordered
                      animated={false}
                      fullWidth
                      helperColor="error"
                      helperText={formErrors.dimensions}
                      color={formErrors.dimensions ? "error" : "default"}
                      disabled={!configuration.propertyId}
                      value={
                        (dimensionsOptions
                        && configuration.dimensions
                        && dimensionsOptions
                          .find((d) => d.value === configuration.dimensions)?.text)
                        || "Select a dimension"
                      }
                    />
                  </Dropdown.Trigger>
                  <Dropdown.Menu
                    onAction={(key) => setConfiguration({ ...configuration, dimensions: key })}
                    selectedKeys={[configuration.dimensions]}
                    selectionMode="single"
                    css={{ minWidth: "max-content" }}
                  >
                    {dimensionsOptions.map((item) => {
                      return (
                        <Dropdown.Item
                          key={item.key}
                          command={item.category}
                          description={item.description}
                        >
                          <Text size={16}>{item.text}</Text>
                        </Dropdown.Item>
                      );
                    })}
                  </Dropdown.Menu>
                </Dropdown>
              </Grid>
              <Grid xs={12} direction="column">
                <Text size={16}>Start date</Text>
                <Input
                  contentRight={_renderCalendar("startDate")}
                  contentRightStyling={false}
                  placeholder="YYYY-MM-DD"
                  value={configuration.startDate}
                  disabled={!configuration.propertyId}
                  onChange={(e) => {
                    setConfiguration({ ...configuration, startDate: e.target.value });
                  }}
                  bordered
                  fullWidth
                />
                <Spacer y={0.2} />
                <div style={styles.row}>
                  <Badge
                    as="a"
                    onClick={() => setConfiguration({ ...configuration, startDate: "today" })}
                  >
                    today
                  </Badge>
                  <Spacer x={0.2} />
                  <Badge
                    as="a"
                    onClick={() => setConfiguration({ ...configuration, startDate: "yesterday" })}
                  >
                    yesterday
                  </Badge>
                  <Spacer x={0.2} />
                  <Badge
                    as="a"
                    onClick={() => setConfiguration({ ...configuration, startDate: "30daysAgo" })}
                    variant="default"
                  >
                    30daysAgo
                  </Badge>
                  <Spacer x={0.2} />
                  <Badge
                    as="a"
                    onClick={() => setDateHelp(!dateHelp)}
                    variant="flat"
                    color={dateHelp ? "secondary" : "default"}
                    size="sm"
                  >
                    <InfoCircle size="small" />
                    <Spacer x={0.1} />
                    <span>info</span>
                  </Badge>
                </div>
              </Grid>
              <Grid xs={12} direction="column">
                <Text size={16}>End date</Text>
                <Input
                  contentRight={_renderCalendar("endDate")}
                  contentRightStyling={false}
                  placeholder="YYYY-MM-DD"
                  value={configuration.endDate}
                  disabled={!configuration.propertyId}
                  onChange={(e) => {
                    setConfiguration({ ...configuration, endDate: e.target.value });
                  }}
                  bordered
                  fullWidth
                />
                <Spacer y={0.2} />
                <div style={styles.row}>
                  <Badge
                    as="a"
                    onClick={() => setConfiguration({ ...configuration, endDate: "today" })}
                    disableOutline
                  >
                    today
                  </Badge>
                  <Spacer x={0.2} />
                  <Badge
                    as="a"
                    onClick={() => setConfiguration({ ...configuration, endDate: "yesterday" })}
                    disableOutline
                  >
                    yesterday
                  </Badge>
                  <Spacer x={0.2} />
                  <Badge
                    as="a"
                    onClick={() => setConfiguration({ ...configuration, endDate: "30daysAgo" })}
                    disableOutline
                  >
                    30daysAgo
                  </Badge>
                  <Spacer x={0.2} />
                  <Badge
                    as="a"
                    onClick={() => setDateHelp(!dateHelp)}
                    variant="flat"
                    color={dateHelp ? "secondary" : "default"}
                    size="sm"
                    disableOutline
                  >
                    <InfoCircle size="small" />
                    <Spacer x={0.1} />
                    <span>info</span>
                  </Badge>
                </div>
              </Grid>
              {dateHelp && (
                <Grid xs={12}>
                  <Container
                    css={{
                      backgroundColor: "$accents1", br: 20, p: 10, pl: 15, pr: 15
                    }}
                  >
                    <Row>
                      <Text>{"You can use relative dates such as "}</Text>
                      <Spacer x={0.1} />
                      <code>today</code>
                      <Spacer x={0.1} />
                      <Text>{", "}</Text>
                      <Spacer x={0.1} />
                      <code>yesterday</code>
                      <Spacer x={0.1} />
                      <Text>{", and "}</Text>
                      <Spacer x={0.1} />
                      <code>NdaysAgo</code>
                    </Row>
                    <Row>
                      <Text>{"Alternatively, you can type in any date in YYYY-MM-DD format or use the calendar picker next to each field."}</Text>
                    </Row>
                  </Container>
                </Grid>
              )}
            </Grid.Container>
          </Container>
        </Grid>
        <Grid xs={12} sm={5} md={5}>
          <Container>
            <Row className="gabuilder-request-tut">
              <Button
                iconRight={requestLoading ? <Loading type="spinner" /> : <Play />}
                disabled={requestLoading}
                onClick={() => _onTest()}
                css={{ width: "100%" }}
                shadow
              >
                Get analytics data
              </Button>
            </Row>
            <Spacer y={0.5} />
            <Row align="center">
              <Checkbox
                label="Use cache"
                isSelected={!invalidateCache}
                onChange={() => setInvalidateCache(!invalidateCache)}
                size="sm"
              />
              <Spacer x={0.2} />
              <Tooltip
                content="Chartbrew will cache the data to make the edit process faster. The cache will be cleared when you change any of the settings."
                css={{ zIndex: 10000, maxWidth: 500 }}
              >
                <InfoCircle size="small" />
              </Tooltip>
            </Row>
            <Spacer y={0.5} />
            <Row className="gabuilder-result-tut">
              <div style={{ width: "100%" }}>
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
            <Spacer y={0.5} />
            <Row align="center">
              <InfoCircle size="small" />
              <Spacer x={0.2} />
              <Text small>
                {"This is a preview and it might not show all data in order to keep things fast in the UI."}
              </Text>
            </Row>
          </Container>
        </Grid>
      </Grid.Container>
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
