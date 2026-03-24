import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import {
  Button, Popover, Divider, Input, Tooltip, Spacer, Chip, Checkbox,
  Select, PopoverTrigger, PopoverContent, Code, Autocomplete,
  Badge, EmptyState, Label, ListBox, SearchField, useFilter,
} from "@heroui/react";
import AceEditor from "react-ace";
import _ from "lodash";
import toast from "react-hot-toast";
import { Calendar } from "react-date-range";
import { format, sub } from "date-fns";
import { enGB } from "date-fns/locale";
import { LuCalendarDays, LuInfo, LuPlay, LuTrash } from "react-icons/lu";
import { useParams } from "react-router";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { getDataRequestBuilderMetadata, runDataRequest, selectDataRequests } from "../../../slices/dataset";
import {
  testRequest, getConnection,
} from "../../../slices/connection";
import { getMetadata } from "./apiBoilerplate";
import { secondary } from "../../../config/colors";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import { useTheme } from "../../../modules/ThemeContext";
import DataTransform from "../../Dataset/DataTransform";
import { selectTeam } from "../../../slices/team";

const validDate = /[0-9]{4}-[0-9]{2}-[0-9]{2}|today|yesterday|[0-9]+(daysAgo)/g;
const validEndDate = /[0-9]{4}-[0-9]{2}-[0-9]{2}|today|yesterday|[0-9]+(daysAgo)/g;

