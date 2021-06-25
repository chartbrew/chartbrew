import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Form, Button, Icon, Header, Divider, Dropdown, Label, Input, Popup, Message,
} from "semantic-ui-react";
import AceEditor from "react-ace";
import _ from "lodash";
import { toast } from "react-toastify";
import { Calendar } from "react-date-range";
import { format, sub } from "date-fns";
import { enGB } from "date-fns/locale";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
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
  const [metricsSearch, setMetricsSearch] = useState("");
  const [dimensionsSearch, setDimensionsSearch] = useState("");

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
    <Popup
      trigger={(
        <Button
          icon="calendar alternate"
        />
      )}
      on="click"
    >
      <Popup.Content>
        <Calendar
          date={_getDateForCalendar(configuration[type])}
          onChange={(date) => {
            setConfiguration({ ...configuration, [type]: format(date, "yyyy-MM-dd") });
          }}
          locale={enGB}
          color={secondary}
        />
      </Popup.Content>
    </Popup>
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
      <Grid columns={2} stackable centered>
        <Grid.Column width={10}>
          <div className="gabuilder-collections-tut">
            <Header as="h4">Select a view for your connection</Header>
            <Form>
              <Form.Group widths={3}>
                <Form.Field>
                  <label>Account</label>
                  <Dropdown
                    placeholder="Select an account"
                    selection
                    options={accountOptions}
                    onChange={(e, data) => _onAccountSelected(data.value)}
                    loading={collectionsLoading}
                    value={configuration.accountId}
                  />
                </Form.Field>
                <Form.Field disabled={!configuration.accountId}>
                  <label>Property</label>
                  <Dropdown
                    placeholder="Select a property"
                    selection
                    options={propertyOptions}
                    onChange={(e, data) => _onPropertySelected(data.value)}
                    loading={collectionsLoading}
                    value={configuration.propertyId}
                  />
                </Form.Field>
                <Form.Field disabled={!configuration.accountId || !configuration.propertyId}>
                  <label>View</label>
                  <Dropdown
                    placeholder="Select a view"
                    selection
                    options={viewOptions}
                    onChange={(e, data) => _onViewSelected(data.value)}
                    loading={collectionsLoading}
                    value={configuration.viewId}
                  />
                </Form.Field>
              </Form.Group>
            </Form>
          </div>
          <Divider />

          <div className="gabuilder-query-tut">
            <Form disabled={!configuration.viewId}>
              <Form.Field required error={formErrors.metrics}>
                <label>
                  {"Choose a metric "}
                  <Popup
                    trigger={(
                      <Icon name="question circle" />
                    )}
                    content="You can add multiple metrics by creating another dataset for this chart. Click on 'Build chart', then 'Add new dataset' on the right."
                  />
                </label>
                <Dropdown
                  selection
                  options={metricsOptions}
                  loading={collectionsLoading}
                  search
                  value={configuration.metrics}
                  onSearchChange={(e, data) => {
                    setMetricsSearch(data.searchQuery);
                  }}
                  searchQuery={metricsSearch}
                  scrolling
                >
                  <Dropdown.Menu>
                    {metricsOptions.map((item) => {
                      if (metricsSearch
                        && item.value.toLowerCase().indexOf(metricsSearch.toLowerCase()) === -1
                        && item.text.toLowerCase().indexOf(metricsSearch.toLowerCase()) === -1
                      ) {
                        return (<span key={item.key} />);
                      }

                      return (
                        <Dropdown.Item
                          key={item.key}
                          onClick={() => {
                            setConfiguration({ ...configuration, metrics: item.value });
                            setMetricsSearch("");
                          }}
                        >
                          <Dropdown.Header style={{ paddingBottom: 10 }}>
                            {item.text}
                            <Label size="small" style={{ float: "right" }}>
                              {item.attributes.group}
                            </Label>
                          </Dropdown.Header>
                          <div><small>{item.value}</small></div>
                        </Dropdown.Item>
                      );
                    })}
                  </Dropdown.Menu>
                </Dropdown>
              </Form.Field>
              <Form.Field>
                <label>Choose a dimension</label>
                <Dropdown
                  selection
                  options={dimensionsOptions}
                  loading={collectionsLoading}
                  value={configuration.dimensions}
                  scrolling
                  search
                  onSearchChange={(e, data) => {
                    setDimensionsSearch(data.searchQuery);
                  }}
                  searchQuery={dimensionsSearch}
                >
                  <Dropdown.Menu>
                    <Dropdown.Item>
                      <Button
                        secondary
                        icon="x"
                        content="Clear Field"
                        onClick={() => {
                          setDimensionsSearch("");
                          setConfiguration({ ...configuration, dimensions: "" });
                        }}
                        fluid
                        size="small"
                      />
                    </Dropdown.Item>
                    {dimensionsOptions.map((item) => {
                      if (dimensionsSearch
                        && item.value.toLowerCase().indexOf(dimensionsSearch.toLowerCase()) === -1
                        && item.text.toLowerCase().indexOf(dimensionsSearch.toLowerCase()) === -1
                      ) {
                        return (<span key={item.key} />);
                      }

                      return (
                        <Dropdown.Item
                          key={item.key}
                          onClick={() => {
                            setConfiguration({ ...configuration, dimensions: item.value });
                            setDimensionsSearch("");
                          }}
                        >
                          <Dropdown.Header style={{ paddingBottom: 10 }}>
                            {item.text}
                            <Label size="small" style={{ float: "right" }}>
                              {item.attributes.group}
                            </Label>
                          </Dropdown.Header>
                          <div><small>{item.value}</small></div>
                        </Dropdown.Item>
                      );
                    })}
                  </Dropdown.Menu>
                </Dropdown>
              </Form.Field>
              <Form.Group widths="2">
                <Form.Field required>
                  <label>Start date</label>
                  <Input
                    action={_renderCalendar("startDate")}
                    placeholder="YYYY-MM-DD"
                    value={configuration.startDate}
                    onChange={(e, data) => {
                      setConfiguration({ ...configuration, startDate: data.value });
                    }}
                  />
                  <Label.Group style={{ marginTop: 10 }}>
                    <Label
                      as="a"
                      onClick={() => setConfiguration({ ...configuration, startDate: "today" })}
                      content="today"
                    />
                    <Label
                      as="a"
                      onClick={() => setConfiguration({ ...configuration, startDate: "yesterday" })}
                      content="yesterday"
                    />
                    <Label
                      as="a"
                      onClick={() => setConfiguration({ ...configuration, startDate: "30daysAgo" })}
                      content="30daysAgo"
                    />
                    <Label
                      as="a"
                      onClick={() => setDateHelp(!dateHelp)}
                      icon="question circle"
                      content="info"
                      basic
                      color={(dateHelp && "olive") || null}
                    />
                  </Label.Group>
                </Form.Field>
                <Form.Field required>
                  <label>End date</label>
                  <Input
                    action={_renderCalendar("endDate")}
                    placeholder="YYYY-MM-DD"
                    value={configuration.endDate}
                    onChange={(e, data) => {
                      setConfiguration({ ...configuration, endDate: data.value });
                    }}
                  />
                  <Label.Group style={{ marginTop: 10 }}>
                    <Label
                      as="a"
                      onClick={() => setConfiguration({ ...configuration, endDate: "today" })}
                      content="today"
                    />
                    <Label
                      as="a"
                      onClick={() => setConfiguration({ ...configuration, endDate: "yesterday" })}
                      content="yesterday"
                    />
                    <Label
                      as="a"
                      onClick={() => setConfiguration({ ...configuration, endDate: "30daysAgo" })}
                      content="30daysAgo"
                    />
                    <Label
                      as="a"
                      onClick={() => setDateHelp(!dateHelp)}
                      icon="question circle"
                      content="info"
                      basic
                      color={(dateHelp && "olive") || null}
                    />
                  </Label.Group>
                </Form.Field>
              </Form.Group>
              {dateHelp && (
                <Form.Field>
                  <Message>
                    <p>
                      {"You can use relative dates such as "}
                      <Label>today</Label>
                      {", "}
                      <Label>yesterday</Label>
                      {", and "}
                      <Label>NdaysAgo</Label>
                    </p>
                    <p>
                      {"Alternatively, you can type in any date in YYYY-MM-DD format or use the calendar picker next to each field."}
                    </p>
                  </Message>
                </Form.Field>
              )}
            </Form>
          </div>
        </Grid.Column>
        <Grid.Column width={6}>
          <Form>
            <Form.Field className="gabuilder-request-tut">
              <Button
                primary
                icon
                labelPosition="right"
                loading={requestLoading}
                onClick={() => _onTest()}
                fluid
              >
                <Icon name="play" />
                Get analytics data
              </Button>
            </Form.Field>
            <Form.Field className="gabuilder-result-tut">
              <AceEditor
                mode="json"
                theme="tomorrow"
                height="450px"
                width="none"
                value={result || ""}
                name="resultEditor"
                readOnly
                editorProps={{ $blockScrolling: false }}
              />
            </Form.Field>
          </Form>
        </Grid.Column>
      </Grid>
    </div>
  );
}
const styles = {
  container: {
    flex: 1,
  },
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
