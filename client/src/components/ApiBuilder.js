import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Form, Header, Dropdown, Input, Menu, Button, List, Icon, Checkbox,
  Divider, Label,
} from "semantic-ui-react";
import brace from "brace"; // eslint-disable-line
import AceEditor from "react-ace";
import uuid from "uuid/v4";

import "brace/mode/json";
import "brace/theme/tomorrow";

import { testApiRequest } from "../actions/connection";
import { getApiRequestByChart } from "../actions/apiRequest";
import ApiPagination from "./ApiPagination";

/*
  Description
*/
class ApiBuilder extends Component {
  constructor(props) {
    super(props);

    this.state = {
      methods: [{
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
      }],
      headers: [{
        id: uuid(),
        key: "",
        value: "",
      }],
      apiRequest: {
        method: "GET",
        route: "",
        useGlobalHeaders: true,
        formattedHeaders: [{
          id: uuid(),
          key: "",
          value: "",
        }]
      },
      result: "",
      activeMenu: "headers",
    };
  }

  componentDidMount() {
    this._onInit();
  }

  _onInit = () => {
    const {
      apiRequest, chartId, getApiRequestByChart, match, onChangeRequest,
    } = this.props;
    if (apiRequest) {
      this.setState({ apiRequest });
    }

    if (chartId > 0 && !apiRequest) {
      getApiRequestByChart(match.params.projectId, chartId)
        .then((apiRequest) => {
          // format the headers into key: value -> value: value format
          const formattedApiRequest = apiRequest;
          const formattedHeaders = [];
          Object.keys(apiRequest.headers).forEach((key) => {
            formattedHeaders.push({
              id: uuid(),
              key,
              value: apiRequest.headers[key],
            });
          });

          formattedApiRequest.formattedHeaders = formattedHeaders;

          this.setState({ apiRequest: formattedApiRequest }, () => {
            onChangeRequest(formattedApiRequest);
          });
        })
        .catch(() => {});
    }
  }

  _addHeader = () => {
    const { onChangeRequest } = this.props;
    const { apiRequest } = this.state;
    const { formattedHeaders } = apiRequest;

    formattedHeaders.push({
      id: uuid(),
      key: "",
      value: "",
    });

    this.setState({
      apiRequest: { ...apiRequest, formattedHeaders },
    }, () => {
      onChangeRequest(apiRequest);
    });
  }

  _removeHeader = (id) => {
    const { onChangeRequest } = this.props;
    const { apiRequest } = this.state;
    const { formattedHeaders } = apiRequest;
    let found;
    for (let i = 0; i < formattedHeaders.length; i++) {
      if (formattedHeaders[i].id === id) {
        found = i;
        break;
      }
    }

    if (found) formattedHeaders.splice(found, 1);

    this.setState({
      apiRequest: { ...apiRequest, formattedHeaders },
    }, () => {
      onChangeRequest(apiRequest);
    });
  }

  _onChangeHeader = (id, value) => {
    const { onChangeRequest } = this.props;
    const { apiRequest } = this.state;
    const { formattedHeaders } = apiRequest;

    for (let i = 0; i < formattedHeaders.length; i++) {
      if (formattedHeaders[i].id === id) {
        formattedHeaders[i].key = value;
        break;
      }
    }

    this.setState({
      apiRequest: { ...apiRequest, formattedHeaders },
    }, () => {
      onChangeRequest(apiRequest);
    });
  }

  _onChangeHeaderValue = (id, value) => {
    const { onChangeRequest } = this.props;
    const { apiRequest } = this.state;
    const { formattedHeaders } = apiRequest;
    for (let i = 0; i < formattedHeaders.length; i++) {
      if (formattedHeaders[i].id === id) {
        formattedHeaders[i].value = value;
        break;
      }
    }

    this.setState({
      apiRequest: { ...apiRequest, formattedHeaders },
    }, () => {
      onChangeRequest(apiRequest);
    });
  }