/*
  The API Data Request builder
*/
function GaBuilder(props) {
  const {
    dataRequest, connection, onSave, onDelete,
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
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [showTransform, setShowTransform] = useState(false);
  const { contains } = useFilter({ sensitivity: "base" });

  const { isDark } = useTheme();
  const initRef = React.useRef(null);
  const params = useParams();
  const dispatch = useDispatch();

  const stateDrs = useSelector((state) => selectDataRequests(state, params.datasetId));
  const team = useSelector(selectTeam);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      _initRequest();
    }
  }, [dataRequest]);

  useEffect(() => {
    setMetadataLoaded(false);
  }, [connection?.id, dataRequest?.id]);

  useEffect(() => {
    if (connection?.id && !metadataLoaded && team?.id) {
      if (params.datasetId && dataRequest?.dataset_id && dataRequest?.id) {
        dispatch(getDataRequestBuilderMetadata({
          team_id: team?.id,
          dataset_id: dataRequest.dataset_id,
          dataRequest_id: dataRequest.id,
        }))
          .then((data) => {
            setAnalyticsData(data.payload?.accounts || []);
            setMetadataLoaded(true);
            _initRequest();
          })
          .catch(() => {
            setMetadataLoaded(true);
          });
        return;
      }

      dispatch(getConnection({ team_id: team?.id, connection_id: connection.id }))
        .then((data) => {
          _onFetchAccountData(data.payload);
          setMetadataLoaded(true);
        })
        .catch(() => {});
    }
  }, [connection, dataRequest?.dataset_id, dataRequest?.id, dispatch, metadataLoaded, params.datasetId, team]);

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
      && !configuration.metrics
    ) {
      setConfiguration({ ...configuration, metrics: gaRequest.configuration.metrics });
    }

    if (dimensionsOptions.length > 0
      && gaRequest.configuration
      && gaRequest.configuration.dimensions
      && !configuration.dimensions
    ) {
      setConfiguration({ ...configuration, dimensions: gaRequest.configuration.dimensions });
    }
  }, [metricsOptions, dimensionsOptions]);

  useEffect(() => {
    if (stateDrs && stateDrs.length > 0) {
      const selectedResponse = stateDrs.find((o) => o.id === dataRequest.id);
      if (selectedResponse?.response) {
        setResult(JSON.stringify(selectedResponse.response, null, 2));
      }
    }
  }, [stateDrs, gaRequest]);

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
        _populateMetadata(dataRequest.configuration.propertyId);
      }
    }
  };

  const _applyPropertyMetadata = (metadata) => {
    if (!metadata) return;

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
  };

  const _populateMetadata = (propertyId) => {
    if (params.datasetId && dataRequest?.dataset_id && dataRequest?.id) {
      dispatch(getDataRequestBuilderMetadata({
        team_id: team?.id,
        dataset_id: dataRequest.dataset_id,
        dataRequest_id: dataRequest.id,
        property_id: propertyId,
      }))
        .then((data) => {
          _applyPropertyMetadata(data.payload?.metadata);
        })
        .catch(() => {});
      return;
    }

    getMetadata(team?.id, connection.id, propertyId)
      .then((metadata) => {
        _applyPropertyMetadata(metadata);
      });
  };

  const _onTest = (request = gaRequest) => {
    setRequestLoading(true);
    _onChangeRequest({ configuration });

    if (request === null) request = gaRequest;
    const requestToSave = { ...request, configuration };
    onSave(requestToSave).then(() => {
      _onRunRequest(requestToSave);
    });
  };

  const _onRunRequest = (dr) => {
    setRequestError("");

    const getCache = !invalidateCache;
    dispatch(runDataRequest({
      team_id: team?.id,
      dataset_id: params.datasetId,
      dataRequest_id: dr.id,
      getCache,
    }))
      .then((data) => {
        const result = data.payload;
        if (result?.status?.statusCode >= 400) {
          setRequestError(result.response);
        }
        if (result?.response?.dataRequest?.responseData?.data) {
          setResult(JSON.stringify(result.response.dataRequest.responseData.data, null, 2));
        }
        setRequestLoading(false);
      })
      .catch((error) => {
        setRequestLoading(false);
        toast.error("The request failed. Please check your request 🕵️‍♂️");
        setRequestError(error?.message);
      });
  };

  const _onFetchAccountData = (conn) => {
    setCollectionsLoading(true);
    return dispatch(testRequest({ team_id: team?.id, connection: conn }))
      .then((data) => {
        return data.payload.json();
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
    if (value !== configuration.propertyId) {
      setConfiguration({ ...configuration, propertyId: value });
      _populateMetadata(value);
    }

    setConfiguration({ ...configuration, propertyId: value });
  };

  const _renderCalendar = (type) => (
    <div>
      <Popover>
        <PopoverTrigger>
          <Button
            isIconOnly
            variant="light"
            color="secondary"
            isDisabled={!configuration.propertyId}
          >
            <LuCalendarDays />
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <Calendar
            date={_getDateForCalendar(configuration[type])}
            onChange={(date) => {
              setConfiguration({ ...configuration, [type]: format(date, "yyyy-MM-dd") });
            }}
            locale={enGB}
            color={secondary}
          />
        </PopoverContent>
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

  const _onTransformSave = (transformConfig) => {
    const updatedRequest = { ...gaRequest, transform: transformConfig };
    setGaRequest(updatedRequest);
    onSave(updatedRequest);
  };

  return (
    <div style={styles.container}>
      <div className="grid grid-cols-12 gap-4 pl-1 pr-1 md:pl-4 md:pr-4">
        <div className="col-span-12 sm:col-span-7">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 flex justify-between">
              <Text b size={"lg"}>{connection.name}</Text>
              <div className="flex flex-row items-center gap-2">
                <Button
                  color="primary"
                  size="sm"
                  onPress={() => _onSavePressed()}
                  isLoading={saveLoading || requestLoading}
                >
                  {"Save"}
                </Button>
                <Badge color="success" content="" placement="top-right" shape="circle" isInvisible={!gaRequest.transform?.enabled}>
                  <Button
                    color="primary"
                    variant="flat"
                    size="sm"
                    onPress={() => setShowTransform(true)}
                  >
                    Transform
                  </Button>
                </Badge>
                <Tooltip content="Delete this data request" placement="bottom" css={{ zIndex: 99999 }}>
                  <Button
                    color="danger"
                    isIconOnly
                    size="sm"
                    variant="bordered"
                    onPress={() => onDelete()}
                  >
                    <LuTrash />
                  </Button>
                </Tooltip>
              </div>
            </div>
            <div className="col-span-12">
              <Divider />
            </div>
            <div className="col-span-12 sm:col-span-6 gabuilder-collections-tut">
              <Select
                variant="secondary"
                value={configuration.accountId || null}
                placeholder="Select an account"
                isPending={collectionsLoading}
                onChange={(value) => _onAccountSelected(value)}
                selectionMode="single"
                aria-label="Select an account"
              >
                <Label>Account</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {accountOptions.map((account) => (
                      <ListBox.Item key={account.value} id={account.value} textValue={account.text}>
                        {account.text}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <div className="col-span-12 sm:col-span-6">
              <Select
                isDisabled={!configuration.accountId}
                variant="secondary"
                isPending={collectionsLoading}
                value={configuration.propertyId || null}
                placeholder="Select a property"
                onChange={(value) => _onPropertySelected(value)}
                selectionMode="single"
                aria-label="Select a property"
              >
                <Label>Property</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {propertyOptions.map((property) => (
                      <ListBox.Item key={property.value} id={property.value} textValue={property.text}>
                        {property.text}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <div className="col-span-12 gabuilder-query-tut">
              <div style={styles.row}>
                <Text>
                  {"Choose a metric "}
                </Text>
                <Spacer x={1} />
                <Tooltip
                  content="You can add multiple metrics by creating another dataset for this chart. Click on 'Build chart', then 'Add new dataset' on the right."
                  className="max-w-[500px]"
                  placement="right-start"
                >
                  <div><LuInfo /></div>
                </Tooltip>
              </div>
              <Autocomplete
                isDisabled={!configuration.propertyId}
                variant="secondary"
                isPending={collectionsLoading}
                value={configuration.metrics || null}
                placeholder="Select a metric"
                errorMessage={formErrors.metrics}
                color={formErrors.metrics ? "danger" : "default"}
                onChange={(value) => setConfiguration({ ...configuration, metrics: value })}
                selectionMode="single"
                aria-label="Select a metric"
              >
                <Autocomplete.Trigger>
                  <Autocomplete.Value />
                  <Autocomplete.Indicator />
                </Autocomplete.Trigger>
                <Autocomplete.Popover>
                  <Autocomplete.Filter>
                    <SearchField placeholder="Search metrics..." />
                    <ListBox
                      items={metricsOptions}
                      filter={contains}
                      renderEmptyState={() => <EmptyState>No metrics found.</EmptyState>}
                    >
                      {(item) => (
                        <ListBox.Item key={item.key} id={item.key} textValue={item.text}>
                          <div>
                            <Text b>{item.text}</Text>
                            <Text small className={"text-default-400"}>
                              {" - "}
                              {item.key}
                            </Text>
                          </div>
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      )}
                    </ListBox>
                  </Autocomplete.Filter>
                </Autocomplete.Popover>
              </Autocomplete>
            </div>
            <div className="col-span-12">
              <Text>Choose a dimension</Text>
              <Autocomplete
                isDisabled={!configuration.propertyId}
                variant="secondary"
                value={configuration.dimensions || null}
                onChange={(value) => setConfiguration({ ...configuration, dimensions: value })}
                selectionMode="single"
                placeholder="Select a dimension"
                errorMessage={formErrors.dimensions}
                color={formErrors.dimensions ? "danger" : "default"}
                aria-label="Select a dimension"
              >
                <Autocomplete.Trigger>
                  <Autocomplete.Value />
                  <Autocomplete.Indicator />
                </Autocomplete.Trigger>
                <Autocomplete.Popover>
                  <Autocomplete.Filter>
                    <SearchField placeholder="Search dimensions..." />
                    <ListBox
                      items={dimensionsOptions}
                      filter={contains}
                      renderEmptyState={() => <EmptyState>No dimensions found.</EmptyState>}
                    >
                      {(item) => (
                        <ListBox.Item key={item.key} id={item.key} textValue={item.text}>
                          <Text>{item.text}</Text>
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      )}
                    </ListBox>
                  </Autocomplete.Filter>
                </Autocomplete.Popover>
              </Autocomplete>
            </div>
            <div className="col-span-12">
              <Text>Start date</Text>
              <Input
                endContent={_renderCalendar("startDate")}
                placeholder="YYYY-MM-DD"
                labelPlacement="outside"
                value={configuration.startDate}
                disabled={!configuration.propertyId}
                onChange={(e) => {
                  setConfiguration({ ...configuration, startDate: e.target.value });
                }}
                variant="bordered"
                fullWidth
              />
              <Spacer y={1} />
              <div className="flex flex-row gap-1 items-center">
                <Chip
                  variant="flat"
                  color="secondary"
                  className="cursor-pointer hover:shadow-xs hover:saturate-200 transition-all"
                  onClick={() => setConfiguration({ ...configuration, startDate: "today" })}
                >
                  today
                </Chip>
                <Chip
                  variant="flat"
                  color="secondary"
                  className="cursor-pointer hover:shadow-xs hover:saturate-200 transition-all"
                  onClick={() => setConfiguration({ ...configuration, startDate: "yesterday" })}
                >
                  yesterday
                </Chip>
                <Chip
                  variant="flat"
                  color="secondary"
                  className="cursor-pointer hover:shadow-xs hover:saturate-200 transition-all"
                  onClick={() => setConfiguration({ ...configuration, startDate: "30daysAgo" })}
                >
                  30daysAgo
                </Chip>
                <Chip
                  onClick={() => setDateHelp(!dateHelp)}
                  variant="bordered"
                  color={dateHelp ? "secondary" : "default"}
                  startContent={<LuInfo />}
                  className="cursor-pointer hover:shadow-xs hover:saturate-200 transition-all"
                >
                  info
                </Chip>
              </div>
            </div>
            <div className="col-span-12">
              <Text>End date</Text>
              <Input
                endContent={_renderCalendar("endDate")}
                placeholder="YYYY-MM-DD"
                labelPlacement="outside"
                value={configuration.endDate}
                disabled={!configuration.propertyId}
                onChange={(e) => {
                  setConfiguration({ ...configuration, endDate: e.target.value });
                }}
                variant="bordered"
                fullWidth
              />
              <Spacer y={1} />
              <div className="flex flex-row gap-1 items-center">
                <Chip
                  variant="flat"
                  color="secondary"
                  className="cursor-pointer hover:shadow-xs hover:saturate-200 transition-all"
                  onClick={() => setConfiguration({ ...configuration, endDate: "today" })}
                >
                  today
                </Chip>
                <Chip
                  variant="flat"
                  color="secondary"
                  className="cursor-pointer hover:shadow-xs hover:saturate-200 transition-all"
                  onClick={() => setConfiguration({ ...configuration, endDate: "yesterday" })}
                >
                  yesterday
                </Chip>
                <Chip
                  variant="flat"
                  color="secondary"
                  className="cursor-pointer hover:shadow-xs hover:saturate-200 transition-all"
                  onClick={() => setConfiguration({ ...configuration, endDate: "30daysAgo" })}
                >
                  30daysAgo
                </Chip>
                <Chip
                  onClick={() => setDateHelp(!dateHelp)}
                  variant="bordered"
                  color={dateHelp ? "secondary" : "default"}
                  startContent={<LuInfo />}
                  className="cursor-pointer hover:shadow-xs hover:saturate-200 transition-all"
                >
                  info
                </Chip>
              </div>
            </div>
            {dateHelp && (
              <div className="col-span-12">
                <div
                  className={"bg-content2 rounded-md p-4 pl-5 pr-5"}
                >
                  <Row className={"gap-1"}>
                    <Text>{"You can use relative dates such as "}</Text>
                    <Code color="primary">today</Code>
                    <Text>{", "}</Text>
                    <Code color="primary">yesterday</Code>
                    <Text>{", and "}</Text>
                    <Code color="primary">NdaysAgo</Code>
                  </Row>
                  <Row>
                    <Text>{"Alternatively, you can type in any date in YYYY-MM-DD format or use the calendar picker next to each field."}</Text>
                  </Row>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 sm:col-span-5">
          <Row className="gabuilder-request-tut">
            <Button
              endContent={<LuPlay />}
              isLoading={requestLoading}
              onPress={() => _onTest()}
              className="w-full"
              color="primary"
              variant="ghost"
            >
              Get analytics data
            </Button>
          </Row>
          <Spacer y={2} />
          <Row align="center">
            <Checkbox
              isSelected={!invalidateCache}
              onChange={() => setInvalidateCache(!invalidateCache)}
              size="sm"
            >
              {"Use cache"}
            </Checkbox>
            <Spacer x={1} />
            <Tooltip
              content="Chartbrew will cache the data to make the edit process faster. The cache will be cleared when you change any of the settings."
              className="max-w-[500px]"
            >
              <div><LuInfo /></div>
            </Tooltip>
          </Row>
          <Spacer y={2} />
          <Row className="gabuilder-result-tut">
            <div className="w-full">
              <AceEditor
                mode="json"
                theme={isDark ? "one_dark" : "tomorrow"}
                height="450px"
                width="none"
                value={requestError || result || ""}
                name="resultEditor"
                readOnly
                editorProps={{ $blockScrolling: false }}
                className="rounded-md border-1 border-solid border-content3"
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

      <DataTransform
        isOpen={showTransform}
        onClose={() => setShowTransform(false)}
        onSave={_onTransformSave}
        initialTransform={gaRequest.transform}
      />
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
  onSave: PropTypes.func.isRequired,
  requests: PropTypes.array.isRequired,
  dataRequest: PropTypes.object,
  onDelete: PropTypes.func.isRequired,
  responses: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => {
  return {
    responses: state.dataRequest.responses,
  };
};

const mapDispatchToProps = () => {
  return {
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(GaBuilder);
