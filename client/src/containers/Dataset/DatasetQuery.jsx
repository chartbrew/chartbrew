import React, { useState, Fragment, useEffect, useRef } from "react"
import PropTypes from "prop-types";
import {
  Button,
  Avatar,
  Card,
  InputGroup,
  Separator,
  Chip,
  Tabs,
  TextField,
} from "@heroui/react";
import { LuArrowLeft, LuBrainCircuit, LuGitMerge, LuLayers, LuPlus, LuSearch, LuX } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router";
import { cloneDeep, findIndex } from "lodash";
import moment from "moment";
import toast from "react-hot-toast";

import { getTeamConnections, selectConnections } from "../../slices/connection";
import {
  updateDataset, createDataRequest, updateDataRequest, deleteDataRequest,
  selectDataRequests,
  getDataRequestsByDataset,
} from "../../slices/dataset";
import connectionImages from "../../config/connectionImages";
import ApiBuilder from "../AddChart/components/ApiBuilder";
import SqlBuilder from "../AddChart/components/SqlBuilder";
import MongoQueryBuilder from "../AddChart/components/MongoQueryBuilder";
import RealtimeDbBuilder from "../Connections/RealtimeDb/RealtimeDbBuilder";
import FirestoreBuilder from "../Connections/Firestore/FirestoreBuilder";
import GaBuilder from "../Connections/GoogleAnalytics/GaBuilder";
import CustomerioBuilder from "../Connections/Customerio/CustomerioBuilder";
import ClickHouseBuilder from "../Connections/ClickHouse/ClickHouseBuilder";
import DatarequestSettings from "./DatarequestSettings";
import Container from "../../components/Container";
import { useTheme } from "../../modules/ThemeContext";
import Text from "../../components/Text";
import { selectProjects } from "../../slices/project";
import { selectTeam } from "../../slices/team";
import canAccess from "../../config/canAccess";
import { selectUser } from "../../slices/user";

