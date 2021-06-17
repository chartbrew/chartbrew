import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Form, Button, Icon, Header, Divider, Popup, Dropdown,
} from "semantic-ui-react";
import AceEditor from "react-ace";
import _ from "lodash";
import { toast } from "react-toastify";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/webpack-resolver";

import {
  runRequest as runRequestAction,
} from "../../../actions/dataset";
import {
  testRequest as testRequestAction,
} from "../../../actions/connection";

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
    metrics: ""
  });
  const [result, setResult] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [accountOptions, setAccountOptions] = useState([]);
  const [propertyOptions, setPropertyOptions] = useState([]);
  const [viewOptions, setViewOptions] = useState([]);

  // on init effect
  useEffect(() => {
    _onFetchAccountData();
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
  }, [accountOptions]);

  useEffect(() => {
    if (propertyOptions.length > 0
      && dataRequest.configuration
      && dataRequest.configuration.propertyId
    ) {
      setConfiguration({ ...configuration, propertyId: dataRequest.configuration.propertyId });
    }
  }, [propertyOptions]);

  useEffect(() => {
    if (accountOptions.length > 0
      && dataRequest.configuration
      && dataRequest.configuration.viewId
    ) {
      setConfiguration({ ...configuration, viewId: dataRequest.configuration.viewId });
    }
  }, [viewOptions]);

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
      if (acc.webProperties) {
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
    if (configuration.propertyId) {
      const acc = _.findLast(analyticsData.items, { id: configuration.accountId });
      const prop = _.findLast(acc.webProperties, { id: configuration.propertyId });
      const viewOpt = [];
      if (prop.profiles) {
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
  }, [configuration.propertyId]);

  const _initRequest = () => {
    if (dataRequest) {
      // get the request data if it exists
      const requestBody = _.find(requests, { options: { id: dataset.id } });
      if (requestBody) {
        setResult(JSON.stringify(requestBody.data, null, 2));
      }

      setGaRequest(dataRequest);
    }
  };

  const _onTest = (request = gaRequest) => {
    setRequestLoading(true);

    if (request === null) request = gaRequest; // eslint-disable-line
    const requestToSave = _.cloneDeep(request);
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
            <Header as="h4">
              {"Filter the data "}
              <Popup
                trigger={<Icon style={{ fontSize: 16, verticalAlign: "baseline" }} name="question circle" />}
                content="These filters are applied directly on your firestore connection. You can further filter the data on Chartbrew's side when you configure your chart."
              />
            </Header>

            <Button
              primary
              content="Save configuration"
              icon="save"
              onClick={() => _onChangeRequest({ configuration })}
            />
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
