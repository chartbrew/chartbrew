import React, { useState, useEffect, Fragment, useRef } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import _ from "lodash";
import { Flip, toast, ToastContainer } from "react-toastify";
import {
  Button, Link, Spacer, Avatar, Badge, Tooltip, Card, CircularProgress, CardBody,
  CardFooter, Spinner,
} from "@nextui-org/react";
import moment from "moment";
import { LuLink2, LuMonitorX, LuPlus } from "react-icons/lu";
import { useParams } from "react-router";

import ApiBuilder from "../AddChart/components/ApiBuilder";
import SqlBuilder from "../AddChart/components/SqlBuilder";
import MongoQueryBuilder from "../AddChart/components/MongoQueryBuilder";
import RealtimeDbBuilder from "../Connections/RealtimeDb/RealtimeDbBuilder";
import FirestoreBuilder from "../Connections/Firestore/FirestoreBuilder";
import GaBuilder from "../Connections/GoogleAnalytics/GaBuilder";
import CustomerioBuilder from "../Connections/Customerio/CustomerioBuilder";
import DatarequestSettings from "../AddChart/components/DatarequestSettings";
import Container from "../../components/Container";
import Row from "../../components/Row";
import Text from "../../components/Text";
import useThemeDetector from "../../modules/useThemeDetector";

import { changeTutorial as changeTutorialAction } from "../../actions/tutorial";
import connectionImages from "../../config/connectionImages";
import {
  updateDataset,
} from "../../slices/dataset";
import {
  getDataRequestsByDataset, createDataRequest, updateDataRequest, deleteDataRequest, selectDataRequests,
} from "../../slices/dataset";
import Navbar from "../../components/Navbar";

function Dataset(props) {
  const {
    requests, changeTutorial, chart, connections,
  } = props;

  const [initialising, setInitialising] = useState(false);
  const [dataRequests, setDataRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [error, setError] = useState(null);
  const [createMode, setCreateMode] = useState(false);

  const theme = useThemeDetector() ? "dark" : "light";
  const params = useParams();
  const dispatch = useDispatch();
  const initRef = useRef(null);

  const dataset = useSelector((state) => state.dataset.data.find((d) => `${d.id}` === `${params.datasetId}`));
  const stateDataRequests = useSelector((state) => selectDataRequests(state, parseInt(params.datasetId, 10))) || [];

  useEffect(() => {
    if (!dataset) {
      setDataRequests([]);
      return;
    }

    if (!initRef.current) {
      initRef.current = true;
      setInitialising(true);
      dispatch(getDataRequestsByDataset({
        team_id: params.teamId,
        dataset_id: dataset.id
      }))
        .then((drs) => {
          setInitialising(false);
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
          setInitialising(false);
          if (err && err.message === "404") {
            setCreateMode(true);
            return true;
          }
          setError("Cannot fetch the data request configuration. Try to refresh the page.");
          return err;
        });
    }
  }, [dataset]);

  useEffect(() => {
    if (selectedRequest?.Connection?.type !== "firestore") changeTutorial("requestmodal");
  }, [requests, dataset]);

  useEffect(() => {
    let message = error;
    if (error instanceof Error) {
      message = "Could not fetch data. Please check your query.";
    }

    if (error) {
      toast.error(message);
    }
  }, [error]);

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
    const drIndex = _.findIndex(dataRequests, { id: newDr.id });
    if (drIndex > -1) {
      const newDrArray = _.cloneDeep(dataRequests);
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
      .then((savedDr) => {
        setSelectedRequest(savedDr);

        // if it's the first data request, update the main_dr_id
        if (dataRequests.length === 1 && !dataset.main_dr_id) {
          dispatch(updateDataset({
            team_id: params.teamId,
            dataset_id: dataset.id,
            data: { main_dr_id: savedDr.id }
          }));
        }

        // update the dataRequests array and replace the item
        _updateDataRequest(savedDr);
      })
      .catch((e) => {
        setError(e);
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
        }

        setSelectedRequest(newDr);
        setCreateMode(false);

        // update the dataRequests array
        const newDrArray = _.cloneDeep(dataRequests);
        newDrArray.push(newDr);
        setDataRequests(newDrArray);
      })
      .catch((e) => {
        toast.error("Could not create connection. Please try again or get in touch with us.");
        setError(e);
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
          const newDrArray = _.cloneDeep(dataRequests);
          setDataRequests(newDrArray.filter((dr) => dr.id !== drId));
          setSelectedRequest(newDrArray[0]);
        })
        .catch((e) => {
          setError(e);
          return e;
        });
    }
  };

  const _onUpdateDataset = (data) => {
    return dispatch(updateDataset({
      team_id: params.teamId,
      dataset_id: dataset.id,
      data
    }))
      .then((newDataset) => {
        return newDataset;
      })
      .catch((e) => {
        setError(e);
        return e;
      });
  };

  const _onSelectSettings = () => {
    if (dataRequests.length === 0) {
      toast.info("You need to create a data request first.");
      return;
    }
    setSelectedRequest({ isSettings: true });
  };

  return (
    <div>
      <Navbar hideTeam transparent />
      <div className="p-2 md:p-4 md:pl-8 md:pr-8">
        <Row>
          <Text size="h4">{"Configure your dataset"}</Text>
          {initialising && (
            <>
              <Spacer x={1} />
              <CircularProgress size="xl" />
            </>
          )}
        </Row>
        <Spacer y={4} />
        <div className="grid grid-cols-12">
          <div className="col-span-12 md:col-span-1 flex flex-row md:flex-col border-none md:border-r-1 md:border-solid md:border-content3 gap-2">
            {selectedRequest && (
              <>
                <Row>
                  <Tooltip content="Join data requests" css={{ zIndex: 99999 }} placement="right-start">
                    <Link onPress={() => _onSelectSettings()} className="cursor-pointer">
                      <Avatar
                        isBordered
                        icon={(
                          <LuLink2 />
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
                onChange={_onUpdateDataset}
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
                      chart={chart}
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
      </div>

      <ToastContainer
        position="top-right"
        autoClose={1500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnVisibilityChange
        draggable
        pauseOnHover
        transition={Flip}
        theme={theme}
      />
    </div>
  );
}

Dataset.propTypes = {
  dataset: PropTypes.object.isRequired,
  requests: PropTypes.array.isRequired,
  changeTutorial: PropTypes.func.isRequired,
  chart: PropTypes.object.isRequired,
  connections: PropTypes.array.isRequired,
  datasetResponses: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => {
  return {
    requests: state.dataset.requests,
    connections: state.connection.data,
    datasetResponses: state.dataset.responses,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    changeTutorial: (tutorial) => dispatch(changeTutorialAction(tutorial)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Dataset);
