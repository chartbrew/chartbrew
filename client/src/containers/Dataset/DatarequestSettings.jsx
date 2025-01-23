import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Avatar, Chip, Button, Checkbox, Divider, Input, Spacer, Tooltip,
  Select, SelectItem,
} from "@heroui/react";
import AceEditor from "react-ace";
import { nanoid } from "nanoid";
import _ from "lodash";
import { LuInfo, LuPlay, LuPlus, LuX } from "react-icons/lu";
import { useParams } from "react-router";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import {
  runRequest, runDataRequest, selectResponses, selectDataRequests,
} from "../../slices/dataset";
import connectionImages from "../../config/connectionImages";
import fieldFinder from "../../modules/fieldFinder";
import Row from "../../components/Row";
import Text from "../../components/Text";
import { useTheme } from "../../modules/ThemeContext";

function DatarequestSettings(props) {
  const {
    onChange,
  } = props;

  const [result, setResult] = useState("");
  const [invalidateCache, setInvalidateCache] = useState(false);
  const [joins, setJoins] = useState([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);

  const { isDark } = useTheme();
  const params = useParams();
  const dispatch = useDispatch();
  const initRef = useRef(null);

  const dataset = useSelector((state) => state.dataset.data.find((d) => `${d.id}` === `${params.datasetId}`));
  const dataRequests = useSelector((state) => selectDataRequests(state, parseInt(params.datasetId, 10))) || [];
  const responses = useSelector(selectResponses);

  useEffect(() => {
    if (dataset?.joinSettings?.joins && !initRef.current) {
      initRef.current = true;
      setJoins([...dataset.joinSettings.joins]);
    }
  }, [dataset]);

  useEffect(() => {
    if (_.isEqual(dataset?.joinSettings?.joins, joins)) {
      setIsSaved(true);
    } else if (!dataset?.joinSettings?.joins && joins.length === 0) {
      setIsSaved(true);
    } else {
      setIsSaved(false);
    }
  }, [dataset, joins]);

  useEffect(() => {
    if (joins && joins.length > 0) {
      joins.forEach((data) => {
        if (data.dr_id || data.join_id) {
          // check to see if there is a response for the data request
          const dr = dataRequests.find((o) => o?.id === data.dr_id);
          if (!dr?.response || !dr.response?.data) {
            dispatch(runDataRequest({
              team_id: params.teamId,
              dataset_id: dataset.id,
              dataRequest_id: data.dr_id,
              getCache: true
            }))
              .catch(() => {});
          }

          const drJoin = dataRequests.find((o) => o?.id === data.join_id);
          if (!drJoin?.response || !drJoin.response?.data) {
            dispatch(runDataRequest({
              team_id: params.teamId,
              dataset_id: dataset.id,
              dataRequest_id: data.join_id,
              getCache: true,
            }))
              .catch(() => {});
          }
        }
      });
    }
  }, [joins]);

  useEffect(() => {
    if (responses && responses.length > 0 && dataset && dataset.id) {
      const selectedResponse = responses.find((o) => o.dataset_id === dataset.id);
      if (selectedResponse?.data) {
        setResult(JSON.stringify(selectedResponse.data, null, 2));
      }
    }
  }, [responses]);

  const _onChangeMainSource = (drId) => {
    onChange({ main_dr_id: drId });

    // also change the first item of joins
    const newJoins = [...joins];
    if (newJoins.length > 0) {
      newJoins[0].dr_id = parseInt(drId, 10);
      setJoins(newJoins);
    }
  };

  const _renderIcon = (drId, size = "md") => {
    const dr = dataRequests.find((o) => o.id === drId);
    if (dr?.Connection?.type) {
      return (
        <>
          <Avatar
            radius="sm"
            src={connectionImages(isDark)[
              dr.Connection.subType || dr.Connection.type
            ]}
            size={size}
          />
          <Spacer x={0.6} />
        </>
      );
    }

    return null;
  };

  const _onAddJoin = () => {
    const newJoinSettings = {
      key: nanoid(6),
      dr_id: joins.length === 0 ? dataset.main_dr_id : null,
      join_id: null,
      dr_field: "",
      join_field: "",
      alias: `join${joins.length}`,
    };

    setJoins([...joins, newJoinSettings]);
  };

  const _onChangeJoin = (key, data) => {
    const newJoins = [...joins];

    const index = newJoins.findIndex((o) => o.key === key);
    if (index > -1) {
      newJoins[index] = { ...newJoins[index], ...data };
    } else {
      newJoins.push({ ...data, key });
    }

    setJoins(newJoins);
  };

  const _onRemoveLastJoin = () => {
    const newJoins = [...joins];
    newJoins.pop();
    setJoins(newJoins);
  };

  const _onSaveJoins = () => {
    setSaveLoading(true);
    return onChange({ joinSettings: { joins } })
      .then(() => {
        setSaveLoading(false);
      })
      .catch(() => {
        setSaveLoading(false);
      });
  };

  const _getFieldOptions = (key, type) => {
    const join = joins.find((o) => o.key === key);
    let fields = [];

    if (join && dataRequests?.length > 0) {
      const drId = join[type];
      const response = dataRequests.find((o) => o?.id === drId)?.response;
      if (response) {
        fields = fieldFinder(response?.data || response);
      }
    }

    return fields;
  };

  const _getAllowedDataRequests = (index) => {
    if (index === 0) {
      return [];
    }

    // get the joins before the current index
    const previousJoins = joins.slice(0, index);
    return dataRequests
      .filter((o) => previousJoins.find((oj) => (oj.dr_id === o.id) || (oj.join_id === o.id)));
  };

  const _renderHumanField = (field) => {
    return field.replace("root.", "").replace("root[].", "");
  };

  const _onRevertChanges = () => {
    setJoins(dataset?.joinSettings?.joins || []);
  };

  const _onRunDataset = () => {
    const useCache = !invalidateCache;
    setIsCompiling(true);
    _onSaveJoins()
      .then(() => {
        return dispatch(runRequest({
          team_id: params.teamId,
          dataset_id: dataset.id,
          getCache: useCache
        }));
      })
      .then(() => {
        setIsCompiling(false);
      })
      .catch(() => {
        setIsCompiling(false);
      });
  };

  return (
    <div style={{ flex: 1 }} className="drsettings-page-tut">
      <div className="grid grid-cols-12">
        <div className="col-span-12 md:col-span-7 pl-4 pr-4 pb-20">
          <Row>
            <Select
              variant="bordered"
              placeholder="Select main source"
              label="Main source"
              renderValue={() => (
                <div className="flex flex-row items-center gap-2">
                  <Text>{dataRequests.find((dr) => dr.id === dataset?.main_dr_id)?.Connection?.name || "Select main source"}</Text>
                </div>
              )}
              startContent={dataset?.main_dr_id ? _renderIcon(dataset.main_dr_id, "sm") : null}
              selectedKeys={[`${dataset?.main_dr_id}`]}
              onSelectionChange={(keys) => _onChangeMainSource(keys.currentKey)}
              selectionMode="single"
              aria-label="Select a main source"
            >
              {dataRequests.map((request) => (
                <SelectItem
                  key={request.id}
                  startContent={(
                    (request.Connection?.type && (
                      <Avatar
                        radius="sm"
                        src={
                          connectionImages(isDark)[
                            request.Connection.subType || request.Connection.type
                          ]
                        }
                      />
                    )) || null
                  )}
                  endContent={`${dataRequests.findIndex((o) => o.id === request.id) + 1}`}
                  textValue={request.Connection?.name || ""}
                >
                  {request.Connection?.name || ""}
                </SelectItem>
              ))}
            </Select>
          </Row>
          <Spacer y={2} />
          <div className="flex flex-col gap-2">
            {joins.map((join, index) => (
              <div className="grid grid-cols-12" key={join.key}>
                <div className="col-span-6 md:col-span-1 flex items-center">
                  <Text size="sm">Join</Text>
                </div>
                <div className="col-span-6 md:col-span-5">
                  <Select
                    size="sm"
                    variant="bordered"
                    placeholder="Select source"
                    renderValue={() => (
                      <div className="flex items-center gap-2">
                        {_renderIcon(join.dr_id, "sm")}
                        {dataRequests.find((dr) => dr.id === join.dr_id)?.Connection?.name || "Select source"}
                        {join.dr_id && (
                          <Chip variant={"faded"} size="sm" color="primary">
                            {dataRequests.findIndex((o) => o.id === join.dr_id) + 1}
                          </Chip>
                        )}
                      </div>
                    )}
                    selectedKeys={[`${join.dr_id}`]}
                    onSelectionChange={(keys) => _onChangeJoin(join.key, { dr_id: parseInt(keys.currentKey, 10) })}
                    selectionMode="single"
                    color="primary"
                    isDisabled
                    aria-label="Select a source"
                  >
                    {_getAllowedDataRequests(index).map((request) => (
                      <SelectItem
                        key={request.id}
                        startContent={(
                          <Avatar
                            radius="sm"
                            src={connectionImages(isDark)[
                              request.Connection.subType || request.Connection.type
                            ]}
                          />
                        )}
                        endContent={`${dataRequests.findIndex((o) => o.id === request.id) + 1}`}
                        textValue={request.Connection.name}
                      >
                        {request.Connection.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="col-span-6 md:col-span-1 flex justify-center items-center">
                  <Text size="sm">with</Text>
                </div>
                <div className="col-span-6 md:col-span-5">
                  <Select
                    size="sm"
                    variant="bordered"
                    placeholder="Select source"
                    renderValue={() => (
                      <div className="flex items-center gap-2">
                        { _renderIcon(join.join_id, "sm")}
                        {dataRequests.find((dr) => dr.id === join.join_id)?.Connection?.name || "Select source"}
                        {join.join_id && (
                          <Chip variant={"faded"} size="sm" color="secondary">
                            {dataRequests.findIndex((o) => o.id === join.join_id) + 1}
                          </Chip>
                        )}
                      </div>
                    )}
                    selectedKeys={[`${join.join_id}`]}
                    onSelectionChange={(keys) => _onChangeJoin(join.key, { join_id: parseInt(keys.currentKey, 10) })}
                    selectionMode="single"
                    color="secondary"
                    aria-label="Select a source"
                  >
                    {dataRequests.map((request) => (
                      <SelectItem
                        key={request.id}
                        startContent={(
                          <Avatar
                            radius="sm"
                            src={connectionImages(isDark)[
                              request.Connection.subType || request.Connection.type
                            ]}
                          />
                        )}
                        endContent={`${dataRequests.findIndex((o) => o.id === request.id) + 1}`}
                        textValue={request.Connection.name}
                      >
                        {request.Connection.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="col-span-12">
                  <Spacer y={1} />
                </div>
                <div className="col-span-6 md:col-span-1 flex items-center">
                  <Text size="sm">where</Text>
                </div>
                <div className="col-span-6 md:col-span-5" style={styles.fieldContainer}>
                  <Select
                    size="sm"
                    variant="bordered"
                    placeholder="Select field"
                    renderValue={() => (
                      <Text size="sm">{_renderHumanField(join.dr_field) || "Select field"}</Text>
                    )}
                    selectedKeys={[join.dr_field]}
                    onSelectionChange={(keys) => _onChangeJoin(join.key, { dr_field: keys.currentKey })}
                    selectionMode="single"
                    color="primary"
                    aria-label="Select a field"
                  >
                    {_getFieldOptions(join.key, "dr_id").map((f) => (
                      <SelectItem key={f.field} textValue={_renderHumanField(f.field)}>
                        {_renderHumanField(f.field)}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="col-span-16 md:col-span-1 flex justify-center items-center">
                  <Text size="sm">=</Text>
                </div>
                <div className="col-span-6 md:col-span-5" style={styles.fieldContainer}>
                  <Select
                    size="sm"
                    variant="bordered"
                    placeholder="Select field"
                    renderValue={() => (
                      <Text size="sm">{_renderHumanField(join.join_field) || "Select field"}</Text>
                    )}
                    selectedKeys={[join.join_field]}
                    onSelectionChange={(keys) => _onChangeJoin(join.key, { join_field: keys.currentKey })}
                    selectionMode="single"
                    color="secondary"
                    aria-label="Select a field"
                  >
                    {_getFieldOptions(join.key, "join_id").map((f) => (
                      <SelectItem key={f.field} textValue={_renderHumanField(f.field)}>
                        {_renderHumanField(f.field)}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="col-span-12">
                  <Spacer y={1} />
                </div>
                <div className="col-span-12 md:col-span-1 flex items-center">
                  <Text size="sm">Alias</Text>
                </div>
                <div className="col-span-12 md:col-span-5">
                  <Input
                    fullWidth
                    placeholder="Enter a unique join alias"
                    value={join.alias}
                    onChange={(e) => _onChangeJoin(join.key, { alias: e.target.value })}
                    variant="bordered"
                    size="sm"
                  />
                </div>
                <div className="col-span-12">
                  <Spacer y={4} />
                  <Divider />
                  <Spacer y={4} />
                </div>
              </div>
            ))}
          </div>
          <Row className="drsettings-join-tut gap-2">
            <Button
              size="sm"
              variant="light"
              color="primary"
              startContent={<LuPlus />}
              onClick={() => _onAddJoin()}
            >
              Join with another source
            </Button>

            {joins.length > 0 && (
              <Button
                size="sm"
                variant="light"
                color="danger"
                startContent={<LuX />}
                onClick={() => _onRemoveLastJoin()}
              >
                Remove last join
              </Button>
            )}
          </Row>
          <>
            <Spacer y={4} />
            <Divider />
            <Spacer y={2} />
          </>
          <Row>
            <Button
              auto
              onClick={() => _onSaveJoins()}
              size="sm"
              disabled={isSaved}
              isLoading={saveLoading}
              variant={isSaved ? "flat" : "solid"}
              color={isSaved ? "success" : "primary"}
            >
              {!isSaved && "Save"}
              {isSaved && "Saved"}
            </Button>
            <Spacer x={1} />
            {!isSaved && (
              <Button
                auto
                color="warning"
                onClick={() => _onRevertChanges()}
                size="sm"
                variant="flat"
              >
                Revert changes
              </Button>
            )}
          </Row>
        </div>
        <div className="col-span-12 md:col-span-5">
          <div className="drsettings-compile-tut flex flex-col gap-2">
            <Row>
              <Button
                fullWidth
                color="secondary"
                onClick={() => _onRunDataset()}
                endContent={<LuPlay />}
                isLoading={isCompiling}
              >
                Compile dataset data
              </Button>
            </Row>
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
                content="If checked, Chartbrew will use cached data instead of making requests to your data source. The cache gets automatically invalidated when you change the collections and/or filters."
                placement="leftStart"
                className="max-w-[500px]"
              >
                <div><LuInfo /></div>
              </Tooltip>
            </Row>
            <Row>
              <div className="w-full min-h-[450px]">
                <AceEditor
                  mode="json"
                  theme={isDark ? "one_dark" : "tomorrow"}
                  style={{ borderRadius: 10, minHeight: 450 }}
                  width="none"
                  value={result || ""}
                  name="resultEditor"
                  readOnly
                  editorProps={{ $blockScrolling: false }}
                  className="Customerio-result-tut"
                />
              </div>
            </Row>
            <Row align="center">
              <LuInfo />
              <Spacer x={1} />
              <Text size="sm">
                {"To keep the interface fast, not all the data might show up here."}
              </Text>
            </Row>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  fieldContainer: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};

DatarequestSettings.propTypes = {
  onChange: PropTypes.func.isRequired,
};

export default DatarequestSettings;
