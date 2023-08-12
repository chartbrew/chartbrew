import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Avatar,
  Badge,
  Button, Checkbox, Container, Divider, Dropdown, Grid, Input, Loading, Row, Spacer,
  Text, Tooltip, useTheme,
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

function DatarequestSettings(props) {
  const {
    dataRequests, responses, runRequest, dataset, onChange, drResponses, // eslint-disable-line
    runDataRequest, match, changeTutorial,
  } = props;

  const [result, setResult] = useState("");
  const [invalidateCache, setInvalidateCache] = useState(false);
  const [joins, setJoins] = useState([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);

  const { isDark } = useTheme();

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
            squared
            src={connectionImages(isDark)[
              dr.Connection.subType || dr.Connection.type
            ]}
            size={size}
          />
          <Spacer x={0.3} />
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
      <Grid.Container>
        <Grid xs={12} sm={7} md={7} css={{ pb: 20 }}>
          <Container>
            <Row>
              <Text b>Main source</Text>
            </Row>
            <Row>
              <Dropdown isBordered>
                <Dropdown.Button
                  auto
                  bordered
                  css={{ justifyContent: "space-between", display: "flex" }}
                  iconRight={null}
                  className="drsettings-source-tut"
                >
                  {_renderIcon(dataset.main_dr_id)}
                  {dataRequests.find((dr) => dr.id === dataset.main_dr_id)?.Connection?.name || "Select main source"}
                </Dropdown.Button>
                <Dropdown.Menu
                  onAction={(key) => _onChangeMainSource(key)}
                  selectedKeys={[dataset.main_dr_id]}
                  selectionMode="single"
                >
                  {dataRequests.map((request) => (
                    <Dropdown.Item
                      key={request.id}
                      css={{ height: "fit-content", mb: 5, p: 2 }}
                      icon={(
                        (request.Connection?.type && (
                          <Avatar
                            squared
                            src={
                              connectionImages(isDark)[
                                request.Connection.subType || request.Connection.type
                              ]
                            }
                          />
                        )) || null
                      )}
                      command={`${dataRequests.findIndex((o) => o.id === request.id) + 1}`}
                    >
                      {request.Connection?.name || ""}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Row>
            <Spacer y={1} />
            {joins.map((join, index) => (
              <Grid.Container key={join.key}>
                <Grid xs={6} sm={1} alignItems="center">
                  <Text>Join</Text>
                </Grid>
                <Grid xs={6} sm={5}>
                  <Dropdown isBordered>
                    <Dropdown.Button
                      auto
                      bordered
                      css={{ justifyContent: "space-between", display: "flex", width: "100%" }}
                      iconRight={null}
                      disabled={index === 0}
                    >
                      {_renderIcon(join.dr_id, "sm")}
                      {dataRequests.find((dr) => dr.id === join.dr_id)?.Connection?.name || "Select source"}
                      {join.dr_id && (
                        <Badge variant={"bordered"} css={{ ml: 5 }} size="xs" color="primary">
                          {dataRequests.findIndex((o) => o.id === join.dr_id) + 1}
                        </Badge>
                      )}
                    </Dropdown.Button>
                    <Dropdown.Menu
                      onAction={(key) => _onChangeJoin(join.key, { dr_id: parseInt(key, 10) })}
                      selectedKeys={[join.dr_id]}
                      selectionMode="single"
                    >
                      {_getAllowedDataRequests(index).map((request) => (
                        <Dropdown.Item
                          key={request.id}
                          css={{ height: "fit-content", mb: 5, p: 2 }}
                          icon={(
                            <Avatar
                              squared
                              src={connectionImages(isDark)[
                                request.Connection.subType || request.Connection.type
                              ]}
                            />
                          )}
                          command={`${dataRequests.findIndex((o) => o.id === request.id) + 1}`}
                        >
                          {request.Connection.name}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </Grid>
                <Grid xs={6} sm={1} justify="center" alignItems="center">
                  <Text>with</Text>
                </Grid>
                <Grid xs={6} sm={5}>
                  <Dropdown isBordered>
                    <Dropdown.Button
                      auto
                      bordered
                      css={{ justifyContent: "space-between", display: "flex", width: "100%" }}
                      iconRight={null}
                      color="secondary"
                    >
                      {_renderIcon(join.join_id, "sm")}
                      {dataRequests.find((dr) => dr.id === join.join_id)?.Connection?.name || "Select source"}
                      {join.join_id && (
                        <Badge variant={"bordered"} css={{ ml: 5 }} size="xs" color="secondary">
                          {dataRequests.findIndex((o) => o.id === join.join_id) + 1}
                        </Badge>
                      )}
                    </Dropdown.Button>
                    <Dropdown.Menu
                      onAction={(key) => _onChangeJoin(join.key, { join_id: parseInt(key, 10) })}
                      selectedKeys={[join.join_id]}
                      selectionMode="single"
                    >
                      {dataRequests.map((request) => (
                        <Dropdown.Item
                          key={request.id}
                          css={{ height: "fit-content", mb: 5, p: 2 }}
                          icon={(
                            <Avatar
                              squared
                              src={connectionImages(isDark)[
                                request.Connection.subType || request.Connection.type
                              ]}
                            />
                          )}
                          command={`${dataRequests.findIndex((o) => o.id === request.id) + 1}`}
                        >
                          {request.Connection.name}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </Grid>
                <Grid xs={12}>
                  <Spacer y={0.5} />
                </Grid>
                <Grid xs={6} sm={1} alignItems="center">
                  <Text>where</Text>
                </Grid>
                <Grid xs={6} sm={5} css={styles.fieldContainer}>
                  <Dropdown isBordered>
                    <Dropdown.Trigger>
                      <Badge variant={"bordered"} isSquared color="primary">
                        <div style={styles.fieldContainer}>
                          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                            {_renderIcon(join.dr_id, "xs")}
                            <Text size={12}>{dataRequests.find((dr) => dr.id === join.dr_id)?.Connection?.name || "Select source"}</Text>
                            <Spacer x={0.2} />
                            <Text size={12} b color="primary">
                              {dataRequests.findIndex((o) => o.id === join.dr_id) + 1}
                            </Text>
                          </div>
                          <Spacer y={0.2} />
                          <div css={styles.fieldContainer}>
                            <Text size={14} b>{_renderHumanField(join.dr_field) || "Select field"}</Text>
                          </div>
                        </div>
                      </Badge>
                    </Dropdown.Trigger>
                    <Dropdown.Menu
                      onAction={(key) => _onChangeJoin(join.key, { dr_field: key })}
                      selectedKeys={[join.dr_field]}
                      selectionMode="single"
                      css={{ minWidth: "max-content" }}
                    >
                      {_getFieldOptions(join.key, "dr_id").map((f) => (
                        <Dropdown.Item key={f.field}>{_renderHumanField(f.field)}</Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </Grid>
                <Grid xs={6} sm={1} justify="center" alignItems="center">
                  <Text>=</Text>
                </Grid>
                <Grid xs={6} sm={5} css={styles.fieldContainer}>
                  <Dropdown isBordered>
                    <Dropdown.Trigger css={{ width: "100%" }}>
                      <Badge variant={"bordered"} isSquared color="secondary">
                        <div style={styles.fieldContainer}>
                          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                            {_renderIcon(join.join_id, "xs")}
                            <Text size={12}>{dataRequests.find((dr) => dr.id === join.join_id)?.Connection?.name || "Select source"}</Text>
                            <Spacer x={0.2} />
                            <Text size={12} b color="secondary">
                              {dataRequests.findIndex((o) => o.id === join.join_id) + 1}
                            </Text>
                          </div>
                          <Spacer y={0.2} />
                          <div style={styles.fieldContainer}>
                            <Text size={14} b>{_renderHumanField(join.join_field) || "Select field"}</Text>
                          </div>
                        </div>
                      </Badge>
                    </Dropdown.Trigger>
                    <Dropdown.Menu
                      onAction={(key) => _onChangeJoin(join.key, { join_field: key })}
                      selectedKeys={[join.join_field]}
                      selectionMode="single"
                      css={{ minWidth: "max-content" }}
                    >
                      {_getFieldOptions(join.key, "join_id").map((f) => (
                        <Dropdown.Item key={f.field}>{_renderHumanField(f.field)}</Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </Grid>
                <Grid xs={12}>
                  <Spacer y={0.5} />
                </Grid>
                <Grid xs={12} sm={1} alignItems="center">
                  Alias
                </Grid>
                <Grid xs={12} sm={5}>
                  <Input
                    css={{ width: "100%" }}
                    placeholder="Enter a unique join alias"
                    value={join.alias}
                    onChange={(e) => _onChangeJoin(join.key, { alias: e.target.value })}
                    bordered
                    size="sm"
                    animated={false}
                  />
                </Grid>
                <Grid xs={12} direction="column">
                  <Spacer y={1} />
                  <Divider />
                  <Spacer y={1} />
                </Grid>
              </Grid.Container>
            ))}
            {joins.length > 0 && (
              <Row>
                <Button
                  auto
                  light
                  color="error"
                  icon={<CloseSquare />}
                  ripple={false}
                  css={{ p: 0 }}
                  onClick={() => _onRemoveLastJoin()}
                >
                  Remove last join
                </Button>
              </Row>
            )}
            <Row className="drsettings-join-tut">
              <Button
                auto
                light
                color="primary"
                icon={<Plus />}
                ripple={false}
                css={{ p: 0 }}
                onClick={() => _onAddJoin()}
              >
                Join with another source
              </Button>
            </Row>
            <>
              <Spacer y={1} />
              <Divider />
              <Spacer y={1} />
            </>
            <Row>
              <Button
                auto
                onClick={() => _onSaveJoins()}
                size="sm"
                disabled={saveLoading || isSaved}
                color={isSaved ? "success" : "primary"}
              >
                {saveLoading && <Loading type="points-opacity" />}
                {!saveLoading && !isSaved && "Save"}
                {!saveLoading && isSaved && "Saved"}
              </Button>
              <Spacer x={0.3} />
              {!isSaved && (
                <Button
                  auto
                  color="warning"
                  onClick={() => _onRevertChanges()}
                  size="sm"
                  flat
                >
                  Revert changes
                </Button>
              )}
            </Row>
          </Container>
        </Grid>
        <Grid xs={12} sm={5} md={5}>
          <div className="drsettings-compile-tut" style={{ display: "flex", flex: 1 }}>
            <Container>
              <Row>
                <Button
                  css={{ width: "100%" }}
                  color="primary"
                  onClick={() => _onRunDataset()}
                  iconRight={isCompiling ? <Loading type="spinner" /> : <Play />}
                  disabled={isCompiling}
                >
                  Compile dataset data
                </Button>
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
                  content="If checked, Chartbrew will use cached data instead of making requests to your data source. The cache gets automatically invalidated when you change the collections and/or filters."
                  css={{ zIndex: 10000, maxWidth: 500 }}
                  placement="leftStart"
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
                    className="Customerio-result-tut"
                  />
                </div>
              </Row>
              <Spacer y={0.5} />
              <Row align="center">
                <InfoCircle size="small" />
                <Spacer x={0.2} />
                <Text small>
                  {"To keep the interface fast, not all the data might show up here."}
                </Text>
              </Row>

            </Container>
          </div>
        </Grid>
      </Grid.Container>
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
