import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Form, Dropdown, Input, Menu, Button, List, Icon, Checkbox,
  Divider, Label, Popup,
} from "semantic-ui-react";
import AceEditor from "react-ace";
import uuid from "uuid/v4";
import _ from "lodash";
import { toast } from "react-toastify";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/mode-javascript";
import "ace-builds/src-min-noconflict/theme-tomorrow";

import ApiPagination from "./ApiPagination";
import {
  runRequest as runRequestAction,
} from "../../../actions/dataset";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";
import { primaryTransparent } from "../../../config/colors";

const methods = [{
  key: 1,
  text: "GET",
  value: "GET",
}, {
  key: 2,
  text: "POST",
  value: "POST",
}, {
  key: 3,
  text: "PUT",
  value: "PUT",
}, {
  key: 4,
  text: "DELETE",
  value: "DELETE",
}, {
  key: 5,
  text: "OPTIONS",
  value: "OPTIONS",
}];

/*
  The API Data Request builder
*/
function ApiBuilder(props) {
  const [apiRequest, setApiRequest] = useState({
    method: "GET",
    route: "",
    useGlobalHeaders: true,
    formattedHeaders: [{
      id: uuid(),
      key: "",
      value: "",
    }]
  });
  const [result, setResult] = useState("");
  const [activeMenu, setActiveMenu] = useState("headers");
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const [useCache, setUseCache] = useState(false);

  const {
    dataRequest, match, onChangeRequest, runRequest, dataset,
    connection, onSave, requests, changeTutorial, chart,
  } = props;

  // on init effect
  useEffect(() => {
    if (dataRequest) {
      // format the headers into key: value -> value: value format
      const formattedApiRequest = dataRequest;
      const formattedHeaders = [];

      if (dataRequest.headers) {
        Object.keys(dataRequest.headers).forEach((key) => {
          formattedHeaders.push({
            id: uuid(),
            key,
            value: dataRequest.headers[key],
          });
        });
      }
      if (!formattedApiRequest.method) formattedApiRequest.method = "GET";
      formattedApiRequest.formattedHeaders = formattedHeaders;

      setApiRequest(formattedApiRequest);

      // get the request data if it exists
      const requestBody = _.find(requests, { options: { id: dataset.id } });
      if (requestBody) {
        setResult(JSON.stringify(requestBody.data, null, 2));
      }

      setTimeout(() => {
        changeTutorial("apibuilder");
      }, 1000);
    }

    setUseCache(!!window.localStorage.getItem("_cb_use_cache"));
  }, []);

  useEffect(() => {
    const newApiRequest = apiRequest;

    // automate the pagination template here (to a possible extent)
    if (connection && apiRequest && !apiRequest.template) {
      if (connection.host.indexOf("api.stripe.com") > -1) {
        apiRequest.template = "stripe";
      }
    }

    onChangeRequest(newApiRequest);
  }, [apiRequest, connection]);

  const _addHeader = () => {
    const { formattedHeaders } = apiRequest;

    formattedHeaders.push({
      id: uuid(),
      key: "",
      value: "",
    });

    setApiRequest({ ...apiRequest, formattedHeaders });
  };

  const _removeHeader = (id) => {
    let { formattedHeaders } = apiRequest;
    if (formattedHeaders.length === 1) formattedHeaders = [];

    let found;
    for (let i = 0; i < formattedHeaders.length; i++) {
      if (formattedHeaders[i].id === id) {
        found = i;
        break;
      }
    }
    if (found) formattedHeaders.splice(found, 1);

    setApiRequest({ ...apiRequest, formattedHeaders });
  };

  const _onChangeHeader = (id, value) => {
    const { formattedHeaders } = apiRequest;

    for (let i = 0; i < formattedHeaders.length; i++) {
      if (formattedHeaders[i].id === id) {
        formattedHeaders[i].key = value;
        break;
      }
    }

    setApiRequest({ ...apiRequest, formattedHeaders });
  };

  const _onChangeHeaderValue = (id, value) => {
    const { formattedHeaders } = apiRequest;

    for (let i = 0; i < formattedHeaders.length; i++) {
      if (formattedHeaders[i].id === id) {
        formattedHeaders[i].value = value;
        break;
      }
    }

    setApiRequest({ ...apiRequest, formattedHeaders });
  };

  const _changeMethod = (value) => {
    if (value === "GET" || value === "OPTIONS") {
      setApiRequest({ ...apiRequest, method: value });
      setActiveMenu("headers");
    } else {
      setApiRequest({ ...apiRequest, method: value });
    }
  };

  const _onToggleGlobal = () => {
    setApiRequest({
      ...apiRequest, useGlobalHeaders: !apiRequest.useGlobalHeaders,
    });
  };

  const _onChangeBody = (value) => {
    setApiRequest({ ...apiRequest, body: value });
  };

  const _onChangeRoute = (value) => {
    setApiRequest({ ...apiRequest, route: value });
  };

  const _onPaginationChanged = (type, value) => {
    let newValue = value;
    if (type === "itemsLimit" && value && value !== "0") {
      newValue = Math.abs(parseInt(value, 10));
    }

    setApiRequest({ ...apiRequest, [type]: newValue });
  };

  const _onTest = () => {
    const { formattedHeaders } = apiRequest;
    let newHeaders = {};
    for (let i = 0; i < formattedHeaders.length; i++) {
      if (formattedHeaders[i].key && formattedHeaders[i].value) {
        newHeaders = { ...newHeaders, [formattedHeaders[i].key]: formattedHeaders[i].value };
      }
    }

    const finalApiRequest = { dataRequest: apiRequest };
    finalApiRequest.dataRequest.headers = newHeaders;

    setRequestLoading(true);
    setRequestSuccess(false);
    setRequestError(false);

    onSave().then(() => {
      runRequest(match.params.projectId, match.params.chartId, dataset.id, useCache)
        .then((result) => {
          setRequestLoading(false);
          setRequestSuccess(result.status);
          setResult(JSON.stringify(result.data, null, 2));
        })
        .catch((error) => {
          setRequestLoading(false);
          setRequestError(error);
          toast.error("The request failed. Please check your request 🕵️‍♂️");
          setResult(JSON.stringify(error, null, 2));
        });
    });
  };

  const _onChangeUseCache = () => {
    if (window.localStorage.getItem("_cb_use_cache")) {
      window.localStorage.removeItem("_cb_use_cache");
      setUseCache(false);
    } else {
      window.localStorage.setItem("_cb_use_cache", true);
      setUseCache(true);
    }
  };

  return (
    <div style={styles.container}>
      <Grid columns={2} stackable centered>
        <Grid.Column width={10}>
          <Form>
            <Form.Field className="apibuilder-route-tut">
              <Input
                label={connection.host}
                placeholder="/route?key=value"
                focus
                value={apiRequest.route || ""}
                onChange={(e, data) => _onChangeRoute(data.value)}
              />
            </Form.Field>
            <Form.Field>
              {"Available variables: "}
              <Popup
                trigger={(
                  <Label basic as="a" onClick={() => chart.startDate && _onChangeRoute(`${apiRequest.route}{{start_date}}`)}>
                    {"{{start_date}}"}
                  </Label>
                )}
                content={chart.startDate || "Set this value in chart date settings first"}
                position="bottom center"
              />
              <Popup
                trigger={(
                  <Label basic as="a" onClick={() => chart.endDate && _onChangeRoute(`${apiRequest.route}{{end_date}}`)}>
                    {"{{end_date}}"}
                  </Label>
                )}
                content={chart.endDate || "Set this value in chart date settings first"}
                position="bottom center"
              />
            </Form.Field>
          </Form>

          <Menu pointing secondary className="apibuilder-menu-tut">
            <Menu.Item
              name="Headers"
              active={activeMenu === "headers"}
              onClick={() => setActiveMenu("headers")}
            />
            <Menu.Item
              name="Body"
              disabled={apiRequest.method === "GET" || apiRequest.method === "OPTIONS"}
              active={activeMenu === "body"}
              onClick={() => setActiveMenu("body")}
            />
            <Menu.Item
              name="Pagination"
              active={activeMenu === "pagination"}
              onClick={() => setActiveMenu("pagination")}
            />
            <div style={{ position: "absolute", right: 15 }}>
              {requestSuccess && (
                <>
                  <Label color="green" style={{ marginBottom: 10 }}>
                    {`${requestSuccess.statusCode} ${requestSuccess.statusText}`}
                  </Label>
                </>
              )}
              {requestError && (
                <Label color="red" style={{ marginBottom: 10 }}>
                  {`${requestError.statusCode} ${requestError.statusText}`}
                </Label>
              )}
            </div>
          </Menu>
          {activeMenu === "headers" && (
            <div className="apibuilder-headers-tut">
              {connection.options && connection.options.length > 0 && (
                <div>
                  <Checkbox
                    label="Include connection headers"
                    checked={!!apiRequest.useGlobalHeaders}
                    onChange={_onToggleGlobal}
                  />

                  {apiRequest.useGlobalHeaders && (
                    <List>
                      {connection.options.map((header) => {
                        return (
                          <List.Item key={header}>
                            <List.Content>
                              <Form>
                                <Form.Group widths={2}>
                                  <Form.Field width={7}>
                                    <Input value={Object.keys(header)[0]} />
                                  </Form.Field>
                                  <Form.Field width={7}>
                                    <Input value={header[Object.keys(header)[0]]} />
                                  </Form.Field>
                                </Form.Group>
                              </Form>
                            </List.Content>
                          </List.Item>
                        );
                      })}
                    </List>
                  )}

                  <Divider />
                </div>
              )}
              <List>
                {apiRequest.formattedHeaders && apiRequest.formattedHeaders.map((header) => {
                  return (
                    <List.Item key={header.id}>
                      <List.Content>
                        <Form>
                          <Form.Group widths={3}>
                            <Form.Field width={7}>
                              <Input
                                placeholder="Header"
                                value={header.key}
                                onChange={(e, data) => {
                                  _onChangeHeader(header.id, data.value);
                                }}
                              />
                            </Form.Field>
                            <Form.Field width={7}>
                              <Input
                                placeholder="Value"
                                value={header.value}
                                onChange={(e, data) => {
                                  _onChangeHeaderValue(header.id, data.value);
                                }}
                              />
                            </Form.Field>
                            <Form.Field width={1}>
                              <Button
                                icon
                                onClick={() => _removeHeader(header.id)}
                              >
                                <Icon name="close" />
                              </Button>
                            </Form.Field>
                          </Form.Group>
                        </Form>
                      </List.Content>
                    </List.Item>
                  );
                })}
              </List>

              <Button
                icon
                labelPosition="right"
                size="small"
                onClick={_addHeader}
              >
                <Icon name="plus" />
                Add header
              </Button>
            </div>
          )}
          {activeMenu === "body" && (
            <div>
              <AceEditor
                mode="json"
                theme="tomorrow"
                height="400px"
                width="none"
                value={apiRequest.body || ""}
                onChange={(value) => {
                  _onChangeBody(value);
                }}
                name="queryEditor"
                editorProps={{ $blockScrolling: true }}
              />
            </div>
          )}
          {activeMenu === "pagination" && (
            <ApiPagination
              items={apiRequest.items}
              itemsLimit={apiRequest.itemsLimit}
              offset={apiRequest.offset}
              paginationField={apiRequest.paginationField}
              pagination={apiRequest.pagination}
              onPaginationChanged={_onPaginationChanged}
              apiRoute={apiRequest.route || ""}
              template={apiRequest.template}
              result={result && JSON.parse(result)}
            />
          )}
        </Grid.Column>
        <Grid.Column width={6}>
          <Form style={{ paddingBottom: 10 }}>
            <Form.Group widths={2}>
              <Form.Field className="apibuilder-type-tut">
                <Dropdown
                  fluid
                  text={apiRequest.method}
                  options={methods}
                  selection
                  onChange={(e, data) => _changeMethod(data.value)}
                />
              </Form.Field>
              <Form.Field className="apibuilder-request-tut">
                <Button
                  primary
                  icon
                  labelPosition="right"
                  loading={requestLoading}
                  onClick={_onTest}
                  fluid
                >
                  <Icon name="play" />
                  Run the request
                </Button>
              </Form.Field>
            </Form.Group>
            <Form.Field>
              <Checkbox
                label="Use cache"
                checked={!!useCache}
                onChange={_onChangeUseCache}
              />
              {" "}
              <Popup
                trigger={<Icon name="question circle outline" style={{ color: primaryTransparent(0.7) }} />}
                inverted
              >
                <>
                  <p>{"If checked, Chartbrew will use cached data instead of making requests to your data source."}</p>
                  <p>{"The cache gets automatically invalidated when you change the configuration of the request."}</p>
                </>
              </Popup>
            </Form.Field>
          </Form>
          <AceEditor
            mode="json"
            theme="tomorrow"
            height="400px"
            width="none"
            value={result || ""}
            onChange={() => setResult(result)}
            name="resultEditor"
            readOnly
            editorProps={{ $blockScrolling: false }}
            className="apibuilder-result-tut"
          />
          <p>
            <Icon name="exclamation circle" />
            <small>{"This is a preview and it might not show all data in order to keep things fast in the UI."}</small>
          </p>
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

ApiBuilder.defaultProps = {
  dataRequest: null,
};

ApiBuilder.propTypes = {
  dataset: PropTypes.object.isRequired,
  connection: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  runRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  requests: PropTypes.array.isRequired,
  dataRequest: PropTypes.object,
  changeTutorial: PropTypes.func.isRequired,
  chart: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    requests: state.dataset.requests,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    runRequest: (projectId, chartId, datasetId, getCache) => {
      return dispatch(runRequestAction(projectId, chartId, datasetId, getCache));
    },
    changeTutorial: (tutorial) => dispatch(changeTutorialAction(tutorial)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ApiBuilder));
