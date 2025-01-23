import React, { useState, Fragment, useEffect } from "react"
import PropTypes from "prop-types";
import {
  Button, Link, Spacer, Avatar, Badge, Tooltip, Card, CardBody,
  CardFooter, Spinner, Input, Divider, Chip,
} from "@heroui/react";
import { LuBrainCircuit, LuGitMerge, LuMonitorX, LuPlus, LuSearch } from "react-icons/lu";
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
import DatarequestSettings from "./DatarequestSettings";
import Container from "../../components/Container";
import Row from "../../components/Row";
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

  const stateDataRequests = useSelector((state) => selectDataRequests(state, parseInt(params.datasetId, 10))) || [];
  const connections = useSelector(selectConnections);
  const dataset = useSelector((state) => state.dataset.data.find((d) => `${d.id}` === `${params.datasetId}`));
  const projects = useSelector(selectProjects);
  const team = useSelector(selectTeam);

  useEffect(() => {
    dispatch(getDataRequestsByDataset({
      team_id: params.teamId,
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
            team_id: params.teamId,
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
  }, []);

  useEffect(() => {
    if (stateDataRequests.length > 0) {
      setDataRequests(stateDataRequests);
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
      team_id: params.teamId,
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
            team_id: params.teamId,
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
      team_id: params.teamId,
      dataset_id: dataset.id,
      data: {
        dataset_id: dataset.id,
        connection_id: connection.id,
      }
    }))
      .then((newDr) => {
        if (dataRequests.length < 1) {
          dispatch(updateDataset({
            team_id: params.teamId,
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
        team_id: params.teamId,
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
      return connections.filter((c) => c.name.toLowerCase().includes(connectionSearch.toLowerCase()));
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

  return (
    <>
      <aside className="fixed top-50 left-0 z-40 w-16 h-screen">
        <div className="h-full items-center py-2 overflow-y-auto flex flex-col gap-2">
          {selectedRequest && (
            <>
              <Row>
                <Tooltip content="Join data sources" css={{ zIndex: 99999 }} placement="right-start">
                  <Link onPress={() => _onSelectSettings()} className="cursor-pointer">
                    <Avatar
                      isBordered
                      icon={(
                        <LuGitMerge />
                      )}
                      radius="sm"
                      className="cursor-pointer"
                      color={selectedRequest.isSettings ? "primary" : "default"}
                    />
                  </Link>
                </Tooltip>
              </Row>
              <Spacer y={2} />
            </>
          )}
          {dataRequests.map((dr, index) => (
            <Fragment key={dr.id}>
              <Row align="center">
                <Badge
                  variant={"faded"}
                  color={
                    dataRequests.find((r) => r.id === dr.id)?.error
                      ? "danger"
                      : dataRequests.find((r) => r.id === dr.id) ? "success" : "primary"
                  }
                  content={stateDataRequests.find((o) => o.id === dr.id)?.loading ? (<Spinner size="sm" />) : `${index + 1}`}
                  shape="rectangle"
                >
                  <Avatar
                    isBordered
                    radius="sm"
                    src={
                      dr.Connection
                        ? connectionImages(theme === "dark")[dr.Connection.subType || dr.Connection.type]
                        : null
                    }
                    icon={!dr.Connection ? <LuMonitorX /> : null}
                    color={dr.id === selectedRequest?.id ? "primary" : "default"}
                    onClick={() => _onSelectDataRequest(dr)}
                  />
                </Badge>
              </Row>
              <Spacer y={0.6} />
            </Fragment>
          ))}
          <Spacer y={1.5} />
          <Row>
            <Tooltip content="Add a new data source" css={{ zIndex: 99999 }} placement="right-start">
              <Link onClick={() => setCreateMode(true)} className="cursor-pointer">
                <Avatar
                  icon={<LuPlus />}
                  isBordered
                  className="cursor-pointer"
                  color="secondary"
                />
              </Link>
            </Tooltip>
          </Row>
        </div>
      </aside>
      <div className="grid grid-cols-12 ml-16">
        <div className="col-span-12">
          <Divider />
          <Spacer y={4} />
        </div>
        {!createMode && selectedRequest?.isSettings && (
          <div className="col-span-12">
            <DatarequestSettings
              dataset={dataset}
              dataRequests={dataRequests}
              onChange={onUpdateDataset}
            />
          </div>
        )}
        {!createMode && selectedRequest && (
          <div className="col-span-12">
            {dataRequests.map((dr) => (
              <Fragment key={dr.id}>
                {selectedRequest.Connection?.type === "api" && selectedRequest.id === dr.id && (
                  <ApiBuilder
                    dataRequest={dr}
                    connection={dr.Connection}
                    onChangeRequest={_updateDataRequest}
                    onSave={_onSaveRequest}
                    // chart={chart}
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
          <div className="col-span-12 md:col-span-12 container mx-auto px-4">
            <Spacer y={1} />
            <Text size="h2">Select a connection</Text>
            <Spacer y={2} />
            {_filteredConnections().length > 0 && (
              <div>
                <Input
                  startContent={<LuSearch />}
                  placeholder="Search connections"
                  onChange={(e) => setConnectionSearch(e.target.value)}
                  className="max-w-[300px]"
                  labelPlacement="outside"
                  variant="bordered"
                />
              </div>
            )}
            <Spacer y={4} />
            <div className="grid grid-cols-12 gap-4">
              {_filteredConnections().length === 0 && (
                <div className="col-span-12 flex flex-col">
                  <p className="text-default-500">{"No connections found. Please create a connection first."}</p>
                  <Spacer y={2} />
                  <div>
                    <Button
                      onClick={() => navigate(`/${team.id}/connection/new`)}
                      color="primary"
                    >
                      Create a connection
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
                            {(c.type === "mysql" || c.type === "postgres") && (
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
