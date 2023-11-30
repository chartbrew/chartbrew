import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch } from "react-redux";
import {
  Button, Checkbox, Divider, Input, Link, Spacer, Tooltip, Chip,
  Tabs, Tab, Select, SelectItem,
} from "@nextui-org/react";
import AceEditor from "react-ace";
import uuid from "uuid/v4";
import { toast } from "react-toastify";
import { useParams } from "react-router";
import { LuInfo, LuPlay, LuPlus, LuPlusCircle, LuTrash, LuXCircle } from "react-icons/lu";

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
  getConnection,
} from "../../../slices/connection";
import Container from "../../../components/Container";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import useThemeDetector from "../../../modules/useThemeDetector";

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

  const isDark = useThemeDetector();
  const params = useParams();
  const dispatch = useDispatch();

  const {
    dataRequest, onChangeRequest, runDataRequest,
    connection, onSave, changeTutorial, chart,
    onDelete, responses,
  } = props;

  // on init effect
  useEffect(() => {
    if (dataRequest) {
      // format the headers into key: value -> value: value format
      const formattedApiRequest = { ...dataRequest };
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

    dispatch(getConnection({ team_id: params.team_id, connection_id: connection.id }))
      .then((data) => {
        setFullConnection(data.payload);
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
      runDataRequest(params.projectId, params.chartId, dr.id, getCache)
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
    <div className="container mx-auto">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-7">
          <Row justify="space-between" align="center">
            <Text b size={"lg"}>{connection.name}</Text>
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
              <Spacer x={1} />
              <Tooltip content="Delete this data request" placement="bottom" css={{ zIndex: 99999 }}>
                <Button
                  color="danger"
                  isIconOnly
                  auto
                  size="sm"
                  variant="bordered"
                  onClick={() => onDelete()}
                >
                  <LuTrash />
                </Button>
              </Tooltip>
            </Row>
          </Row>
          <Spacer y={2} />
          <Row>
            <Divider />
          </Row>
          <Spacer y={4} />
          <Row align="center" className="apibuilder-route-tut">
            <Input
              startContent={(
                <div className="pointer-events-none flex items-center">
                  <span className="text-default-400 text-small">
                    {`${connection.host}`}
                  </span>
                </div>
              )}
              placeholder="/route?key=value"
              autoFocus
              value={apiRequest.route || ""}
              onChange={(e) => _onChangeRoute(e.target.value)}
              fullWidth
              variant="bordered"
              disableAnimation
              css={{
                "& .nextui-input-label--left": { minWidth: "max-content" }
              }}
            />
          </Row>
          <Spacer y={2} />
          <Row align="center">
            <Text size="sm">{"Available variables: "}</Text>
            <Spacer x={1} />
            <Tooltip
              content={chart.startDate || "Set this value in chart date settings first"}
            >
              <Link>
                <Chip
                  color="primary"
                  variant="faded"
                  endContent={(
                    <a onClick={() => chart.startDate && _onChangeRoute(`${apiRequest.route}{{ start_date }}`)} className="cursor-pointer">
                      <LuPlusCircle />
                    </a>
                  )}
                >
                  {"{{start_date}}"}
                </Chip>
              </Link>
            </Tooltip>
            <Spacer x={0.5} />
            <Tooltip
              content={chart.endDate || "Set this value in chart date settings first"}
            >
              <Link onClick={() => chart.endDate && _onChangeRoute(`${apiRequest.route}{{end_date}}`)}>
                <Chip
                  color="primary"
                  variant="faded"
                  endContent={(
                    <a onClick={() => chart.endDate && _onChangeRoute(`${apiRequest.route}{{ end_date }}`)} className="cursor-pointer">
                      <LuPlusCircle />
                    </a>
                  )}
                >
                  {"{{end_date}}"}
                </Chip>
              </Link>
            </Tooltip>
          </Row>
          <Spacer y={4} />
          <Row className="apibuilder-menu-tut justify-between">
            <Tabs
              selectedKey={activeMenu}
              onSelectionChange={(key) => setActiveMenu(key)}
              disabledKeys={apiRequest.method === "GET" || apiRequest.method === "OPTIONS" ? ["body"] : []}
            >
              <Tab key="headers" title="Headers" />
              <Tab key="body" title="Body" />
              <Tab key="pagination" title="Pagination" />
            </Tabs>
            {requestSuccess && (
              <>
                <Chip color="success" size="sm">
                  {`${requestSuccess.statusCode} ${requestSuccess.statusText}`}
                </Chip>
              </>
            )}
            {requestError && (
              <Chip color="danger" size="sm">
                {`${requestError.statusCode} ${requestError.statusText}`}
              </Chip>
            )}
          </Row>

          <Spacer y={2} />
          <Row>
            <Divider />
          </Row>
          <Spacer y={2} />

          {activeMenu === "headers" && (
            <div className="apibuilder-headers-tut">
              {fullConnection.options && fullConnection.options.length > 0 && (
                <>
                  <Row>
                    <Checkbox
                      isSelected={!!apiRequest.useGlobalHeaders}
                      onChange={_onToggleGlobal}
                      size="sm"
                    >
                      Include connection headers
                    </Checkbox>
                  </Row>
                  <Spacer y={2} />
                  {apiRequest.useGlobalHeaders && (
                    <>
                      <Container className={"pl-0 pr-0"}>
                        {fullConnection.options.map((header) => {
                          return (
                            <Row key={header}>
                              <Input
                                value={Object.keys(header)[0]}
                                variant="bordered"
                                fullWidth
                                disableAnimation
                              />
                              <Spacer x={1} />
                              <Input
                                value={header[Object.keys(header)[0]]}
                                variant="bordered"
                                fullWidth
                                disableAnimation
                              />
                            </Row>
                          );
                        })}
                      </Container>
                      <Spacer y={2} />
                      <Divider />
                      <Spacer y={1} />
                    </>
                  )}
                </>
              )}
              <Container className={"pl-0 pr-0 gap-1"}>
                {apiRequest.formattedHeaders && apiRequest.formattedHeaders.map((header) => {
                  return (
                    <div key={header.id}>
                      <Row>
                        <Input
                          placeholder="Header"
                          labelPlacement="outside"
                          value={header.key}
                          onChange={(e) => {
                            _onChangeHeader(header.id, e.target.value);
                          }}
                          variant="bordered"
                        />
                        <Spacer x={1} />
                        <Input
                          placeholder="Value"
                          labelPlacement="outside"
                          value={header.value}
                          onChange={(e) => {
                            _onChangeHeaderValue(header.id, e.target.value);
                          }}
                          variant="bordered"
                        />
                        <Spacer x={1} />
                        <Button
                          isIconOnly
                          onClick={() => _removeHeader(header.id)}
                          color="danger"
                          variant="light"
                        >
                          <LuXCircle />
                        </Button>
                      </Row>
                      <Spacer y={1} />
                    </div>
                  );
                })}
              </Container>

              <Spacer y={2} />
              <Button
                endContent={<LuPlus />}
                size="sm"
                onClick={_addHeader}
                variant="bordered"
              >
                Add header
              </Button>
            </div>
          )}
          {activeMenu === "body" && (
            <Row>
              <div className="w-full h-full">
                <AceEditor
                  mode="json"
                  theme={isDark ? "one_dark" : "tomorrow"}
                  style={{ borderRadius: 10 }}
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
            <Row className={"pt-4"}>
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
        </div>
        <div className="col-span-12 md:col-span-5">
          <Row align={"center"} className="gap-4 apibuilder-type-tut">
            <Select
              variant="bordered"
              disableAnimation
              onSelectionChange={(keys) => _changeMethod(keys.currentKey)}
              selectedKeys={[apiRequest.method]}
              selectionMode="single"
              labelPlacement="ouside"
            >
              {methods.map((method) => (
                <SelectItem key={method.value}>
                  {method.text}
                </SelectItem>
              ))}
            </Select>
            <Button
              endContent={<LuPlay />}
              isLoading={requestLoading}
              onClick={() => _onTest()}
              fullWidth
              color="primary"
            >
              {"Send the request"}
            </Button>
          </Row>
          <Spacer y={1} />
          <Row align="center">
            <Checkbox
              isSelected={!invalidateCache}
              onChange={() => setInvalidateCache(!invalidateCache)}
              size="sm"
            >
              Use cache
            </Checkbox>
            <Spacer x={0.5} />
            <Tooltip
              content={(
                <>
                  <p>{"Chartbrew will use cached data for extra editing speed ⚡️⚡️⚡️"}</p>
                  <p>{"The cache gets automatically invalidated when you change the configuration of the request."}</p>
                </>
              )}
              placement="bottom"
            >
              <div><LuInfo /></div>
            </Tooltip>
          </Row>
          <Spacer y={2} />
          <Row>
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
                className="apibuilder-result-tut"
              />
            </div>
          </Row>
          <Spacer y={2} />
          <Row align="center">
            <LuInfo />
            <Spacer x={1} />
            <Text size="sm">
              {"This is a preview and it might not show all data in order to keep things fast in the UI."}
            </Text>
          </Row>
        </div>
      </div>
    </div>
  );
}

ApiBuilder.defaultProps = {
  dataRequest: null,
  chart: {},
};

ApiBuilder.propTypes = {
  connection: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  runDataRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  dataRequest: PropTypes.object,
  changeTutorial: PropTypes.func.isRequired,
  chart: PropTypes.object,
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
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ApiBuilder);
