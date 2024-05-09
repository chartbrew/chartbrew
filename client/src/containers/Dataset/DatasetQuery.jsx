import React, { useState, Fragment, useEffect } from "react"
import PropTypes from "prop-types";
import {
  Button, Link, Spacer, Avatar, Badge, Tooltip, Card, CardBody,
  CardFooter, Spinner, Input, Divider, Chip,
} from "@nextui-org/react";
import { LuDatabase, LuMonitorX, LuPlus, LuSearch } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router";
import { cloneDeep, findIndex } from "lodash";
import moment from "moment";
import { toast } from "react-toastify";

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
import useThemeDetector from "../../modules/useThemeDetector";
import Text from "../../components/Text";
import { selectProjects } from "../../slices/project";


function DatasetQuery(props) {
  const { onUpdateDataset } = props;

  const [selectedRequest, setSelectedRequest] = useState({ isSettings: true });
  const [createMode, setCreateMode] = useState(false);
  const [dataRequests, setDataRequests] = useState([]);
  const [connectionSearch, setConnectionSearch] = useState("");

  const theme = useThemeDetector() ? "dark" : "light";
  const dispatch = useDispatch();
  const params = useParams();

  const stateDataRequests = useSelector((state) => selectDataRequests(state, parseInt(params.datasetId, 10))) || [];
  const connections = useSelector(selectConnections);
  const dataset = useSelector((state) => state.dataset.data.find((d) => `${d.id}` === `${params.datasetId}`));
  const projects = useSelector(selectProjects);

  useEffect(() => {
    dispatch(getDataRequestsByDataset({
      team_id: params.teamId,
      dataset_id: params.datasetId,
    }))
      .then((drs) => {
        if (drs.payload?.[0]) {
          setDataRequests(drs.payload);
          setSelectedRequest({ isSettings: true });
        }

        if (drs.payload?.[0] > 0 && !dataset.main_dr_id) {
          dispatch(updateDataset({
            team_id: params.teamId,
            dataset_id: dataset.id,
            data: { main_dr_id: drs[0].payload.id },
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
    <div className="grid grid-cols-12">
      <div className="col-span-12 md:col-span-1 flex flex-row md:flex-col border-none md:border-r-1 md:border-solid md:border-content3 gap-2">
        {selectedRequest && (
          <>
            <Row>
              <Tooltip content="Query dataset" css={{ zIndex: 99999 }} placement="right-start">
                <Link onPress={() => _onSelectSettings()} className="cursor-pointer">
                  <Avatar
                    isBordered
                    icon={(
                      <LuDatabase />
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
      {!createMode && selectedRequest?.isSettings && (
        <div className="col-span-12 md:col-span-11">
          <DatarequestSettings
            dataset={dataset}
            dataRequests={dataRequests}
            onChange={onUpdateDataset}
          />
        </div>
      )}
      {!createMode && selectedRequest && (
        <div className="col-span-12 md:col-span-11">
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
                    onClick={() => _onDeleteRequest(selectedRequest.id)}
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
        <div className="col-span-12 md:col-span-11 container mx-auto">
          <Spacer y={1} />
          <Text size="h2">Select a connection</Text>
          <Spacer y={2} />
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
          <Spacer y={4} />
          <div className="grid grid-cols-12 gap-4">
            {_filteredConnections().map((c) => {
              return (
                <div className="col-span-12 sm:col-span-6 md:sm:col-span-4" key={c.id}>
                  <Card
                    isPressable
                    isHoverable
                    onClick={() => _onCreateNewRequest(c)}
                    fullWidth
                    shadow="sm"
                    className="h-full"
                  >
                    <CardBody className="p-4 pl-unit-8">
                      <Row align="center" justify="space-between">
                        <Text size="h4">{c.name}</Text>
                        <Spacer x={0.5} />
                        <Avatar
                          radius="sm"
                          src={connectionImages(theme === "dark")[c.subType || c.type]}
                          alt={`${c.type} logo`}
                        />
                      </Row>
                      <Row align={"center"} className={"gap-1 flex-wrap"}>
                        {_getConnectionTags(c.project_ids).map((tag) => (
                          <Chip key={tag} color="primary" variant="flat" size="sm">
                            {tag}
                          </Chip>
                        ))}
                      </Row>
                      <Spacer y={2} />
                      <Row>
                        <span className={"text-xs text-default-400"}>
                          {`Created on ${moment(c.createdAt).format("LLL")}`}
                        </span>
                      </Row>
                    </CardBody>
                    <Divider />
                    <CardFooter>
                      <Container>
                        <Row justify="center">
                          <Button
                            variant="flat"
                            onClick={() => _onCreateNewRequest(c)}
                            size="sm"
                            fullWidth
                          >
                            Select
                          </Button>
                        </Row>
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
  )
}

DatasetQuery.propTypes = {
  onUpdateDataset: PropTypes.func.isRequired,
};

export default DatasetQuery
