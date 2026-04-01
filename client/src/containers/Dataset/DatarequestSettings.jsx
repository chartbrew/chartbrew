import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Avatar, Chip, Button, Checkbox, Separator, Input, Tooltip,
  Label, ListBox, Select,
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
import { ButtonSpinner } from "../../components/ButtonSpinner";
import Text from "../../components/Text";
import { useTheme } from "../../modules/ThemeContext";
import { selectTeam } from "../../slices/team";

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
  const responseInitRef = useRef(null);
  const joinInitRef = useRef(null);

  const dataset = useSelector((state) => state.dataset.data.find((d) => `${d.id}` === `${params.datasetId}`));
  const dataRequests = useSelector((state) => selectDataRequests(state, parseInt(params.datasetId, 10))) || [];
  const responses = useSelector(selectResponses);
  const team = useSelector(selectTeam);

  useEffect(() => {
    if (dataset?.joinSettings?.joins && !initRef.current) {
      initRef.current = true;
      const newJoins = dataset.joinSettings.joins.map(join => ({...join}));
      setJoins(newJoins);

      // also change the first item of joins
      if (!newJoins?.[0]?.dr_id) {
        newJoins[0] = {
          ...newJoins[0],
          dr_id: parseInt(dataset.main_dr_id, 10)
        };
        setJoins(newJoins);
      }
    }
  }, [dataset]);

  useEffect(() => {
    if (dataset?.main_dr_id && team?.id) {
      const dr = dataRequests.find((o) => o.id === dataset.main_dr_id);
      if (dr && !responseInitRef.current) {
        responseInitRef.current = true;
        dispatch(runDataRequest({
          team_id: team?.id,
          dataset_id: dataset.id,
          dataRequest_id: dataset.main_dr_id,
          getCache: true
        }))
          .catch(() => {});
      }
    }
  }, [dataset?.main_dr_id, dataRequests, team]);

  useEffect(() => {
    if (dataset?.joinSettings?.joins && team?.id && !joinInitRef.current) {
      joinInitRef.current = true;
      dataset.joinSettings.joins.forEach(join => {
        if (join.dr_id) {
          dispatch(runDataRequest({
            team_id: team?.id,
            dataset_id: dataset.id,
            dataRequest_id: join.dr_id,
            getCache: true
          })).catch(() => {});
        }
        if (join.join_id) {
          dispatch(runDataRequest({
            team_id: team?.id,
            dataset_id: dataset.id,
            dataRequest_id: join.join_id,
            getCache: true
          })).catch(() => {});
        }
      });
    }
  }, [dataset?.joinSettings?.joins, team]);

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

  const _onAddJoin = () => {
    const newJoinSettings = {
      key: nanoid(6),
      dr_id: joins.length === 0 ? dataset.main_dr_id : joins[joins.length - 1].dr_id,
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

    // check if 
    if (data?.dr_id) {
      const dr = dataRequests.find((o) => o?.id === data.dr_id);
      if (!dr?.response || !dr.response?.data) {
        dispatch(runDataRequest({
          team_id: team?.id,
          dataset_id: dataset.id,
          dataRequest_id: data.dr_id,
          getCache: true
        }))
          .catch(() => { });
      }
    }

    if (data?.join_id) {
      const drJoin = dataRequests.find((o) => o?.id === data.join_id);
      if (!drJoin?.response || !drJoin.response?.data) {
        dispatch(runDataRequest({
          team_id: team?.id,
          dataset_id: dataset.id,
          dataRequest_id: data.join_id,
          getCache: true,
        }))
          .catch(() => { });
      }
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
          team_id: team?.id,
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
    <div className="drsettings-page-tut max-w-(--breakpoint-2xl) mx-auto px-4 py-4 bg-surface rounded-3xl border border-divider">
      <div className="grid grid-cols-12">
        <div className="col-span-12 md:col-span-7 pr-4 pb-20">
          <Row>
            <Select
              placeholder="Select main source"
              variant="secondary"
              selectionMode="single"
              value={dataset?.main_dr_id ? `${dataset.main_dr_id}` : null}
              onChange={(value) => _onChangeMainSource(value)}
              aria-label="Select a main source"
              fullWidth
            >
              <Label>Main source</Label>
              <Select.Trigger>
                <Select.Value className="flex flex-row items-center gap-2" />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {dataRequests.map((request) => (
                    <ListBox.Item
                      key={request.id}
                      id={`${request.id}`}
                      textValue={request.Connection?.name || ""}
                    >
                      {(request.Connection?.type && (
                        <Avatar className="size-6 rounded-sm shrink-0">
                          <Avatar.Image
                            src={
                              connectionImages(isDark)[
                                request.Connection.subType || request.Connection.type
                              ]
                            }
                            alt=""
                          />
                          <Avatar.Fallback />
                        </Avatar>
                      )) || null}
                      <span>{request.Connection?.name || ""}</span>
                      <span className="text-xs text-foreground-500">{dataRequests.findIndex((o) => o.id === request.id) + 1}</span>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </Row>
          <div className="h-2" />
          <div className="flex flex-col gap-2">
            {joins.map((join, index) => (
              <div className="grid grid-cols-12" key={join.key}>
                <div className="col-span-6 md:col-span-1 flex items-center">
                  <Text size="sm">Join</Text>
                </div>
                <div className="col-span-6 md:col-span-5">
                  <Select
                    placeholder="Select source"
                    variant="secondary"
                    selectionMode="single"
                    value={join.dr_id ? `${join.dr_id}` : null}
                    onChange={(value) => _onChangeJoin(join.key, { dr_id: parseInt(value, 10) })}
                    aria-label="Select a source"
                    isDisabled={index === 0}
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Chip variant="primary" size="sm">
                        {dataRequests.findIndex((o) => o.id === join.dr_id) + 1}
                      </Chip>
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {_getAllowedDataRequests(index).map((request) => (
                          <ListBox.Item
                            key={request.id}
                            id={`${request.id}`}
                            textValue={request.Connection.name}
                          >
                            <Avatar className="size-6 rounded-sm shrink-0">
                              <Avatar.Image
                                src={connectionImages(isDark)[
                                  request.Connection.subType || request.Connection.type
                                ]}
                                alt=""
                              />
                              <Avatar.Fallback />
                            </Avatar>
                            <span>{request.Connection.name}</span>
                            <span className="text-xs text-foreground-500">{dataRequests.findIndex((o) => o.id === request.id) + 1}</span>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                <div className="col-span-6 md:col-span-1 flex justify-center items-center">
                  <Text size="sm">with</Text>
                </div>
                <div className="col-span-6 md:col-span-5">
                  <Select
                    placeholder="Select source"
                    variant="secondary"
                    selectionMode="single"
                    value={join.join_id ? `${join.join_id}` : null}
                    onChange={(value) => _onChangeJoin(join.key, { join_id: parseInt(value, 10) })}
                    aria-label="Select a source"
                  >
                    <Select.Trigger>
                      <Select.Value className="flex flex-row items-center gap-2" />
                      <Chip variant="secondary" size="sm">
                        {dataRequests.findIndex((o) => o.id === join.join_id) + 1}
                      </Chip>
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {dataRequests.map((request) => (
                          <ListBox.Item
                            key={request.id}
                            id={`${request.id}`}
                            textValue={request.Connection.name}
                          >
                            <Avatar className="size-6 rounded-sm shrink-0">
                              <Avatar.Image
                                src={connectionImages(isDark)[
                                  request.Connection.subType || request.Connection.type
                                ]}
                                alt=""
                              />
                              <Avatar.Fallback />
                            </Avatar>
                            <span>{request.Connection.name}</span>
                            <span className="text-xs text-foreground-500">{dataRequests.findIndex((o) => o.id === request.id) + 1}</span>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                <div className="col-span-12">
                  <div className="h-1" />
                </div>
                <div className="col-span-6 md:col-span-1 flex items-center">
                  <Text size="sm">where</Text>
                </div>
                <div className="col-span-6 md:col-span-5" style={styles.fieldContainer}>
                  <Select
                    placeholder="Select field"
                    variant="secondary"
                    selectionMode="single"
                    value={join.dr_field || null}
                    onChange={(value) => _onChangeJoin(join.key, { dr_field: value })}
                    aria-label="Select a field"
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {_getFieldOptions(join.key, "dr_id").map((f) => (
                          <ListBox.Item key={f.field} id={f.field} textValue={_renderHumanField(f.field)}>
                            {_renderHumanField(f.field)}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                <div className="col-span-16 md:col-span-1 flex justify-center items-center">
                  <Text size="sm">=</Text>
                </div>
                <div className="col-span-6 md:col-span-5" style={styles.fieldContainer}>
                  <Select
                    placeholder="Select field"
                    variant="secondary"
                    selectionMode="single"
                    value={join.join_field || null}
                    onChange={(value) => _onChangeJoin(join.key, { join_field: value })}
                    aria-label="Select a field"
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {_getFieldOptions(join.key, "join_id").map((f) => (
                          <ListBox.Item key={f.field} id={f.field} textValue={_renderHumanField(f.field)}>
                            {_renderHumanField(f.field)}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                <div className="col-span-12">
                  <div className="h-1" />
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
                    variant="secondary"
                    size="sm"
                  />
                </div>
                <div className="col-span-12">
                  <div className="h-4" />
                  <Separator />
                  <div className="h-4" />
                </div>
              </div>
            ))}
          </div>
          <Row className="drsettings-join-tut gap-2">
            <Button
              size="sm"
              variant="ghost"
              onPress={() => _onAddJoin()}
            >
              <LuPlus />
              Join with another source
            </Button>

            {joins.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onPress={() => _onRemoveLastJoin()}
              >
                <LuX />
                Remove last join
              </Button>
            )}
          </Row>
          <>
            <div className="h-4" />
            <Separator />
            <div className="h-2" />
          </>
          <Row>
            <Button
              onPress={() => _onSaveJoins()}
              size="sm"
              isDisabled={isSaved}
              isPending={saveLoading}
              variant={isSaved ? "tertiary" : "primary"}
            >
              {saveLoading ? <ButtonSpinner /> : null}
              {!isSaved && "Save"}
              {isSaved && "Saved"}
            </Button>
            <div className="w-1" />
            {!isSaved && (
              <Button
                onPress={() => _onRevertChanges()}
                size="sm"
                variant="tertiary"
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
                onPress={() => _onRunDataset()}
                isDisabled={isCompiling}
              >
                {isCompiling ? <ButtonSpinner /> : null}
                Compile dataset data
                {!isCompiling ? <LuPlay /> : null}
              </Button>
            </Row>
            <Row align="center">
              <Checkbox
                id="datarequest-use-cache"
                isSelected={!invalidateCache}
                onChange={(selected) => setInvalidateCache(!selected)}
              >
                <Checkbox.Control className="size-4 shrink-0">
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Content>
                  <Label htmlFor="datarequest-use-cache" className="text-sm">Use cache</Label>
                </Checkbox.Content>
              </Checkbox>
              <div className="w-0.5" />
              <Tooltip>
                <Tooltip.Trigger>
                  <div><LuInfo /></div>
                </Tooltip.Trigger>
                <Tooltip.Content placement="left start" className="max-w-[500px]">
                  If checked, Chartbrew will use cached data instead of making requests to your data source. The cache gets automatically invalidated when you change the collections and/or filters.
                </Tooltip.Content>
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
                  className="Dataset-result-tut"
                />
              </div>
            </Row>
            <Row align="center">
              <LuInfo />
              <div className="w-1" />
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
