import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Button, Checkbox, Container, Divider, Dropdown, Grid, Input,
  Link, Loading, Row, Spacer, Text, Tooltip, useTheme, Badge,
} from "@nextui-org/react";
import AceEditor from "react-ace";
import uuid from "uuid/v4";
import { toast } from "react-toastify";
import {
  ChevronDown, CloseSquare, Delete, InfoCircle, Play, Plus
} from "react-iconly";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/mode-javascript";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import ApiPagination from "./ApiPagination";
import {
  runDataRequest as runDataRequestAction,
} from "../../../actions/dataRequest";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";
import {
  getConnection as getConnectionAction,
} from "../../../actions/connection";

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
  const [invalidateCache, setInvalidateCache] = useState(false);
  const [fullConnection, setFullConnection] = useState({});
  const [saveLoading, setSaveLoading] = useState(false);

  const { isDark } = useTheme();

  const {
    dataRequest, match, onChangeRequest, runDataRequest,
    connection, onSave, changeTutorial, chart,
    getConnection, onDelete, responses,
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

      setTimeout(() => {
        changeTutorial("apibuilder");
      }, 1000);
    }
  }, []);

  useEffect(() => {
    const newApiRequest = apiRequest;

    // automate the pagination template here (to a possible extent)
    if (connection && apiRequest && !apiRequest.template) {
      if (connection.host.indexOf("api.stripe.com") > -1) {
        apiRequest.template = "stripe";
      }
    }

    getConnection(match.params.projectId, connection.id)
      .then((data) => {
        setFullConnection(data);
      })
      .catch(() => {});

    onChangeRequest(newApiRequest);
  }, [apiRequest, connection]);

  useEffect(() => {
    if (responses && responses.length > 0) {
      const selectedResponse = responses.find((o) => o.id === dataRequest.id);
      if (selectedResponse?.data) {
        setResult(JSON.stringify(selectedResponse.data, null, 2));
      }
    }
  }, [responses]);

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

  const _onTest = (dr = dataRequest) => {
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

    onSave(dr).then(() => {
      const getCache = !invalidateCache;
      runDataRequest(match.params.projectId, match.params.chartId, dr.id, getCache)
        .then((result) => {
          setRequestLoading(false);
          setRequestSuccess(result.status);
        })
        .catch((error) => {
          setRequestLoading(false);
          setRequestError(error);
          toast.error("The request failed. Please check your request 🕵️‍♂️");
          setResult(JSON.stringify(error, null, 2));
        });
    });
  };

  const _onSavePressed = () => {
    setSaveLoading(true);
    onSave(apiRequest).then(() => {
      setSaveLoading(false);
    }).catch(() => {
      setSaveLoading(false);
    });
  };

  return (
    <div style={{ flex: 1 }}>
      <Grid.Container>
        <Grid xs={12} sm={7} md={8} css={{ "@xs": { mb: 50 } }}>
          <Container>
            <Row justify="space-between" align="center">
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
            </Row>
            <Spacer y={0.5} />
            <Row>
              <Divider />
            </Row>
            <Spacer y={0.5} />
            <Row align="center" className="apibuilder-route-tut">
              <Input
                labelLeft={connection.host}
                placeholder="/route?key=value"
                autoFocus
                value={apiRequest.route || ""}
                onChange={(e) => _onChangeRoute(e.target.value)}
                fullWidth
                bordered
                animated={false}
                css={{
                  "& .nextui-input-label--left": { minWidth: "max-content" }
                }}
              />
            </Row>
            <Spacer y={0.5} />
            <Row align="center">
              <Text>{"Available variables: "}</Text>
              <Spacer x={0.2} />
              <Tooltip
                content={chart.startDate || "Set this value in chart date settings first"}
                css={{ zIndex: 10000 }}
              >
                <Link onClick={() => chart.startDate && _onChangeRoute(`${apiRequest.route}{{start_date}}`)}>
                  <Badge color="primary">
                    {"{{start_date}}"}
                  </Badge>
                </Link>
              </Tooltip>
              <Spacer x={0.2} />
              <Tooltip
                content={chart.endDate || "Set this value in chart date settings first"}
                css={{ zIndex: 10000 }}
              >
                <Link onClick={() => chart.endDate && _onChangeRoute(`${apiRequest.route}{{end_date}}`)}>
                  <Badge color="primary">
                    {"{{end_date}}"}
                  </Badge>
                </Link>
              </Tooltip>
            </Row>
            <Spacer y={1} />
            <Row className="apibuilder-menu-tut">
              <Link
                css={{
                  background: activeMenu === "headers" ? "$background" : "$backgroundContrast",
                  p: 5,
                  pr: 10,
                  pl: 10,
                  br: "$sm",
                  "@xsMax": { width: "90%" },
                  ai: "center",
                  color: "$text",
                }}
                onClick={() => setActiveMenu("headers")}
              >
                <Text>{"Headers"}</Text>
              </Link>
              <Spacer x={0.2} />
              <Link
                css={{
                  background: activeMenu === "body" ? "$background" : "$backgroundContrast",
                  p: 5,
                  pr: 10,
                  pl: 10,
                  br: "$sm",
                  "@xsMax": { width: "90%" },
                  ai: "center",
                  cursor: apiRequest.method === "GET" || apiRequest.method === "OPTIONS" ? "not-allowed" : "pointer",
                }}
                onClick={() => {
                  if (apiRequest.method === "GET" || apiRequest.method === "OPTIONS") return;
                  setActiveMenu("body");
                }}
              >
                <Text css={{ color: apiRequest.method === "GET" || apiRequest.method === "OPTIONS" ? "$accents5" : "$text" }}>{"Body"}</Text>
              </Link>
              <Spacer x={0.2} />
              <Link
                css={{
                  background: activeMenu === "pagination" ? "$background" : "$backgroundContrast",
                  p: 5,
                  pr: 10,
                  pl: 10,
                  br: "$sm",
                  "@xsMax": { width: "90%" },
                  ai: "center",
                  color: "$text",
                }}
                onClick={() => setActiveMenu("pagination")}
              >
                <Text>{"Pagination"}</Text>
              </Link>
              <div style={{ position: "absolute", right: 15 }}>
                {requestSuccess && (
                <>
                  <Badge color="success">
                    {`${requestSuccess.statusCode} ${requestSuccess.statusText}`}
                  </Badge>
                </>
                )}
                {requestError && (
                  <Badge color="error">
                    {`${requestError.statusCode} ${requestError.statusText}`}
                  </Badge>
                )}
              </div>
            </Row>

            <Spacer y={0.5} />
            <Row>
              <Divider />
            </Row>
            <Spacer y={0.5} />

            {activeMenu === "headers" && (
              <Row className="apibuilder-headers-tut">
                <Container css={{ pl: 0, pr: 0 }}>
                  {fullConnection.options && fullConnection.options.length > 0 && (
                    <>
                      <Row>
                        <Checkbox
                          label="Include connection headers"
                          isSelected={!!apiRequest.useGlobalHeaders}
                          onChange={_onToggleGlobal}
                          size="sm"
                        />
                      </Row>
                      <Spacer y={0.5} />
                      {apiRequest.useGlobalHeaders && (
                        <>
                          <Container css={{ pl: 0, pr: 0 }}>
                            {fullConnection.options.map((header) => {
                              return (
                                <Row key={header}>
                                  <Input
                                    value={Object.keys(header)[0]}
                                    bordered
                                    fullWidth
                                    animated={false}
                                  />
                                  <Spacer x={0.5} />
                                  <Input
                                    value={header[Object.keys(header)[0]]}
                                    bordered
                                    fullWidth
                                    animated={false}
                                  />
                                </Row>
                              );
                            })}
                          </Container>
                          <Spacer y={1} />
                          <Divider />
                          <Spacer y={0.5} />
                        </>
                      )}
                    </>
                  )}
                  <Container css={{ pl: 0, pr: 0 }} gap={1}>
                    {apiRequest.formattedHeaders && apiRequest.formattedHeaders.map((header) => {
                      return (
                        <div key={header.id}>
                          <Row>
                            <Input
                              placeholder="Header"
                              value={header.key}
                              onChange={(e) => {
                                _onChangeHeader(header.id, e.target.value);
                              }}
                              bordered
                            />
                            <Spacer x={0.5} />
                            <Input
                              placeholder="Value"
                              value={header.value}
                              onChange={(e) => {
                                _onChangeHeaderValue(header.id, e.target.value);
                              }}
                              bordered
                            />
                            <Spacer x={0.5} />
                            <Button
                              icon={<CloseSquare />}
                              onClick={() => _removeHeader(header.id)}
                              color="error"
                              light
                              css={{ minWidth: "fit-content" }}
                            />
                          </Row>
                          <Spacer y={0.5} />
                        </div>
                      );
                    })}
                  </Container>

                  <Spacer y={1} />
                  <Button
                    iconRight={<Plus />}
                    size="sm"
                    onClick={_addHeader}
                    bordered
                    auto
                  >
                    Add header
                  </Button>
                </Container>
              </Row>
            )}
            {activeMenu === "body" && (
              <Row>
                <div style={{ width: "100%" }}>
                  <AceEditor
                    mode="json"
                    theme={isDark ? "one_dark" : "tomorrow"}
                    style={{ borderRadius: 10 }}
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
              </Row>
            )}
            {activeMenu === "pagination" && (
              <Row xs={12}>
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
              </Row>
            )}
          </Container>
        </Grid>
        <Grid xs={12} sm={5} md={4}>
          <Container>
            <Row>
              <div className="apibuilder-type-tut">
                <Dropdown isBordered>
                  <Dropdown.Trigger>
                    <Input
                      value={apiRequest.method}
                      bordered
                      fullWidth
                      animated={false}
                      contentRight={<ChevronDown set="light" />}
                    />
                  </Dropdown.Trigger>
                  <Dropdown.Menu
                    onAction={(key) => _changeMethod(key)}
                    selectedKeys={[apiRequest.method]}
                    selectionMode="single"
                  >
                    {methods.map((method) => (
                      <Dropdown.Item key={method.value}>
                        {method.text}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </div>
              <Spacer x={1} />
              <div className="apibuilder-request-tut" style={{ width: "100%" }}>
                <Button
                  iconRight={requestLoading ? null : <Play />}
                  disabled={requestLoading}
                  onClick={() => _onTest()}
                  auto
                  shadow
                  css={{ w: "100%" }}
                >
                  {requestLoading ? <Loading type="points-opacity" /> : "Send the request"}
                </Button>
              </div>
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
                content={(
                  <>
                    <p>{"Chartbrew will use cached data for extra editing speed ⚡️⚡️⚡️"}</p>
                    <p>{"The cache gets automatically invalidated when you change the configuration of the request."}</p>
                  </>
                )}
                css={{ zIndex: 10000 }}
                placement="bottom"
              >
                <InfoCircle size="small" />
              </Tooltip>
            </Row>
            <Spacer y={0.5} />
            <Row>
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
                  className="apibuilder-result-tut"
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

ApiBuilder.defaultProps = {
  dataRequest: null,
};

ApiBuilder.propTypes = {
  connection: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  runDataRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  dataRequest: PropTypes.object,
  changeTutorial: PropTypes.func.isRequired,
  chart: PropTypes.object.isRequired,
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
    runDataRequest: (projectId, chartId, datasetId, getCache) => {
      return dispatch(runDataRequestAction(projectId, chartId, datasetId, getCache));
    },
    changeTutorial: (tutorial) => dispatch(changeTutorialAction(tutorial)),
    getConnection: (projectId, connectionId) => {
      return dispatch(getConnectionAction(projectId, connectionId));
    },
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ApiBuilder));
