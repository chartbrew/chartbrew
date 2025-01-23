import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Button, Checkbox, Divider, Input, Link, Spacer, Tooltip, Chip,
  Tabs, Tab, Select, SelectItem, PopoverTrigger, Popover, PopoverContent,
} from "@heroui/react";
import AceEditor from "react-ace";
import { v4 as uuid } from "uuid";
import toast from "react-hot-toast";
import { useParams } from "react-router";
import { LuCalendarDays, LuInfo, LuPlay, LuPlus, LuCirclePlus, LuTrash, LuCircleX } from "react-icons/lu";
import { endOfDay, startOfDay, sub } from "date-fns";
import { Calendar } from "react-date-range";
import { enGB } from "date-fns/locale";
import moment from "moment";
import { cloneDeep, isEqual } from "lodash";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/mode-javascript";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import ApiPagination from "./ApiPagination";
import { runDataRequest, selectDataRequests } from "../../../slices/dataset";
import {
  getConnection,
} from "../../../slices/connection";
import Container from "../../../components/Container";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import { useTheme } from "../../../modules/ThemeContext";

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
  const [requestError, setRequestError] = useState("");
  const [invalidateCache, setInvalidateCache] = useState(false);
  const [fullConnection, setFullConnection] = useState({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [variables, setVariables] = useState({
    startDate: {
      value: startOfDay(sub(new Date(), { months: 1 })),
      type: "date",
    },
    endDate: {
      value: endOfDay(new Date()),
      type: "date",
    },
    dateFormat: {
      value: "YYYY-MM-DD",
      type: "string",
    },
  });

  const { isDark } = useTheme();
  const params = useParams();
  const dispatch = useDispatch();
  const initRef = useRef(false);
  const connectionInitRef = useRef(false);

  const stateDrs = useSelector((state) => selectDataRequests(state, params.datasetId));

  const {
    dataRequest, onChangeRequest, connection, onSave, chart, onDelete,
  } = props;

  // on init effect
  useEffect(() => {
    if (dataRequest?.id && !initRef.current) {
      initRef.current = true;

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

      if (dataRequest.variables) {
        const formattedVariables = cloneDeep(dataRequest.variables);
        if (formattedVariables.startDate && formattedVariables.startDate.value) {
          formattedVariables.startDate.value = startOfDay(moment(formattedVariables.startDate.value).toDate());
        }
        if (formattedVariables.endDate && formattedVariables.endDate.value) {
          formattedVariables.endDate.value = endOfDay(moment(formattedVariables.endDate.value).toDate());
        }
        setVariables(formattedVariables);
      } else if (variables) {
        formattedApiRequest.variables = variables;
      }

      setApiRequest(formattedApiRequest);
    }
  }, [dataRequest]);

  useEffect(() => {
    const newApiRequest = apiRequest;

    // automate the pagination template here (to a possible extent)
    if (connection && apiRequest && !apiRequest.template) {
      if (connection?.host?.indexOf("api.stripe.com") > -1) {
        newApiRequest.template = "stripe";
        onChangeRequest(newApiRequest);
      }
    }

    if (connection && !connectionInitRef.current) {
      dispatch(getConnection({ team_id: params.teamId, connection_id: connection.id }))
        .then((data) => {
          setFullConnection(data.payload);
        })
        .catch(() => {});
      connectionInitRef.current = true;
    }
  }, [apiRequest, connection]);

  useEffect(() => {
    if (stateDrs && stateDrs.length > 0) {
      const selectedResponse = stateDrs.find((o) => o.id === dataRequest.id);
      if (selectedResponse?.response) {
        setResult(JSON.stringify(selectedResponse.response, null, 2));
      }
    }
  }, [stateDrs, apiRequest]);

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

  const _onSaveVariables = () => {
    setApiRequest({ ...apiRequest, variables });
    toast.success("Variables saved 👌");
  };

  const _onTest = (dr = apiRequest) => {
    const { formattedHeaders } = dr;
    let newHeaders = {};
    for (let i = 0; i < formattedHeaders.length; i++) {
      if (formattedHeaders[i].key && formattedHeaders[i].value) {
        newHeaders = { ...newHeaders, [formattedHeaders[i].key]: formattedHeaders[i].value };
      }
    }

    const finalApiRequest = { dataRequest: dr };
    finalApiRequest.dataRequest.headers = newHeaders;

    setRequestLoading(true);
    setRequestSuccess(false);
    setRequestError("");

    onSave(dr).then(() => {
      const getCache = !invalidateCache;
      dispatch(runDataRequest({
        team_id: params.teamId,
        dataset_id: params.datasetId,
        dataRequest_id: dr.id,
        getCache,
      }))
        .then((data) => {
          const result = data.payload;
          if (result?.status?.statusCode >= 400) {
            setRequestError(result);
          }
          if (result?.response?.dataRequest?.responseData?.data) {
            setResult(JSON.stringify(result.response.dataRequest.responseData.data, null, 2));
            setRequestSuccess(result.status);
          }
          setRequestLoading(false);
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
                    {`${fullConnection.host}`}
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
              content={chart.startDate || "You can set this value later in the chart date settings"}
            >
              <Link>
                <Chip
                  color="primary"
                  variant="faded"
                  endContent={(
                    <a onClick={() => chart.startDate && _onChangeRoute(`${apiRequest.route}{{ start_date }}`)} className="cursor-pointer">
                      <LuCirclePlus />
                    </a>
                  )}
                >
                  {"{{start_date}}"}
                </Chip>
              </Link>
            </Tooltip>
            <Spacer x={0.5} />
            <Tooltip
              content={chart.endDate || "You can set this value later in the chart date settings"}
            >
              <Link onClick={() => chart.endDate && _onChangeRoute(`${apiRequest.route}{{end_date}}`)}>
                <Chip
                  color="primary"
                  variant="faded"
                  endContent={(
                    <a onClick={() => chart.endDate && _onChangeRoute(`${apiRequest.route}{{ end_date }}`)} className="cursor-pointer">
                      <LuCirclePlus />
                    </a>
                  )}
                >
                  {"{{end_date}}"}
                </Chip>
              </Link>
            </Tooltip>
          </Row>
          <Spacer y={4} />
          {apiRequest?.route && (apiRequest.route.indexOf("{{start_date}}") > -1 || apiRequest.route.indexOf("{{end_date}}") > -1) && (
            <>
              <div className="border-1 border-content3 rounded-lg px-4 py-2">
                <p>Configure variables</p>
                <Spacer y={2} />
                <div className="flex flex-row items-center gap-2">
                  <Popover placement="bottom">
                    <PopoverTrigger>
                      <Input
                        label="{{start_date}}"
                        value={(variables?.startDate?.value && moment(variables.startDate.value).format(variables?.dateFormat?.value || "")) || ""}
                        variant="bordered"
                        endContent={<LuCalendarDays />}
                        readOnly
                        classNames={{ input: "text-left" }}
                      />
                    </PopoverTrigger>
                    <PopoverContent>
                      <div className="p-2">
                        <Calendar
                          date={variables?.startDate?.value || new Date()}
                          onChange={(date) => setVariables({ ...variables, startDate: { ...variables.startDate, value: startOfDay(date) } })}
                          locale={enGB}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Popover placement="bottom">
                    <PopoverTrigger>
                      <Input
                        label="{{end_date}}"
                        value={(variables?.endDate?.value && moment(variables.endDate.value).format(variables?.dateFormat?.value || "")) || ""}
                        variant="bordered"
                        endContent={<LuCalendarDays />}
                        readOnly
                        classNames={{ input: "text-left" }}
                      />
                    </PopoverTrigger>
                    <PopoverContent>
                      <div className="p-2">
                        <Calendar
                          date={variables?.endDate?.value || new Date()}
                          onChange={(date) => setVariables({ ...variables, endDate: { ...variables.endDate, value: endOfDay(date) } })}
                          locale={enGB}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Spacer y={2} />
                <div>
                  <Input
                    label="Date format"
                    labelPlacement="outside"
                    value={variables?.dateFormat?.value}
                    onChange={(e) => setVariables({ ...variables, dateFormat: { ...variables.dateFormat, value: e.target.value } })}
                    variant="bordered"
                    placeholder="YYYY-MM-DD"
                    description={(
                      <Text small>
                        {"See "}
                        <a
                          href="https://momentjs.com/docs/#/displaying/format/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {"moment.js documentation"}
                        </a>
                        {" for how to format dates."}
                      </Text>
                    )}
                  />
                </div>
                <Spacer y={2} />
                <div>
                  <Button
                    color={isEqual(variables, apiRequest.variables) ? "success" : "primary"}
                    variant={isEqual(variables, apiRequest.variables) ? "flat" : "solid"}
                    size="sm"
                    onClick={() => _onSaveVariables()}
                  >
                    {isEqual(variables, apiRequest.variables) ? "Saved" : "Save"}
                  </Button>
                </div>
              </div>
              <Spacer y={4} />
            </>
          )}
          <Row className="apibuilder-menu-tut">
            <Tabs
              selectedKey={activeMenu}
              onSelectionChange={(key) => setActiveMenu(key)}
              disabledKeys={apiRequest.method === "GET" || apiRequest.method === "OPTIONS" ? ["body"] : []}
            >
              <Tab key="headers" title="Headers" />
              <Tab key="body" title="Body" />
              <Tab key="pagination" title="Pagination" />
            </Tabs>
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
                          <LuCircleX />
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
                  className="rounded-md border-1 border-solid border-content3"
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
              aria-label="Select a method"
            >
              {methods.map((method) => (
                <SelectItem key={method.value} textValue={method.text}>
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
          <Spacer y={2} />
          <div className="flex flex-row justify-between items-center">
            <div className="flex flex-row gap-2 items-center">
              <Checkbox
                isSelected={!invalidateCache}
                onChange={() => setInvalidateCache(!invalidateCache)}
                size="sm"
              >
                Use cache
              </Checkbox>
              <Tooltip
                content={(
                  <>
                    <p>{"Chartbrew will use cached data for extra editing speed ⚡️"}</p>
                    <p>{"The cache gets automatically invalidated when you change the configuration of the request."}</p>
                  </>
                )}
                placement="bottom"
              >
                <div><LuInfo /></div>
              </Tooltip>
            </div>

            <div>
              {requestSuccess && (
                <>
                  <Chip color="success" size="sm" variant="flat">
                    {`${requestSuccess.statusCode} ${requestSuccess.statusText}`}
                  </Chip>
                </>
              )}
              {requestError && (
                <Chip color="danger" size="sm" variant="flat">
                  {`${requestError?.status?.statusCode} ${requestError?.status?.statusText}`}
                </Chip>
              )}
            </div>
          </div>
          <Spacer y={2} />
          <Row>
            <div className="w-full">
              <AceEditor
                mode="json"
                theme={isDark ? "one_dark" : "tomorrow"}
                style={{ borderRadius: 10 }}
                height="450px"
                width="none"
                value={(requestError && JSON.stringify(requestError)) || result || ""}
                name="resultEditor"
                readOnly
                editorProps={{ $blockScrolling: false }}
                className="apibuilder-result-tut rounded-md border-1 border-solid border-content3"
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
  chart: PropTypes.object,
  onDelete: PropTypes.func.isRequired,
};

export default ApiBuilder;
