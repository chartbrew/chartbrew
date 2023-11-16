import React, { useState, Fragment, useEffect } from "react"
import PropTypes from "prop-types";
import {
  Button, Link, Spacer, Avatar, Badge, Tooltip, Card, CardBody,
  CardFooter, Spinner,
} from "@nextui-org/react";
import { LuDatabase, LuMonitorX, LuPlus } from "react-icons/lu";
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


function DatasetQuery(props) {
  const { onUpdateDataset } = props;

  const [selectedRequest, setSelectedRequest] = useState({ isSettings: true });
  const [createMode, setCreateMode] = useState(false);
  const [dataRequests, setDataRequests] = useState([]);

  const theme = useThemeDetector() ? "dark" : "light";
  const dispatch = useDispatch();
  const params = useParams();

  const stateDataRequests = useSelector((state) => selectDataRequests(state, parseInt(params.datasetId, 10))) || [];
  const connections = useSelector(selectConnections);
  const dataset = useSelector((state) => state.dataset.data.find((d) => `${d.id}` === `${params.datasetId}`));

  useEffect(() => {
    dispatch(getDataRequestsByDataset({
      team_id: params.teamId,
      dataset_id: params.datasetId,
    }))
      .then((drs) => {
        setDataRequests(drs.payload);
        if (drs.length > 0) {
          setSelectedRequest({ isSettings: true });
        }

        if (drs.length > 0 && !dataset.main_dr_id) {
          dispatch(updateDataset({
            team_id: params.teamId,
            dataset_id: dataset.id,
            data: { main_dr_id: drs[0].id },
          }));
        }
      })
      .catch((err) => {
        toast.error("Could not load data requests. Please try again or get in touch with us.");
        if (err && err.message === "404") {
          return true;
        }
        return err;
      });
  }, []);

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
            datset_id: dataset.id,
            data: { main_dr_id: newDr.id },
          }));
          toast.success("Dataset updated");
        }

        setSelectedRequest(newDr);
        setCreateMode(false);

        // update the dataRequests array
        const newDrArray = cloneDeep(dataRequests);
        newDrArray.push(newDr);
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
      {!createMode && selectedRequest && selectedRequest.Connection && (
        <div className="col-span-12 md:col-span-11">
          {dataRequests.map((dr) => (
            <Fragment key={dr.id}>
              {selectedRequest.Connection.type === "api" && selectedRequest.id === dr.id && (
                <ApiBuilder
                  dataRequest={dr}
                  connection={dr.Connection}
                  onChangeRequest={_updateDataRequest}
                  onSave={_onSaveRequest}
                  // chart={chart}
                  onDelete={() => _onDeleteRequest(dr.id)}
                />
              )}
              {(selectedRequest.Connection.type === "mysql" || selectedRequest.Connection.type === "postgres") && selectedRequest.id === dr.id && (
                <SqlBuilder
                  dataRequest={dr}
                  connection={dr.Connection}
                  onChangeRequest={_updateDataRequest}
                  onSave={_onSaveRequest}
                  onDelete={() => _onDeleteRequest(dr.id)}
                />
              )}
              {selectedRequest.Connection.type === "mongodb" && selectedRequest.id === dr.id && (
                <MongoQueryBuilder
                  dataRequest={dr}
                  connection={dr.Connection}
                  onChangeRequest={_updateDataRequest}
                  onSave={_onSaveRequest}
                  onDelete={() => _onDeleteRequest(dr.id)}
                />
              )}
              {selectedRequest.Connection.type === "realtimedb" && selectedRequest.id === dr.id && (
                <RealtimeDbBuilder
                  dataRequest={dr}
                  connection={dr.Connection}
                  onChangeRequest={_updateDataRequest}
                  onSave={_onSaveRequest}
                  onDelete={() => _onDeleteRequest(dr.id)}
                />
              )}
              {selectedRequest.Connection.type === "firestore" && selectedRequest.id === dr.id && (
                <FirestoreBuilder
                  dataRequest={dr}
                  connection={dr.Connection}
                  onChangeRequest={_updateDataRequest}
                  onSave={_onSaveRequest}
                  onDelete={() => _onDeleteRequest(dr.id)}
                />
              )}
              {selectedRequest.Connection.type === "googleAnalytics" && selectedRequest.id === dr.id && (
                <GaBuilder
                  dataRequest={dr}
                  connection={dr.Connection}
                  onChangeRequest={_updateDataRequest}
                  onSave={_onSaveRequest}
                  onDelete={() => _onDeleteRequest(dr.id)}
                />
              )}
              {selectedRequest.Connection.type === "customerio" && selectedRequest.id === dr.id && (
                <CustomerioBuilder
                  dataRequest={dr}
                  connection={dr.Connection}
                  onChangeRequest={_updateDataRequest}
                  onSave={_onSaveRequest}
                  onDelete={() => _onDeleteRequest(dr.id)}
                />
              )}
            </Fragment>
          ))}
        </div>
      )}
      {createMode && (
        <div className="col-span-12 md:col-span-11 container mx-auto">
          <Spacer y={1} />
          <Text size="h4">Select a connection</Text>
          <Spacer y={2} />
          <div className="grid grid-cols-12 gap-4">
            {connections.map((c) => {
              return (
                <div className="col-span-12 sm:col-span-6 md:sm:col-span-4" key={c.id}>
                  <Card
                    variant="bordered"
                    isPressable
                    isHoverable
                    onClick={() => _onCreateNewRequest(c)}
                    fullWidth
                  >
                    <CardBody className="p-unit-4 pl-unit-8">
                      <Row align="center" justify="space-between">
                        <Text size="h4">{c.name}</Text>
                        <Spacer x={0.5} />
                        <Avatar
                          radius="sm"
                          src={connectionImages(theme === "dark")[c.subType || c.type]}
                          alt={`${c.type} logo`}
                        />
                      </Row>
                      <Row>
                        <Text className={"text-default-400"} size="sm">
                          {`Created on ${moment(c.createdAt).format("LLL")}`}
                        </Text>
                      </Row>
                    </CardBody>
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
