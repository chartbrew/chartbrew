import React, { Fragment, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Avatar,
  Button, Checkbox, Container, Divider, Dropdown, Grid, Row, Spacer, Text, Tooltip, useTheme,
} from "@nextui-org/react";
import {
  CloseSquare, InfoCircle, Play, Plus
} from "react-iconly";
import AceEditor from "react-ace";
import { nanoid } from "nanoid";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import {
  runRequest as runRequestAction,
} from "../../../actions/dataset";
import connectionImages from "../../../config/connectionImages";
import fieldFinder from "../../../modules/fieldFinder";

function DatarequestSettings(props) {
  const {
    dataRequests, responses, runRequest, dataset, onChange, drResponses, // eslint-disable-line
  } = props;

  const [result, setResult] = useState("");
  const [invalidateCache, setInvalidateCache] = useState(false);
  const [joins, setJoins] = useState([]);

  const { isDark } = useTheme();

  useEffect(() => {
    if (responses && responses.length > 0) {
      const selectedResponse = responses.find((o) => o.id === dataset.id);
      if (selectedResponse?.data) {
        setResult(JSON.stringify(selectedResponse.data, null, 2));
      }
    }
  }, [responses]);

  const _onChangeMainSource = (drId) => {
    onChange({ main_dr_id: drId });
  };

  const _renderIcon = (drId, size = "md") => {
    const dr = dataRequests.find((o) => o.id === drId);
    if (dr?.Connection?.type) {
      return (
        <>
          <Avatar
            squared
            src={connectionImages(isDark)[dr.Connection.type]}
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

  return (
    <div style={{ flex: 1 }}>
      <Grid.Container>
        <Grid xs={12} sm={6} md={7}>
          <Container>
            <Row>
              <Text b size={22}>Configure your dataset</Text>
            </Row>
            <Spacer y={1} />
            <Row>
              <Dropdown>
                <Dropdown.Button
                  auto
                  bordered
                  css={{ justifyContent: "space-between", display: "flex" }}
                  iconRight={null}
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
                        <Avatar
                          squared
                          src={connectionImages(isDark)[request.Connection.type]}
                        />
                      )}
                    >
                      {request.Connection.name}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Row>
            <Spacer y={1} />
            <Row>
              <Divider />
            </Row>
            <Spacer y={0.5} />
            {joins.map((join, index) => (
              <Fragment key={join.key}>
                <Row align="center">
                  <Text>Join</Text>
                  <Spacer x={0.3} />
                  <Dropdown>
                    <Dropdown.Button
                      auto
                      bordered
                      css={{ justifyContent: "space-between", display: "flex" }}
                      iconRight={null}
                      size="sm"
                      disabled={index === 0}
                    >
                      {_renderIcon(join.dr_id, "sm")}
                      {dataRequests.find((dr) => dr.id === join.dr_id)?.Connection?.name || "Select source"}
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
                              src={connectionImages(isDark)[request.Connection.type]}
                            />
                          )}
                        >
                          {request.Connection.name}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>

                  <Spacer x={0.3} />
                  <Text>with</Text>
                  <Spacer x={0.3} />

                  <Dropdown>
                    <Dropdown.Button
                      auto
                      bordered
                      css={{ justifyContent: "space-between", display: "flex" }}
                      iconRight={null}
                      size="sm"
                    >
                      {_renderIcon(join.join_id, "sm")}
                      {dataRequests.find((dr) => dr.id === join.join_id)?.Connection?.name || "Select source"}
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
                              src={connectionImages(isDark)[request.Connection.type]}
                            />
                          )}
                        >
                          {request.Connection.name}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </Row>
                <Spacer y={0.5} />
                <Row>
                  <Text>where</Text>
                  <Spacer x={0.3} />
                  <Dropdown>
                    <Dropdown.Button
                      auto
                      bordered
                      css={{ justifyContent: "space-between", display: "flex" }}
                      iconRight={null}
                      size="sm"
                      color="secondary"
                    >
                      {join.dr_field || "Select field"}
                    </Dropdown.Button>
                    <Dropdown.Menu
                      onAction={(key) => _onChangeJoin(join.key, { dr_field: key })}
                      selectedKeys={[join.dr_field]}
                      selectionMode="single"
                      css={{ minWidth: "max-content" }}
                    >
                      {_getFieldOptions(join.key, "dr_id").map((f) => (
                        <Dropdown.Item key={f.field}>{f.field}</Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>

                  <Spacer x={0.3} />
                  <Text>is equal to</Text>
                  <Spacer x={0.3} />

                  <Dropdown>
                    <Dropdown.Button
                      auto
                      bordered
                      css={{ justifyContent: "space-between", display: "flex" }}
                      iconRight={null}
                      size="sm"
                      color="secondary"
                    >
                      {join.join_field || "Select field"}
                    </Dropdown.Button>
                    <Dropdown.Menu
                      onAction={(key) => _onChangeJoin(join.key, { join_field: key })}
                      selectedKeys={[join.join_field]}
                      selectionMode="single"
                      css={{ minWidth: "max-content" }}
                    >
                      {_getFieldOptions(join.key, "join_id").map((f) => (
                        <Dropdown.Item key={f.field}>{f.field}</Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </Row>
                <Spacer y={1} />
              </Fragment>
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
            {joins.length > 0 && (
              <>
                <Spacer y={1} />
                <Divider />
              </>
            )}
            <Spacer y={1} />
            <Row>
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
          </Container>
        </Grid>
        <Grid xs={12} sm={6} md={5}>
          <Container>
            <Row>
              <Button
                css={{ width: "100%" }}
                color="primary"
                shadow
                onClick={() => {}}
                iconRight={<Play />}
              >
                Compile dataset data
              </Button>
            </Row>
            <Spacer y={0.5} />
            <Row align="center">
              <Checkbox
                label="Use cache"
                checked={!invalidateCache}
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
        </Grid>
      </Grid.Container>
    </div>
  );
}

DatarequestSettings.propTypes = {
  dataRequests: PropTypes.arrayOf(PropTypes.object).isRequired,
  responses: PropTypes.arrayOf(PropTypes.object).isRequired,
  runRequest: PropTypes.func.isRequired,
  dataset: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  drResponses: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => ({
  dataRequests: state.dataRequest.data,
  responses: state.dataset.responses,
  drResponses: state.dataRequest.responses,
});

const mapDispatchToProps = (dispatch) => ({
  runRequest: (projectId, chartId, datasetId, getCache) => {
    return dispatch(runRequestAction(projectId, chartId, datasetId, getCache));
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(DatarequestSettings);
