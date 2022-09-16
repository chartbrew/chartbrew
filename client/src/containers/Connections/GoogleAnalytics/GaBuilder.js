import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Button, Popover, Container, Row, Text, Divider, Dropdown,
  Input, Loading, Tooltip, Spacer, Badge, useTheme,
} from "@nextui-org/react";
import AceEditor from "react-ace";
import _ from "lodash";
import { toast } from "react-toastify";
import { Calendar } from "react-date-range";
import { format, sub } from "date-fns";
import { enGB } from "date-fns/locale";
import {
  ChevronDown, InfoCircle, Play, Calendar as CalendarIcon,
} from "react-iconly";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";
import "ace-builds/webpack-resolver";

import {
  runRequest as runRequestAction,
} from "../../../actions/dataset";
import {
  testRequest as testRequestAction,
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
    dataRequest, match, runRequest, dataset,
    connection, onSave, requests, testRequest, // eslint-disable-line
  } = props;

  const [gaRequest, setGaRequest] = useState({});
  const [configuration, setConfiguration] = useState({
    accountId: "",
    propertyId: "",
    viewId: "",
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
  const [viewOptions, setViewOptions] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [dateHelp, setDateHelp] = useState(false);

  const [metricsOptions, setMetricsOptions] = useState([]);
  const [dimensionsOptions, setDimensionsOptions] = useState([]);

  const { isDark } = useTheme();

  // on init effect
  useEffect(() => {
    _onFetchAccountData();
    _populateMetadata();
  }, []);

  useEffect(() => {
    _initRequest();
  }, [dataRequest]);

  useEffect(() => {
    if (accountOptions.length > 0
      && dataRequest.configuration
      && dataRequest.configuration.accountId
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
    if (accountOptions.length > 0
      && dataRequest.configuration
      && dataRequest.configuration.viewId
      && configuration.propertyId
    ) {
      setConfiguration({ ...configuration, viewId: dataRequest.configuration.viewId });
    }
  }, [viewOptions, configuration.propertyId]);

  useEffect(() => {
    if (analyticsData && analyticsData.username) {
      if (analyticsData.items && analyticsData.items.length > 0) {
        const accountOpt = [];
        analyticsData.items.forEach((acc) => {
          accountOpt.push({
            key: acc.id,
            value: acc.id,
            text: acc.name,
          });
        });

        setAccountOptions(accountOpt);
      }
    }
  }, [analyticsData]);

  useEffect(() => {
    if (configuration.accountId) {
      const acc = _.findLast(analyticsData.items, { id: configuration.accountId });
      const propertyOpt = [];
      if (acc && acc.webProperties) {
        acc.webProperties.forEach((prop) => {
          propertyOpt.push({
            key: prop.id,
            value: prop.id,
            text: prop.name,
          });
        });
      }

      setPropertyOptions(propertyOpt);
    }
  }, [configuration.accountId]);

  useEffect(() => {
    if (configuration.propertyId && configuration.accountId) {
      const acc = _.findLast(analyticsData.items, { id: configuration.accountId });

      if (acc) {
        const prop = _.findLast(acc.webProperties, { id: configuration.propertyId });
        const viewOpt = [];
        if (prop && prop.profiles) {
          prop.profiles.forEach((view) => {
            viewOpt.push({
              key: view.id,
              value: view.id,
              text: view.name,
            });
          });
        }

        setViewOptions(viewOpt);
      }
    }
  }, [configuration.propertyId, configuration.accountId]);

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

  const _initRequest = () => {
    if (dataRequest) {
      // get the request data if it exists
      const requestBody = _.find(requests, { options: { id: dataset.id } });
      if (requestBody) {
        setResult(JSON.stringify(requestBody.data, null, 2));
      }

      setGaRequest(dataRequest);

      if (dataRequest.configuration
        && dataRequest.configuration.startDate
        && dataRequest.configuration.endDate
      ) {
        setConfiguration({
          ...configuration,
          startDate: dataRequest.configuration.startDate,
          endDate: dataRequest.configuration.endDate,
        });
      }
    }
  };

  const _populateMetadata = () => {
    getMetadata(connection.project_id, connection.id)
      .then((metadata) => {
        if (metadata && metadata.items) {
          const metrics = [];
          const dimensions = [];
          metadata.items.forEach((m) => {
            if (m.attributes && m.attributes.type === "METRIC") {
              metrics.push({
                ...m, text: m.attributes.uiName, key: m.id, value: m.id
              });
            }
            if (m.attributes && m.attributes.type === "DIMENSION") {
              dimensions.push({
                ...m, text: m.attributes.uiName, key: m.id, value: m.id
              });
            }
          });

          setMetricsOptions(metrics);
          setDimensionsOptions(dimensions);
        }
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
    runRequest(match.params.projectId, match.params.chartId, dataset.id)
      .then((result) => {
        setRequestLoading(false);
        const jsonString = JSON.stringify(result.data, null, 2);
        setResult(jsonString);
      })
      .catch((error) => {
        setRequestLoading(false);
        toast.error("The request failed. Please check your request 🕵️‍♂️");
        setResult(JSON.stringify(error, null, 2));
      });
  };

  const _onFetchAccountData = () => {
    setCollectionsLoading(true);
    return testRequest(match.params.projectId, connection)
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
      setViewOptions([]);
      setConfiguration({
        ...configuration,
        propertyId: "",
        viewId: "",
      });
    }

    setConfiguration({ ...configuration, accountId: value });
  };

  const _onPropertySelected = (value) => {
    if (value !== configuration.propertyId) {
      setViewOptions([]);
      setConfiguration({ ...configuration, viewId: "" });
    }
    setConfiguration({ ...configuration, propertyId: value });
  };

  const _onViewSelected = (value) => {
    setConfiguration({ ...configuration, viewId: value });
  };

  const _renderCalendar = (type) => (
    <div>
      <Popover>
        <Popover.Trigger>
          <Button
            icon={<CalendarIcon set="bold" />}
            css={{ minWidth: "fit-content" }}
            flat
            color="secondary"
            disabled={!configuration.viewId}
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

  return (
    <div style={styles.container}>
      <Grid.Container>
        <Grid xs={12} sm={7} md={7}>
          <Grid.Container gap={1}>
            <Grid xs={12} sm={4} className="gabuilder-collections-tut">
              <Dropdown>
                <Dropdown.Trigger>
                  <Input
                    label="Account"
                    placeholder="Select an account"
                    contentRight={collectionsLoading ? <Loading type="spinner" /> : <ChevronDown />}
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
            <Grid xs={12} sm={4}>
              <Dropdown isDisabled={!configuration.accountId}>
                <Dropdown.Trigger>
                  <Input
                    label="Property"
                    placeholder="Select a property"
                    contentRight={collectionsLoading ? <Loading type="spinner" /> : <ChevronDown />}
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
                >
                  {propertyOptions.map((property) => (
                    <Dropdown.Item key={property.value}>
                      {property.text}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Grid>
            <Grid xs={12} sm={4}>
              <Dropdown isDisabled={!configuration.accountId || !configuration.propertyId}>
                <Dropdown.Trigger>
                  <Input
                    label="View"
                    placeholder="Select a view"
                    contentRight={collectionsLoading ? <Loading type="spinner" /> : <ChevronDown />}
                    bordered
                    animated={false}
                    fullWidth
                    disabled={!configuration.accountId || !configuration.propertyId}
                    value={
                      (viewOptions
                      && configuration.viewId
                      && viewOptions.find((view) => view.value === configuration.viewId)?.text)
                      || "Select a view"
                    }
                  />
                </Dropdown.Trigger>
                <Dropdown.Menu
                  onAction={(key) => _onViewSelected(key)}
                  selectedKeys={[configuration.viewId]}
                  selectionMode="single"
                >
                  {viewOptions.map((view) => (
                    <Dropdown.Item key={view.value}>
                      {view.text}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Grid>

            <Grid xs={12}>
              <Divider />
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
              <Dropdown isDisabled={!configuration.viewId}>
                <Dropdown.Trigger>
                  <Input
                    placeholder="Select a metric"
                    contentRight={collectionsLoading ? <Loading type="spinner" /> : <ChevronDown />}
                    bordered
                    animated={false}
                    fullWidth
                    helperColor="error"
                    helperText={formErrors.metrics}
                    color={formErrors.metrics ? "error" : "default"}
                    disabled={!configuration.viewId}
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
                        command={item.attributes.group}
                        description={item.value}
                      >
                        <Text size={16}>{item.text}</Text>
                      </Dropdown.Item>
                    );
                  })}
                </Dropdown.Menu>
              </Dropdown>
            </Grid>
            <Grid xs={12} direction="column">
              <Text size={16}>Choose a dimension</Text>

              <Dropdown isDisabled={!configuration.viewId}>
                <Dropdown.Trigger>
                  <Input
                    placeholder="Select a dimension"
                    contentRight={collectionsLoading ? <Loading type="spinner" /> : <ChevronDown />}
                    bordered
                    animated={false}
                    fullWidth
                    helperColor="error"
                    helperText={formErrors.dimensions}
                    color={formErrors.dimensions ? "error" : "default"}
                    disabled={!configuration.viewId}
                    value={
                      (dimensionsOptions
                      && configuration.dimensions
                      && dimensionsOptions.find((d) => d.value === configuration.dimensions)?.text)
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
                        command={item.attributes.group}
                        description={item.value}
                      >
                        <Text size={16}>{item.text}</Text>
                      </Dropdown.Item>
                    );
                  })}
                </Dropdown.Menu>
              </Dropdown>
            </Grid>
            <Grid xs={12} sm={6} direction="column">
              <Text size={16}>Start date</Text>
              <Input
                contentRight={_renderCalendar("startDate")}
                contentRightStyling={false}
                placeholder="YYYY-MM-DD"
                value={configuration.startDate}
                disabled={!configuration.viewId}
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
            <Grid xs={12} sm={6} direction="column">
              <Text size={16}>End date</Text>
              <Input
                contentRight={_renderCalendar("endDate")}
                contentRightStyling={false}
                placeholder="YYYY-MM-DD"
                value={configuration.endDate}
                disabled={!configuration.viewId}
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
                >
                  today
                </Badge>
                <Badge
                  as="a"
                  onClick={() => setConfiguration({ ...configuration, endDate: "yesterday" })}
                >
                  yesterday
                </Badge>
                <Badge
                  as="a"
                  onClick={() => setConfiguration({ ...configuration, endDate: "30daysAgo" })}
                >
                  30daysAgo
                </Badge>
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
            {dateHelp && (
              <Grid xs={12}>
                <Container
                  css={{
                    backgroundColor: "$accents3", br: 20, p: 10, pl: 15, pr: 15
                  }}
                >
                  <Row>
                    <Text>{"You can use relative dates such as "}</Text>
                    <Spacer x={0.1} />
                    <Badge>today</Badge>
                    <Spacer x={0.1} />
                    <Text>{", "}</Text>
                    <Spacer x={0.1} />
                    <Badge>yesterday</Badge>
                    <Spacer x={0.1} />
                    <Text>{", and "}</Text>
                    <Spacer x={0.1} />
                    <Badge>NdaysAgo</Badge>
                  </Row>
                  <Row>
                    <Text>{"Alternatively, you can type in any date in YYYY-MM-DD format or use the calendar picker next to each field."}</Text>
                  </Row>
                </Container>
              </Grid>
            )}
          </Grid.Container>
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
            <Spacer y={1} />
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
  dataset: PropTypes.object.isRequired,
  connection: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  runRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  requests: PropTypes.array.isRequired,
  dataRequest: PropTypes.object,
  testRequest: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    requests: state.dataset.requests,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    runRequest: (projectId, chartId, datasetId) => {
      return dispatch(runRequestAction(projectId, chartId, datasetId));
    },
    testRequest: (projectId, data) => dispatch(testRequestAction(projectId, data)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(GaBuilder));