  _changeMethod = (value) => {
    const { onChangeRequest } = this.props;
    const { apiRequest } = this.state;

    if (value === "GET" || value === "OPTIONS") {
      this.setState({
        apiRequest: { ...apiRequest, method: value },
        activeMenu: "headers"
      }, () => {
        onChangeRequest(apiRequest);
      });
    } else {
      this.setState({
        apiRequest: { ...apiRequest, method: value }
      }, () => {
        onChangeRequest(apiRequest);
      });
    }
  }

  _onToggleGlobal = () => {
    const { onChangeRequest } = this.props;
    const { apiRequest } = this.state;

    this.setState({
      apiRequest: {
        ...apiRequest, useGlobalHeaders: !apiRequest.useGlobalHeaders,
      }
    }, () => {
      onChangeRequest(apiRequest);
    });
  }

  _onChangeBody = (value) => {
    const { onChangeRequest } = this.props;
    const { apiRequest } = this.state;

    this.setState({ body: value }, () => {
      onChangeRequest(apiRequest);
    });
  }

  _onChangeRoute = (value) => {
    const { onChangeRequest } = this.props;
    const { apiRequest } = this.state;

    if (value[0] !== "/") {
      value = `/${value}`; // eslint-disable-line
    }

    this.setState({ apiRequest: { ...apiRequest, route: value } }, () => {
      onChangeRequest({ ...apiRequest, route: value });
    });
  }