function DatasetQuery(props) {
  const { onUpdateDataset } = props;

  const [selectedRequest, setSelectedRequest] = useState({});
  const [createMode, setCreateMode] = useState(false);
  const [dataRequests, setDataRequests] = useState([]);
  const [connectionSearch, setConnectionSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState("queryBuilder");
  const connectionListInitRef = useRef(false);

  const { isDark } = useTheme();
  const theme = isDark ? "dark" : "light";
  const dispatch = useDispatch();
  const params = useParams();
  const navigate = useNavigate();
  const initRef = useRef(null);

  const stateDataRequests = useSelector((state) => selectDataRequests(state, parseInt(params.datasetId, 10))) || [];
  const connections = useSelector(selectConnections);
  const dataset = useSelector((state) => state.dataset.data.find((d) => `${d.id}` === `${params.datasetId}`));
  const projects = useSelector(selectProjects);
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);

  useEffect(() => {
    if (dataset?.id && team?.id && !initRef.current) {
      initRef.current = true;

      dispatch(getDataRequestsByDataset({
        team_id: team?.id,
        dataset_id: params.datasetId,
      }))
        .then((drs) => {
          if (drs.payload?.length > 1) {
            setDataRequests(drs.payload);
            setSelectedRequest(drs.payload[0] || {});
          } else if (drs.payload?.length === 1) {
            setDataRequests(drs.payload);
            setSelectedRequest(drs.payload[0] || {});
            setCreateMode(false);
          }

          if (drs.payload?.[0] > 0 && !dataset.main_dr_id) {
            dispatch(updateDataset({
              team_id: team?.id,
              dataset_id: dataset.id,
              data: { main_dr_id: drs.payload[0].id },
            }));
          }

          if (!drs.payload?.[0]) {
            setCreateMode(true);
          }
        })
        .catch((err) => {
          if (err && err.message === "404") {
            setCreateMode(true);
            return true;
          }

          toast.error("Could not load data requests. Please try again or get in touch with us.");
          return err;
        });
    }
  }, [dataset, team]);

  useEffect(() => {
    if (stateDataRequests.length > 0) {
      setDataRequests((prev) => {
        if (prev.length !== stateDataRequests.length || prev.some((p, i) => p?.id !== stateDataRequests[i]?.id)) {
          return stateDataRequests;
        }
        return prev;
      });
    }
  }, [stateDataRequests]);

  useEffect(() => {
    if (!createMode || !team?.id || connectionListInitRef.current) return;

    connectionListInitRef.current = true;
    dispatch(getTeamConnections({ team_id: team.id }));
  }, [createMode, dispatch, team?.id]);

  const _updateDataRequest = (newData) => {
    let newDr = newData;
    // transform the headers array
    if (newDr && newDr.formattedHeaders && newDr.formattedHeaders.length > 0) {
      const { formattedHeaders } = newDr;
      let newHeaders = {};
      for (let i = 0; i < formattedHeaders.length; i++) {
        if (formattedHeaders[i].key && formattedHeaders[i].value) {
          newHeaders = { [formattedHeaders[i].key]: formattedHeaders[i].value, ...newHeaders };
        }
      }

      newDr = { ...newDr, headers: newHeaders };
    }

    // update the item in the array
    const drIndex = findIndex(dataRequests, { id: newDr.id });
    if (drIndex > -1) {
      const newDrArray = cloneDeep(dataRequests);
      newDrArray[drIndex] = newDr;
      setDataRequests(newDrArray);
    }
  };

  const _onSaveRequest = (dr = selectedRequest) => {
    return dispatch(updateDataRequest({
      team_id: team?.id,
      dataset_id: dataset.id,
      dataRequest_id: dr.id,
      data: dr,
    }))
      .then((data) => {
        const savedDr = data.payload;
        setSelectedRequest(savedDr);

        // if it's the first data request, update the main_dr_id
        if (dataRequests.length === 1 && !dataset.main_dr_id) {
          dispatch(updateDataset({
            team_id: team?.id,
            dataset_id: dataset.id,
            data: { main_dr_id: savedDr.id }
          }));
          toast.success("Dataset updated");
        }

        // update the dataRequests array and replace the item
        _updateDataRequest(savedDr);
      })
      .catch((e) => {
        return e;
      });
  };

  const _onCreateNewRequest = (connection) => {
    return dispatch(createDataRequest({
      team_id: team?.id,
      dataset_id: dataset.id,
      data: {
        dataset_id: dataset.id,
        connection_id: connection.id,
      }
    }))
      .then((newDr) => {
        if (dataRequests.length < 1) {
          dispatch(updateDataset({
            team_id: team?.id,
            dataset_id: dataset.id,
            data: { main_dr_id: newDr.payload.id },
          }));
          toast.success("Dataset updated");
        }

        setSelectedRequest(newDr.payload);
        setCreateMode(false);

        // update the dataRequests array
        const newDrArray = cloneDeep(dataRequests);
        newDrArray.push(newDr.payload);
        setDataRequests(newDrArray);
      })
      .catch((e) => {
        toast.error("Could not create connection. Please try again or get in touch with us.");
        return e;
      });
  };

  const _onSelectDataRequest = (dr) => {
    setSelectedRequest(dr);
    setCreateMode(false);
  };

  const _onDeleteRequest = (drId) => {
    if (selectedRequest) {
      dispatch(deleteDataRequest({
        team_id: team?.id,
        dataset_id: dataset.id,
        dataRequest_id: drId
      }))
        .then(() => {
          // update the dataRequests array
          const newDrArray = cloneDeep(dataRequests);
          const newDrs = newDrArray.filter((dr) => dr.id !== drId)
          setDataRequests(newDrs);
          if (newDrs.length === 0) {
            setCreateMode(true);
          } else {
            setSelectedRequest(newDrs[0]);
          }
        })
        .catch((e) => {
          return e;
        });
    }
  };

  const _filteredConnections = () => {
    if (connectionSearch.length > 0) {
      return connections.filter((c) => c?.name?.toLowerCase().includes(connectionSearch.toLowerCase()));
    }

    return connections;
  };

  const _getConnectionTags = (projectIds) => {
    const tags = [];
    if (!projects || !projectIds) return tags;
    projectIds.forEach((projectId) => {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        tags.push(project.name);
      }
    });

    return tags;
  };

  const _getJoinSettingsJoinCount = () => dataset?.joinSettings?.joins?.length || 0;

  const _hasJoinConfiguration = () => {
    const joins = dataset?.joinSettings?.joins;
    if (!joins?.length) return false;
    return joins.some(
      (j) => j.join_id != null && String(j.dr_field || "").trim() !== "" && String(j.join_field || "").trim() !== ""
    );
  };

  const _isMainDataRequest = (dr) => {
    if (dataset?.main_dr_id == null || !dr?.id) return false;
    return `${dataset.main_dr_id}` === `${dr.id}`;
  };

  const _isDataRequestInJoin = (dr) => {
    const joins = dataset?.joinSettings?.joins;
    if (!joins?.length || dr?.id == null) return false;
    return joins.some(
      (j) =>
        (j.dr_id != null && `${j.dr_id}` === `${dr.id}`) ||
        (j.join_id != null && `${j.join_id}` === `${dr.id}`)
    );
  };

  const _renderDataRequestTabChip = (dr) => {
    if (_isMainDataRequest(dr)) {
      return (
        <Chip size="sm" variant="primary">
          main
        </Chip>
      );
    }
    if (_isDataRequestInJoin(dr)) {
      return (
        <Chip size="sm" variant="primary" color="success">
          joined
        </Chip>
      );
    }
    return (
      <Chip size="sm" variant="primary" color="warning">
        needs config
      </Chip>
    );
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  return (
    <>
      <div className="h-full py-2 overflow-y-auto flex flex-col gap-2">
        <div className="flex flex-row items-center">
          <Tabs
            variant="primary"
            selectedKey={selectedTab}
            onSelectionChange={(key) => {
              setSelectedTab(key);
              setCreateMode(false);
            }}
            className="w-full max-w-md border border-divider rounded-3xl"
          >
            <Tabs.ListContainer>
              <Tabs.List>
                <Tabs.Tab id="queryBuilder">
                  <Tabs.Indicator />
                  <div className="flex flex-row items-center gap-2">
                    <LuLayers size={16} />
                    <span>Query builder</span>
                  </div>
                </Tabs.Tab>
                <Tabs.Tab id="joinSettings">
                  <Tabs.Indicator />
                  <div className="flex flex-row items-center gap-2">
                    <LuGitMerge size={16} />
                    <span>Join settings</span>
                    {_hasJoinConfiguration() && (
                      <Chip size="sm" variant="soft" className="rounded-sm">
                        {`${_getJoinSettingsJoinCount()} join${_getJoinSettingsJoinCount() === 1 ? "" : "s"}`}
                      </Chip>
                    )}
                  </div>
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </div>
      </div>
      <div className="grid grid-cols-12">
        {!createMode && selectedTab === "joinSettings" && (
          <div className="col-span-12">
            <DatarequestSettings
              dataset={dataset}
              dataRequests={dataRequests}
              onChange={onUpdateDataset}
            />
          </div>
        )}
        {!createMode && selectedTab === "queryBuilder" && (
          <div className="col-span-12 bg-surface rounded-3xl border border-divider pb-4">
            {dataRequests && dataRequests.length > 0 && (
              <div className="bg-surface-secondary rounded-t-3xl p-4">
                <div className="flex w-full flex-row flex-wrap items-center gap-2">
                  {dataRequests.map((dr) => {
                    const isActive = !createMode && `${selectedRequest?.id}` === `${dr.id}`;
                    return (
                      <Button
                        key={dr.id}
                        size="sm"
                        variant={isActive ? "primary" : "ghost"}
                        onPress={() => _onSelectDataRequest(dr)}
                        className="shrink-0"
                      >
                        <div className="flex flex-row items-center gap-2">
                          <div className="h-6 w-6 shrink-0">
                            <img
                              src={connectionImages(theme === "dark")[dr?.Connection?.subType || dr?.Connection?.type]}
                              alt={`${dr?.Connection?.subType || dr?.Connection?.type} logo`}
                              className="h-full w-full rounded-sm border border-divider object-contain"
                            />
                          </div>
                          <span className="max-w-md truncate">{dr?.Connection?.name}</span>
                          {_renderDataRequestTabChip(dr)}
                        </div>
                      </Button>
                    );
                  })}
                  {_canAccess("teamAdmin") && (
                    <Button
                      size="sm"
                      variant={createMode ? "primary" : "outline"}
                      onPress={() => setCreateMode(true)}
                      className="shrink-0"
                    >
                      <div className="flex flex-row items-center gap-2">
                        <LuPlus size={16} />
                        <span>Add data request</span>
                      </div>
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div className="h-8" />
            {dataRequests.map((dr) => (
              <Fragment key={dr.id}>
                {selectedRequest.Connection?.type === "api" && selectedRequest.id === dr.id && (
                  <ApiBuilder
                    dataRequest={dr}
                    connection={dr.Connection}
                    onChangeRequest={_updateDataRequest}
                    onSave={_onSaveRequest}
                    onDelete={() => _onDeleteRequest(dr.id)}
                  />
                )}
                {(selectedRequest.Connection?.type === "mysql" || selectedRequest.Connection?.type === "postgres") && selectedRequest.id === dr.id && (
                  <SqlBuilder
                    dataRequest={dr}
                    connection={dr.Connection}
                    onChangeRequest={_updateDataRequest}
                    onSave={_onSaveRequest}
                    onDelete={() => _onDeleteRequest(dr.id)}
                  />
                )}
                {selectedRequest.Connection?.type === "mongodb" && selectedRequest.id === dr.id && (
                  <MongoQueryBuilder
                    dataRequest={dr}
                    connection={dr.Connection}
                    onChangeRequest={_updateDataRequest}
                    onSave={_onSaveRequest}
                    onDelete={() => _onDeleteRequest(dr.id)}
                  />
                )}
                {selectedRequest.Connection?.type === "realtimedb" && selectedRequest.id === dr.id && (
                  <RealtimeDbBuilder
                    dataRequest={dr}
                    connection={dr.Connection}
                    onChangeRequest={_updateDataRequest}
                    onSave={_onSaveRequest}
                    onDelete={() => _onDeleteRequest(dr.id)}
                  />
                )}
                {selectedRequest.Connection?.type === "firestore" && selectedRequest.id === dr.id && (
                  <FirestoreBuilder
                    dataRequest={dr}
                    connection={dr.Connection}
                    onChangeRequest={_updateDataRequest}
                    onSave={_onSaveRequest}
                    onDelete={() => _onDeleteRequest(dr.id)}
                  />
                )}
                {selectedRequest.Connection?.type === "googleAnalytics" && selectedRequest.id === dr.id && (
                  <GaBuilder
                    dataRequest={dr}
                    connection={dr.Connection}
                    onChangeRequest={_updateDataRequest}
                    onSave={_onSaveRequest}
                    onDelete={() => _onDeleteRequest(dr.id)}
                  />
                )}
                {selectedRequest.Connection?.type === "customerio" && selectedRequest.id === dr.id && (
                  <CustomerioBuilder
                    dataRequest={dr}
                    connection={dr.Connection}
                    onChangeRequest={_updateDataRequest}
                    onSave={_onSaveRequest}
                    onDelete={() => _onDeleteRequest(dr.id)}
                  />
                )}
                {selectedRequest.Connection?.type === "clickhouse" && selectedRequest.id === dr.id && (
                  <ClickHouseBuilder
                    dataRequest={dr}
                    connection={dr.Connection}
                    onChangeRequest={_updateDataRequest}
                    onSave={_onSaveRequest}
                    onDelete={() => _onDeleteRequest(dr.id)}
                  />
                )}

                {!selectedRequest.Connection && selectedRequest.id === dr.id && (
                  <div className="p-4">
                    <p className="font-semibold">This data request does not have a connection.</p>
                    <p className="text-sm text-default-500">{"You can safely delete this and create a new data request by clicking the '+' button."}</p>
                    <div className="h-4" />
                    <Button
                      onPress={() => _onDeleteRequest(selectedRequest.id)}
                      color="danger"
                      size="sm"
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        )}
        {createMode && (
          <div className="col-span-12 md:col-span-12 w-full max-w-(--breakpoint-2xl) mx-auto pb-20 bg-surface rounded-lg border border-divider p-4">
            <div className="h-2" />
            <div className="flex flex-row items-center gap-2">
              <Button variant="tertiary" isIconOnly onPress={() => setCreateMode(false)} size="sm">
                <LuArrowLeft size={16} />
              </Button>
              <div className="text-lg font-tw font-semibold">Select a connection</div>
            </div>
            <div className="h-4" />
            {connections.length > 0 && (
              <div>
                <TextField aria-label="Search connections" className="max-w-[300px]" name="connection-search">
                  <InputGroup fullWidth variant="secondary">
                    <InputGroup.Prefix className="border-0">
                      <LuSearch size={16} className="text-muted" aria-hidden />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      placeholder="Search connections"
                      onChange={(e) => setConnectionSearch(e.target.value)}
                      value={connectionSearch}
                    />
                    {connectionSearch ? (
                      <InputGroup.Suffix className="pr-2">
                        <Button
                          isIconOnly
                          aria-label="Clear search"
                          size="sm"
                          variant="ghost"
                          onPress={() => setConnectionSearch("")}
                        >
                          <LuX size={16} />
                        </Button>
                      </InputGroup.Suffix>
                    ) : null}
                  </InputGroup>
                </TextField>
              </div>
            )}
            <div className="h-4" />
            <div className="grid grid-cols-12 gap-4">
              {_filteredConnections().length === 0 && connections.length === 0 && (
                <div className="col-span-12 flex flex-col">
                  <p className="text-default-500">{"No connections found. Please create a connection first."}</p>
                  <div className="h-4" />
                  <div>
                    <Button
                      onPress={() => navigate("/connections/new")}
                      color="primary"
                    >
                      Create a connection
                    </Button>
                  </div>
                </div>
              )}

              {_filteredConnections().length === 0 && connections.length > 0 && (
                <div className="col-span-12 flex flex-col">
                  <p className="text-default-500">{"No connections found with this search query. Please try again."}</p>
                  <div className="h-4" />
                  <div>
                    <Button
                      onPress={() => setConnectionSearch("")}
                      variant="tertiary"
                    >
                      Clear search
                      <LuX />
                    </Button>
                  </div>
                </div>
              )}

              {_filteredConnections().map((c) => {
                return (
                  <div className="col-span-12 sm:col-span-6 md:sm:col-span-4" key={c.id}>
                    <Card
                      role="button"
                      tabIndex={0}
                      onClick={() => _onCreateNewRequest(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          _onCreateNewRequest(c);
                        }
                      }}
                      className="h-full w-full cursor-pointer border border-content3 shadow-none transition-colors hover:bg-content2/40"
                    >
                      <Card.Content className="p-4 pl-unit-8">
                        <div className="flex flex-row items-center justify-between">
                          <div className="flex flex-col gap-1">
                            <Text size="h4">{c.name}</Text>
                            {(c.type === "mysql" || c.type === "postgres" || c.type === "mongodb" || c.type === "clickhouse") && (
                              <Chip variant="secondary" size="sm">
                                <LuBrainCircuit />
                                {"AI-powered"}
                              </Chip>
                            )}
                          </div>
                          <Avatar className="rounded-sm">
                            <Avatar.Image src={connectionImages(theme === "dark")[c.subType || c.type]} alt={`${c.type} logo`} />
                            <Avatar.Fallback />
                          </Avatar>
                        </div>
                        <div className="h-4" />
                        <div className="flex flex-row items-center">
                          <span className="text-xs text-default-400">
                            {`Created on ${moment(c.createdAt).format("LLL")}`}
                          </span>
                        </div>
                      </Card.Content>
                      <Separator />
                      {_getConnectionTags(c.project_ids).length > 0 && (
                        <>
                          <Card.Content>
                            <div className="flex flex-row items-center gap-1 flex-wrap">
                              {_getConnectionTags(c.project_ids).map((tag) => (
                                <Chip key={tag} variant="primary" size="sm">
                                  {tag}
                                </Chip>
                              ))}
                            </div>
                          </Card.Content>
                          <Separator />
                        </>
                      )}
                      <Card.Footer>
                        <Container>
                          <div className="flex flex-row justify-center">
                            <Button
                              variant="tertiary"
                              onPress={() => _onCreateNewRequest(c)}
                              size="sm"
                              fullWidth
                            >
                              Select
                            </Button>
                          </div>
                        </Container>
                      </Card.Footer>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

DatasetQuery.propTypes = {
  onUpdateDataset: PropTypes.func.isRequired,
};

export default DatasetQuery
