import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Avatar, Chip, Button, Checkbox, Divider, Input, Spacer, Tooltip,
  Select, SelectItem,
} from "@nextui-org/react";
import {
  CloseSquare, InfoCircle, Play, Plus
} from "react-iconly";
import AceEditor from "react-ace";
import { nanoid } from "nanoid";
import _ from "lodash";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import {
  runRequest as runRequestAction,
} from "../../../actions/dataset";
import {
  runDataRequest as runDataRequestAction,
} from "../../../actions/dataRequest";
import connectionImages from "../../../config/connectionImages";
import fieldFinder from "../../../modules/fieldFinder";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";
import Container from "../../../components/Container";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import useThemeDetector from "../../../modules/useThemeDetector";

function DatarequestSettings(props) {
  const {
    dataRequests, responses, runRequest, dataset, onChange, drResponses,
    runDataRequest, match, changeTutorial,
  } = props;

  const [result, setResult] = useState("");
  const [invalidateCache, setInvalidateCache] = useState(false);
  const [joins, setJoins] = useState([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);

  const isDark = useThemeDetector();

  useEffect(() => {
    setTimeout(() => {
      changeTutorial("drsettings");
    }, 1000);
  }, []);

  useEffect(() => {
    if (dataset?.joinSettings?.joins) {
      setJoins(dataset.joinSettings.joins);
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
          const response = drResponses.find((o) => o.id === data.dr_id);
          if (!response || !response.data) {
            runDataRequest(match.params.projectId, match.params.chartId, data.dr_id, true)
              .catch(() => {});
          }

          const responseJoin = drResponses.find((o) => o.id === data.join_id);
          if (!responseJoin || !responseJoin.data) {
            runDataRequest(match.params.projectId, match.params.chartId, data.join_id, true)
              .catch(() => {});
          }
        }
      });
    }
  }, [joins]);

  useEffect(() => {
    if (responses && responses.length > 0) {
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

    if (join) {
      const drId = join[type];
      const response = drResponses.find((o) => o.id === drId);
      if (response?.data) {
        fields = fieldFinder(response?.data);
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
        return runRequest(match.params.projectId, match.params.chartId, dataset.id, useCache);
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
        <div className="col-span-7 sm:col-span-12 pb-20">
          <Container>
            <Row>
              <Select
                variant="bordered"
                placeholder="Select main source"
                label="Main source"
                renderValue={(
                  <div className="flex items-center gap-2">
                    { _renderIcon(dataset.main_dr_id)}
                    {dataRequests.find((dr) => dr.id === dataset.main_dr_id)?.Connection?.name || "Select main source"}  
                  </div>
                )}
                selectedKeys={[dataset.main_dr_id]}
                onSelectionChange={(key) => _onChangeMainSource(key)}
                selectionMode="single"
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
                  >
                    {request.Connection?.name || ""}
                  </SelectItem>
                ))}
              </Select>
            </Row>
            <Spacer y={2} />
            {joins.map((join, index) => (
              <div className="grid grid-cols-12" key={join.key}>
                <div className="col-span-1 sm:col-span-6 flex items-center">
                  <Text>Join</Text>
                </div>
                <div className="col-span-5 sm:col-span-6">
                  <Select
                    variant="bordered"
                    placeholder="Select source"
                    renderValue={(
                      <div className="flex items-center gap-2">
                        {_renderIcon(join.dr_id, "sm")}
                        {dataRequests.find((dr) => dr.id === join.dr_id)?.Connection?.name || "Select source"}
                        {join.dr_id && (
                          <Chip variant={"bordered"} size="xs" color="primary">
                            {dataRequests.findIndex((o) => o.id === join.dr_id) + 1}
                          </Chip>
                        )}
                      </div>
                    )}
                    selectedKeys={[join.dr_id]}
                    onSelectionChange={(key) => _onChangeJoin(join.key, { dr_id: parseInt(key, 10) })}
                    selectionMode="single"
                    color="primary"
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
                      >
                        {request.Connection.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="col-span-1 sm:col-span-6 flex justify-center items-center">
                  <Text>with</Text>
                </div>
                <div className="col-span-5 sm:col-span-6">
                  <Select
                    variant="bordered"
                    placeholder="Select source"
                    renderValue={(
                      <div className="flex items-center gap-2">
                        { _renderIcon(join.join_id, "sm")}
                        {dataRequests.find((dr) => dr.id === join.join_id)?.Connection?.name || "Select source"}
                        {join.join_id && (
                          <Chip variant={"bordered"} size="xs" color="secondary">
                            {dataRequests.findIndex((o) => o.id === join.join_id) + 1}
                          </Chip>
                        )}
                      </div>
                    )}
                    selectedKeys={[join.join_id]}
                    onSelectionChange={(key) => _onChangeJoin(join.key, { join_id: parseInt(key, 10) })}
                    selectionMode="single"
                    color="secondary"
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
                      >
                        {request.Connection.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="col-span-12">
                  <Spacer y={1} />
                </div>
                <div className="col-span-1 sm:col-span-6 flex items-center">
                  <Text>where</Text>
                </div>
                <div className="col-span-5 sm:col-span-6" style={styles.fieldContainer}>
                  <Select
                    variant="bordered"
                    placeholder="Select field"
                    renderValue={(
                      <Chip variant={"bordered"} radius="sm" color="primary">
                        <div style={styles.fieldContainer}>
                          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                            {_renderIcon(join.dr_id, "xs")}
                            <Text size={"sm"}>{dataRequests.find((dr) => dr.id === join.dr_id)?.Connection?.name || "Select source"}</Text>
                            <Spacer x={0.5} />
                            <Text size={"sm"} b color="primary">
                              {dataRequests.findIndex((o) => o.id === join.dr_id) + 1}
                            </Text>
                          </div>
                          <Spacer y={0.5} />
                          <div
                            style={styles.fieldContainer}
                          >
                            <Text b>{_renderHumanField(join.dr_field) || "Select field"}</Text>
                          </div>
                        </div>
                      </Chip>
                    )}
                    selectedKeys={[join.dr_field]}
                    onSelectionChange={(key) => _onChangeJoin(join.key, { dr_field: key })}
                    selectionMode="single"
                    color="primary"
                  >
                    {_getFieldOptions(join.key, "dr_id").map((f) => (
                      <SelectItem key={f.field}>{_renderHumanField(f.field)}</SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="col-span-1 sm:col-span-6 flex justify-center items-center">
                  <Text>=</Text>
                </div>
                <div className="col-span-5 sm:col-span-6" style={styles.fieldContainer}>
                  <Select
                    variant="bordered"
                    placeholder="Select field"
                    renderValue={(
                      <Chip variant={"bordered"} radius="sm" color="secondary">
                        <div style={styles.fieldContainer}>
                          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                            {_renderIcon(join.join_id, "xs")}
                            <Text size={"sm"}>{dataRequests.find((dr) => dr.id === join.join_id)?.Connection?.name || "Select source"}</Text>
                            <Spacer x={0.5} />
                            <Text size={"sm"} b color="secondary">
                              {dataRequests.findIndex((o) => o.id === join.join_id) + 1}
                            </Text>
                          </div>
                          <Spacer y={0.5} />
                          <div style={styles.fieldContainer}>
                            <Text b>{_renderHumanField(join.join_field) || "Select field"}</Text>
                          </div>
                        </div>
                      </Chip>
                    )}
                    selectedKeys={[join.join_field]}
                    onSelectionChange={(key) => _onChangeJoin(join.key, { join_field: key })}
                    selectionMode="single"
                    color="secondary"
                  >
                    {_getFieldOptions(join.key, "join_id").map((f) => (
                      <SelectItem key={f.field}>{_renderHumanField(f.field)}</SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="col-span-12">
                  <Spacer y={1} />
                </div>
                <div className="col-span-1 sm:col-span-12 flex items-center">
                  Alias
                </div>
                <div className="col-span-5 sm:col-span-12">
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
                  <Spacer y={2} />
                  <Divider />
                  <Spacer y={2} />
                </div>
              </div>
            ))}
            {joins.length > 0 && (
              <Row>
                <Button
                  auto
                  variant="light"
                  color="danger"
                  startContent={<CloseSquare />}
                  onClick={() => _onRemoveLastJoin()}
                >
                  Remove last join
                </Button>
              </Row>
            )}
            <Row className="drsettings-join-tut">
              <Button
                auto
                variant="light"
                color="primary"
                startContent={<Plus />}
                onClick={() => _onAddJoin()}
              >
                Join with another source
              </Button>
            </Row>
            <>
              <Spacer y={2} />
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
                color={isSaved ? "success" : "primary"}
              >
                {!isSaved && "Save"}
                {isSaved && "Saved"}
              </Button>
              <Spacer x={0.6} />
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
          </Container>
        </div>
        <div className="col-span-5 sm:col-span-12">
          <div className="drsettings-compile-tut" style={{ display: "flex", flex: 1 }}>
            <Container>
              <Row>
                <Button
                  css={{ width: "100%" }}
                  color="primary"
                  onClick={() => _onRunDataset()}
                  endContent={<Play />}
                  isLoading={isCompiling}
                >
                  Compile dataset data
                </Button>
              </Row>
              <Spacer y={1} />
              <Row align="center">
                <Checkbox
                  label="Use cache"
                  isSelected={!invalidateCache}
                  onChange={() => setInvalidateCache(!invalidateCache)}
                  size="sm"
                />
                <Spacer x={0.5} />
                <Tooltip
                  content="If checked, Chartbrew will use cached data instead of making requests to your data source. The cache gets automatically invalidated when you change the collections and/or filters."
                  placement="leftStart"
                  className="max-w-[500px]"
                >
                  <InfoCircle size="small" />
                </Tooltip>
              </Row>
              <Spacer y={1} />
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
                    className="Customerio-result-tut"
                  />
                </div>
              </Row>
              <Spacer y={1} />
              <Row align="center">
                <InfoCircle size="small" />
                <Spacer x={0.5} />
                <Text small>
                  {"To keep the interface fast, not all the data might show up here."}
                </Text>
              </Row>

            </Container>
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
  dataRequests: PropTypes.arrayOf(PropTypes.object).isRequired,
  responses: PropTypes.arrayOf(PropTypes.object).isRequired,
  runRequest: PropTypes.func.isRequired,
  dataset: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  drResponses: PropTypes.array.isRequired,
  runDataRequest: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  changeTutorial: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => ({
  responses: state.dataset.responses,
  drResponses: state.dataRequest.responses,
});

const mapDispatchToProps = (dispatch) => ({
  runRequest: (projectId, chartId, datasetId, getCache) => {
    return dispatch(runRequestAction(projectId, chartId, datasetId, getCache));
  },
  runDataRequest: (projectId, chartId, drId, getCache) => {
    return dispatch(runDataRequestAction(projectId, chartId, drId, getCache));
  },
  changeTutorial: (tutorial) => dispatch(changeTutorialAction(tutorial)),
});

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(DatarequestSettings));