  _onTest = () => {
    const {
      match, connection, testApiRequest, onComplete,
      offset, items, itemsLimit, pagination,
    } = this.props;
    const {
      headers, apiRequest
    } = this.state;

    let newHeaders = {};
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].key && headers[i].value) {
        newHeaders = { ...newHeaders, [headers[i].key]: headers[i].value };
      }
    }

    const finalApiRequest = { apiRequest };
    finalApiRequest.apiRequest.headers = newHeaders;

    finalApiRequest.pagination = pagination;
    finalApiRequest.items = items;
    finalApiRequest.offset = offset;
    finalApiRequest.itemsLimit = itemsLimit;

    this.setState({ requestLoading: true, requestSuccess: false, requestError: false });
    testApiRequest(match.params.projectId, connection.id, finalApiRequest)
      .then((result) => {
        this.setState({
          requestLoading: false,
          requestSuccess: result.status,
          result: JSON.stringify(result.body, null, 2)
        });

        onComplete(result.body);
      })
      .catch((error) => {
        this.setState({
          requestLoading: false,
          requestError: error,
          result: JSON.stringify(error, null, 2)
        });
      });
  }

  render() {
    const {
      methods, activeMenu, requestSuccess, requestError,
      requestLoading, body, result, apiRequest,
    } = this.state;
    const {
      connection, items, itemsLimit, offset, pagination,
      onPaginationChanged,
    } = this.props;

    return (
      <div style={styles.container}>
        <Grid columns={2} stackable centered>
          <Grid.Row>
            <Grid.Column width={15}>
              <Form>
                <Form.Group widths={3}>
                  <Form.Field width={2}>
                    <label>Method</label>
                    <Dropdown
                      fluid
                      text={apiRequest.method}
                      options={methods}
                      selection
                      onChange={(e, data) => this._changeMethod(data.value)}
                    />
                  </Form.Field>
                  <Form.Field width={12}>
                    <label>{"Add the route and any query parameters below"}</label>
                    <Input
                      label={connection.host}
                      placeholder="/route?key=value"
                      focus
                      value={apiRequest.route || ""}
                      onChange={(e, data) => this._onChangeRoute(data.value)}
                    />
                  </Form.Field>
                  <Form.Field width={2}>
                    <label>Make the request</label>
                    <Button
                      primary
                      icon
                      labelPosition="right"
                      loading={requestLoading}
                      onClick={this._onTest}
                    >
                      <Icon name="play" />
                      Send
                    </Button>
                  </Form.Field>
                </Form.Group>
              </Form>
            </Grid.Column>
            <Grid.Column width={1} />
          </Grid.Row>
          <Grid.Row>
            <Grid.Column width={10}>
              <Menu pointing secondary>
                <Menu.Item
                  name="Headers"
                  active={activeMenu === "headers"}
                  onClick={() => this.setState({ activeMenu: "headers" })}
                />
                <Menu.Item
                  name="Body"
                  disabled={apiRequest.method === "GET" || apiRequest.method === "OPTIONS"}
                  active={activeMenu === "body"}
                  onClick={() => this.setState({ activeMenu: "body" })}
                />
                <Menu.Item
                  name="Pagination"
                  active={activeMenu === "pagination"}
                  onClick={() => this.setState({ activeMenu: "pagination" })}
                />
              </Menu>
              {activeMenu === "headers" && (
                <div>
                  {connection.options && connection.options.length > 0 && (
                    <div>
                      <Checkbox
                        label="Enable global headers"
                        defaultChecked={!!apiRequest.useGlobalHeaders}
                        onChange={this._onToggleGlobal}
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
                    {apiRequest.formattedHeaders.map((header) => {
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
                                      this._onChangeHeader(header.id, data.value);
                                    }}
                                  />
                                </Form.Field>
                                <Form.Field width={7}>
                                  <Input
                                    placeholder="Value"
                                    value={header.value}
                                    onChange={(e, data) => {
                                      this._onChangeHeaderValue(header.id, data.value);
                                    }}
                                  />
                                </Form.Field>
                                <Form.Field width={1}>
                                  <Button
                                    icon
                                    onClick={() => this._removeHeader(header.id)}
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
                    onClick={this._addHeader}
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
                    value={body || ""}
                    onChange={(value) => {
                      this._onChangeBody(value);
                    }}
                    name="queryEditor"
                    editorProps={{ $blockScrolling: true }}
                  />
                </div>
              )}
              {activeMenu === "pagination" && (
                <ApiPagination
                  items={items}
                  itemsLimit={itemsLimit}
                  offset={offset}
                  pagination={pagination}
                  onPaginationChanged={onPaginationChanged}
                />
              )}
            </Grid.Column>
            <Grid.Column width={6}>
              <Header as="h3" dividing style={{ paddingTop: 15 }}>Result:</Header>
              {requestSuccess && (
                <>
                  <Label color="green" style={{ marginBottom: 10 }}>
                    {`${requestSuccess.statusCode} ${requestSuccess.statusText}`}
                  </Label>
                  <Label style={{ marginBottom: 10 }}>
                    {`Length: ${result ? JSON.parse(result).length : 0}`}
                  </Label>
                </>
              )}
              {requestError && (
                <Label color="red" style={{ marginBottom: 10 }}>
                  {`${requestError.statusCode} ${requestError.statusText}`}
                </Label>
              )}
              <AceEditor
                mode="json"
                theme="tomorrow"
                height="400px"
                width="none"
                value={result || ""}
                onChange={() => this.setState({ result })}
                name="resultEditor"
                editorProps={{ $blockScrolling: false }}
              />
            </Grid.Column>
          </Grid.Row>
        </Grid>
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
  },
};

ApiBuilder.defaultProps = {
  apiRequest: null,
  chartId: -1,
  items: "items",
  itemsLimit: 100,
  offset: "offset",
  pagination: false,
};

ApiBuilder.propTypes = {
  connection: PropTypes.object.isRequired,
  testApiRequest: PropTypes.func.isRequired,
  getApiRequestByChart: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  onComplete: PropTypes.func.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  apiRequest: PropTypes.object,
  chartId: PropTypes.number,
  items: PropTypes.string,
  itemsLimit: PropTypes.number,
  offset: PropTypes.string,
  pagination: PropTypes.bool,
  onPaginationChanged: PropTypes.func.isRequired,
};

const mapStateToProps = () => {
  return {
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    testApiRequest: (projectId, connectionId, apiRequest) => {
      return dispatch(testApiRequest(projectId, connectionId, apiRequest));
    },
    getApiRequestByChart: (projectId, chartId) => {
      return dispatch(getApiRequestByChart(projectId, chartId));
    },
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ApiBuilder));
