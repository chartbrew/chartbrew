import React, { useState, Fragment, useEffect, useRef } from "react"
import PropTypes from "prop-types";
import {
  Button, Spacer, Avatar, Card, CardBody,
  CardFooter, Input, Divider, Chip,
  Tabs,
  Tab,
  Image,
} from "@heroui/react";
import { LuBrainCircuit, LuGitMerge, LuPlug, LuPlus, LuSearch, LuX } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router";
import { cloneDeep, findIndex } from "lodash";
import moment from "moment";
import toast from "react-hot-toast";

import { selectConnections } from "../../slices/connection";
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

function DatasetQuery(props) {
  const { onUpdateDataset } = props;

  const [selectedRequest, setSelectedRequest] = useState({ isSettings: true });
  const [createMode, setCreateMode] = useState(false);
  const [dataRequests, setDataRequests] = useState([]);
  const [connectionSearch, setConnectionSearch] = useState("");

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
            setSelectedRequest({ isSettings: true });
          } else if (drs.payload?.length === 1) {
            setDataRequests(drs.payload);
            setSelectedRequest(drs.payload[0]);
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
          setDataRequests(newDrArray.filter((dr) => dr.id !== drId));
          setSelectedRequest(newDrArray[0]);
        })
        .catch((e) => {
          return e;
        });
    }
  };

  const _onSelectSettings = () => {
    if (dataRequests.length === 0) {
      toast.info("You need to create a data request first.");
      return;
    }
    setSelectedRequest({ isSettings: true });
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

  const _getSelectedTab = () => {
    if (selectedRequest?.isSettings) {
      return dataRequests[0]?.id ?? "add";
    }

    if (createMode) {
      return "add";
    }
    
    if (selectedRequest?.id) {
      return `${selectedRequest?.id}`;
    }

    return "add";
  };

  return (
    <>
      <div className="h-full py-2 overflow-y-auto flex flex-col gap-2">
        <div className="flex flex-row items-center justify-start gap-2">
          {dataRequests && dataRequests.length > 0 && (
            <>
              <Button
                variant={selectedRequest?.isSettings ? "flat" : "bordered"}
                color={selectedRequest?.isSettings ? "primary" : "default"}
                className="h-9 min-w-unit-16"
                onPress={() => _onSelectSettings()}
                startContent={<LuGitMerge size={16} />}
              >
                Join settings
              </Button>
              <LuPlug />
              <Tabs
                key={`sources-${_getSelectedTab()}`}
                defaultSelectedKey={_getSelectedTab()}
                variant="bordered"
              >
                {dataRequests.map((dr) => (
                  <Tab
                    key={dr.id}
                    title={(
                      <div className="flex flex-row items-center gap-2">
                        <Image
                          src={connectionImages(theme === "dark")[dr?.Connection?.subType || dr?.Connection?.type]}
                          alt={`${dr?.Connection?.subType || dr?.Connection?.type} logo`}
                          width={16}
                          height={16}
                          className="rounded-sm"
                        />
                        <span>{dr?.Connection?.name}</span>
                      </div>
                    )}
                    onPress={() => _onSelectDataRequest(dr)}
                  />
                ))}
                <Tab
                  key="add"
                  title={(
                    <div className="flex flex-row items-center gap-2">
                      <LuPlus size={16} />
                      <span>Add a new data source</span>
                    </div>
                  )}
                  onPress={() => setCreateMode(true)}
                />
              </Tabs>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-12">
        {!createMode && selectedRequest?.isSettings && (
          <div className="col-span-12">
            <DatarequestSettings
              dataset={dataset}
              dataRequests={dataRequests}
              onChange={onUpdateDataset}
            />
          </div>
        )}
        {!createMode && selectedRequest && !selectedRequest.isSettings && (
          <div className="col-span-12 bg-background rounded-lg border-1 border-divider p-4">
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
                    <Spacer y={2} />
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
          <div className="col-span-12 md:col-span-12 w-full max-w-(--breakpoint-2xl) mx-auto pb-20">
            <Spacer y={1} />
            <div className="text-lg font-tw font-semibold">Select a connection</div>
            <Spacer y={2} />
            {connections.length > 0 && (
              <div>
                <Input
                  startContent={<LuSearch />}
                  placeholder="Search connections"
                  onChange={(e) => setConnectionSearch(e.target.value)}
                  className="max-w-[300px]"
                  labelPlacement="outside"
                  variant="bordered"
                  isClearable
                  value={connectionSearch}
                  onClear={() => setConnectionSearch("")}
                />
              </div>
            )}
            <Spacer y={4} />
            <div className="grid grid-cols-12 gap-4">
              {_filteredConnections().length === 0 && connections.length === 0 && (
                <div className="col-span-12 flex flex-col">
                  <p className="text-default-500">{"No connections found. Please create a connection first."}</p>
                  <Spacer y={2} />
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
                  <Spacer y={2} />
                  <div>
                    <Button
                      onPress={() => setConnectionSearch("")}
                      color="default"
                      variant="flat"
                      endContent={<LuX />}
                    >
                      Clear search
                    </Button>
                  </div>
                </div>
              )}

              {_filteredConnections().map((c) => {
                return (
                  <div className="col-span-12 sm:col-span-6 md:sm:col-span-4" key={c.id}>
                    <Card
                      isPressable
                      isHoverable
                      onPress={() => _onCreateNewRequest(c)}
                      fullWidth
                      shadow="sm"
                      className="h-full"
                    >
                      <CardBody className="p-4 pl-unit-8">
                        <div className="flex flex-row items-center justify-between">
                          <div className="flex flex-col gap-1">
                            <Text size="h4">{c.name}</Text>
                            {(c.type === "mysql" || c.type === "postgres" || c.type === "mongodb" || c.type === "clickhouse") && (
                              <Chip color="secondary" variant="flat" size="sm" startContent={<LuBrainCircuit />}>
                                {"AI-powered"}
                              </Chip>
                            )}
                          </div>
                          <Avatar
                            radius="sm"
                            src={connectionImages(theme === "dark")[c.subType || c.type]}
                            alt={`${c.type} logo`}
                          />
                        </div>
                        <Spacer y={2} />
                        <div className="flex flex-row items-center">
                          <span className="text-xs text-default-400">
                            {`Created on ${moment(c.createdAt).format("LLL")}`}
                          </span>
                        </div>
                      </CardBody>
                      <Divider />
                      {_getConnectionTags(c.project_ids).length > 0 && (
                        <>
                          <CardBody>
                            <div className="flex flex-row items-center gap-1 flex-wrap">
                              {_getConnectionTags(c.project_ids).map((tag) => (
                                <Chip key={tag} color="primary" variant="flat" size="sm">
                                  {tag}
                                </Chip>
                              ))}
                            </div>
                          </CardBody>
                          <Divider />
                        </>
                      )}
                      <CardFooter>
                        <Container>
                          <div className="flex flex-row justify-center">
                            <Button
                              variant="flat"
                              onPress={() => _onCreateNewRequest(c)}
                              size="sm"
                              fullWidth
                            >
                              Select
                            </Button>
                          </div>
                        </Container>
                      </CardFooter>
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
