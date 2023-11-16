import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import moment from "moment";
import {
  Button, Modal, Spacer, Tabs, Tab, CardBody, Image, CardFooter, Card,
  ModalHeader, ModalBody, ModalFooter, ModalContent,
} from "@nextui-org/react";
import { useParams, useNavigate } from "react-router-dom";

import MongoConnectionForm from "./components/MongoConnectionForm";
import ApiConnectionForm from "./components/ApiConnectionForm";
import PostgresConnectionForm from "./components/PostgresConnectionForm";
import MysqlConnectionForm from "./components/MysqlConnectionForm";
import RealtimeDbConnectionForm from "./RealtimeDb/RealtimeDbConnectionForm";
import FirestoreConnectionForm from "./Firestore/FirestoreConnectionForm";
import GaConnectionForm from "./GoogleAnalytics/GaConnectionForm";
import CustomerioConnectionForm from "./Customerio/CustomerioConnectionForm";
import SimpleAnalyticsTemplate from "./SimpleAnalytics/SimpleAnalyticsTemplate";
import ChartMogulTemplate from "./ChartMogul/ChartMogulTemplate";
import MailgunTemplate from "./Mailgun/MailgunTemplate";
import GaTemplate from "./GoogleAnalytics/GaTemplate";
import CustomTemplates from "./CustomTemplates/CustomTemplates";
import PlausibleTemplate from "./Plausible/PlausibleTemplate";

import {
  testRequest, removeConnection, addConnection, getTeamConnections,
  saveConnection, getConnection, selectConnections,
} from "../../slices/connection";
import {
  getTemplates as getTemplatesAction
} from "../../actions/template";
import { cleanErrors as cleanErrorsAction } from "../../actions/error";
import { getProjectCharts } from "../../slices/chart";
import canAccess from "../../config/canAccess";
import { primary } from "../../config/colors";
import connectionImages from "../../config/connectionImages";
import TimescaleConnectionForm from "./Timescale/TimescaleConnectionForm";
import StrapiConnectionForm from "./Strapi/StrapiConnectionForm";
import Container from "../../components/Container";
import Row from "../../components/Row";
import Text from "../../components/Text";
import useThemeDetector from "../../modules/useThemeDetector";
import availableConnections from "../../modules/availableConnections";
import availableTemplates from "../../modules/availableTemplates";
import { HiArrowLeft, HiPlus, HiTrash } from "react-icons/hi";

/*
  The page that contains all the connections
*/
function Connections(props) {
  const {
    cleanErrors, user, team, getTemplates, templates,
  } = props;

  const [newConnectionModal, setNewConnectionModal] = useState(false);
  const [addError, setAddError] = useState(false);
  const [formType, setFormType] = useState("");
  const [editConnection, setEditConnection] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [removeModal, setRemoveModal] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState("connections");
  const [templateConnection, setTemplateConnection] = useState(-1);

  const connections = useSelector(selectConnections);

  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    cleanErrors();
    getTemplates(params.teamId);
  }, []);

  useEffect(() => {
    if (!selectedConnection && !editConnection) {
      const params = new URLSearchParams(document.location.search);
      if (params.has("edit") && params.has("type")) {
        setTemplateConnection(parseInt(params.get("edit"), 10));
        setFormType(params.get("type"));
      } else if (params.has("edit") && connections && connections.length > 0) {
        const foundConnection = connections.filter((c) => `${c.id}` === params.get("edit"))[0];
        if (foundConnection) {
          _onEditConnection(foundConnection);
        }
      } else if (params.has("connection")) {
        setFormType(params.get("connection"));
        _onOpenConnectionForm();
      }
    }
  }, [connections]);

  useEffect(() => {
    setTestResult(null);
  }, [selectedConnection, editConnection]);

  const _onOpenConnectionForm = () => {
    setNewConnectionModal(true);
    setTestResult(null);
  };

  const _onAddNewConnection = (connection, switchToEdit) => {
    let redirect = false;
    if (connections.length === 0 && !switchToEdit) {
      redirect = true;
    }

    if (!connection.id) {
      return dispatch(addConnection({ team_id: params.teamId, connection }))
        .then((data) => {
          const newConnection = data.payload;
          if (redirect) {
            navigate(`/${params.teamId}/${params.projectId}/chart`);
          }

          if (!switchToEdit) {
            setFormType(null);
            setEditConnection(null);
          } else {
            _onEditConnection(newConnection);
          }

          setNewConnectionModal(false);
          return true;
        })
        .catch((error) => {
          setAddError(error);
          return false;
        });
    } else {
      return dispatch(saveConnection({ team_id: params.teamId, connection }))
        .then(() => {
          setFormType(null);
          setEditConnection(null);
          return true;
        })
        .catch((error) => {
          setAddError(error);
          return false;
        });
    }
  };

  const _onTestRequest = (data) => {
    const newTestResult = {};
    return dispatch(testRequest({ team_id: params.teamId, connection: data }))
      .then(async (response) => {
        newTestResult.status = response.payload.status;
        newTestResult.body = await response.payload.text();

        try {
          newTestResult.body = JSON.parse(newTestResult.body);
          newTestResult.body = JSON.stringify(newTestResult, null, 2);
        } catch (e) {
          // the response is not in JSON format
        }

        setTestResult(newTestResult);
        return Promise.resolve(newTestResult);
      })
      .catch(() => {});
  };

  const _onRemoveConfirmation = (connection) => {
    setSelectedConnection(connection);
    setRemoveModal(true);
  };

  const _onRemoveConnection = () => {
    setRemoveLoading(selectedConnection.id);
    setRemoveError(false);

    dispatch(removeConnection({ team_id: params.team_id, connection_id: selectedConnection.id }))
      .then(() => {
        return dispatch(getTeamConnections({ team_id: params.teamId }));
      })
      .then(() => {
        setRemoveLoading(false);
        setSelectedConnection(false);
        setRemoveModal(false);
      })
      .catch(() => {
        setRemoveError(true);
        setRemoveModal(true);
        setSelectedConnection(false);
      });
  };

  const _onEditConnection = (connection) => {
    setEditConnection(null);
    setFormType("");

    return dispatch(getConnection({ team_id: params.teamId, connection_id: connection.id }))
      .then((connectionData) => {
        setEditConnection(connectionData.payload);
        setFormType(connection.type);
        return connectionData.payload;
      })
      .catch((err) => {
        return err;
      });
  };

  const _closeConnectionForm = () => {
    setNewConnectionModal(true);
    setFormType(null);
    setEditConnection(null);
  };

  const _onCompleteTemplate = () => {
    dispatch(getProjectCharts({ project_id: params.projectId }))
      .then(() => {
        navigate(`/${params.teamId}/${params.projectId}/dashboard`);
        window.location.reload();
      });
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };
  const isDark = useThemeDetector();
  return (
    <div className="bg-content2">
      <Container className={"pt-10"} size="xl">
        {formType && (
          <Row>
            {removeError && (
              <Row align="center">
                <Text color="danger" b>
                  {"Oups! A server error intrerruped the request. Please refresh the page and try again."}
                </Text>
              </Row>
            )}

            {formType && (
              <Button
                color="default"
                startContent={<HiArrowLeft />}
                onClick={_closeConnectionForm}
                variant="solid"
              >
                Back
              </Button>
            )}
          </Row>
        )}

        {connections.length > 0 && !formType && (
          <Row>
            <Button
              endContent={<HiPlus />}
              color="primary"
              onClick={_onOpenConnectionForm}
            >
              Add a new connection
            </Button>
          </Row>
        )}

        <Spacer y={8} />

        {(connections.length < 1 || newConnectionModal) && !formType && (
          <Container className={"p-unit-md rounded-lg bg-content1 border-1 border-content3 pt-8 pb-8 mb-8"} size="lg">
            {connections.length < 1 && (
              <>
                <Row align="center">
                  <Text size="h1">
                    {"Create a connection or start with a template"}
                  </Text>
                </Row>
                <Spacer y={4} />
              </>
            )}

            <Row align="center">
              <Tabs
                aria-label="Connection types"
                selectedKey={selectedMenu}
                onSelectionChange={(selected) => setSelectedMenu(selected)}
                fullWidth
              >
                <Tab key="connections" title="Connections" />
                <Tab key="templates" title="Templates" />
                <Tab key="customTemplates" title="Custom templates" />
              </Tabs>
            </Row>
            <Spacer y={2} />
            <Row align="center" justify={"center"}>
              {selectedMenu === "connections" && (
                <div className="grid grid-cols-12 gap-4">
                  {availableConnections.map((c) => (
                    <div key={c.type} className="col-span-6 md:col-span-3 xl:col-span-2 sm:col-span-6">
                      <Card
                        isPressable
                        isHoverable
                        className="border border-content3"
                        onClick={() => setFormType(c.type)}
                      >
                        <CardBody className={"p-0"}>
                          <Image className="object-cover" width="300" height="300" src={connectionImages(isDark)[c.type]} />
                        </CardBody>
                        <CardFooter>
                          <Row wrap="wrap" justify="center" align="center">
                            <Text b>
                              {c.name}
                            </Text>
                          </Row>
                        </CardFooter>
                      </Card>
                    </div>
                  ))}
                </div>
              )}

              {selectedMenu === "templates" && (
                <div className="grid grid-cols-12 gap-2">
                  {availableTemplates.map((t) => (
                    <div key={t.type} className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3">
                      <Card
                        isPressable
                        isHoverable
                        onClick={() => setFormType(t.type)}
                      >
                        <CardBody className="p-0">
                          <Image className="object-cover" width="300" height="300" src={t.image} />
                        </CardBody>
                        <CardFooter>
                          <Row wrap="wrap" justify="center" align="center">
                            <Text size="h4">
                              {t.name}
                            </Text>
                          </Row>
                        </CardFooter>
                      </Card>
                    </div>
                  ))}
                </div>
              )}
              {selectedMenu === "customTemplates" && (
                <CustomTemplates
                  templates={templates.data}
                  loading={templates.loading}
                  teamId={params.teamId}
                  projectId={params.projectId}
                  connections={connections}
                  onComplete={_onCompleteTemplate}
                  isAdmin={_canAccess("teamAdmin")}
                />
              )}
            </Row>
            <Spacer y={8} />
            <Row>
              <Text>
                {"Need access to another data source? "}
                <a href="https://github.com/chartbrew/chartbrew/issues" target="_blank" rel="noopener noreferrer">
                  {"Let us know 💬"}
                </a>
              </Text>
            </Row>
          </Container>
        )}

        <Spacer y={4} />
        <div id="connection-form-area">
          {formType === "api" && (
            <ApiConnectionForm
              projectId={params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "mongodb" && (
            <MongoConnectionForm
              projectId={params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "postgres" && (
            <PostgresConnectionForm
              projectId={params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "mysql" && (
            <MysqlConnectionForm
              projectId={params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "realtimedb" && (
            <RealtimeDbConnectionForm
              projectId={params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "firestore" && (
            <FirestoreConnectionForm
              projectId={params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "googleAnalytics" && (
            <GaConnectionForm
              projectId={params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "strapi" && (
            <StrapiConnectionForm
              projectId={params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "customerio" && (
            <CustomerioConnectionForm
              projectId={params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "timescaledb" && (
            <TimescaleConnectionForm
              projectId={params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}

          {/* ADD TEMPLATES BELOW */}
          {formType === "saTemplate" && (
            <SimpleAnalyticsTemplate
              teamId={params.teamId}
              projectId={params.projectId}
              onComplete={_onCompleteTemplate}
              addError={addError}
              connections={connections}
            />
          )}
          {formType === "cmTemplate" && (
            <ChartMogulTemplate
              teamId={params.teamId}
              projectId={params.projectId}
              onComplete={_onCompleteTemplate}
              addError={addError}
              connections={connections}
            />
          )}
          {formType === "mailgunTemplate" && (
            <MailgunTemplate
              teamId={params.teamId}
              projectId={params.projectId}
              onComplete={_onCompleteTemplate}
              addError={addError}
              connections={connections}
            />
          )}
          {formType === "googleAnalyticsTemplate" && (
            <GaTemplate
              teamId={params.teamId}
              projectId={params.projectId}
              onComplete={_onCompleteTemplate}
              addError={addError}
              connections={connections}
              selection={templateConnection}
            />
          )}
          {formType === "plausibleTemplate" && (
            <PlausibleTemplate
              teamId={params.teamId}
              projectId={params.projectId}
              onComplete={_onCompleteTemplate}
              addError={addError}
              connections={connections}
            />
          )}
        </div>

        {formType && <Spacer y={8} />}

        {connections.length > 0 && (
          <Row align="center">
            <Text size="h2">
              {"Your connections"}
            </Text>
          </Row>
        )}
        <Spacer y={2} />
        <Row align="center">
          <div className="grid grid-cols-12 gap-4 w-full">
            {connections.map(connection => {
              return (
                <div className="col-span-12 sm:col-span-12 md:col-span-6 lg:col-span-4" key={connection.id}>
                  <Card
                    variant="bordered"
                    isPressable
                    isHoverable
                    style={
                      editConnection && connection.id === editConnection.id
                        ? styles.selectedConnection : {}
                    }
                    onClick={() => _onEditConnection(connection)}
                    className="w-full"
                  >
                    <CardBody className="p-4">
                      <Row align="center">
                        <Image
                          src={connectionImages(isDark)[connection.subType || connection.type]}
                          height={50}
                          width={50}
                          radius="sm"
                          alt="connection image"
                        />
                        <Spacer x={4} />
                        <div className="flex flex-col">
                          <Text size="h4">{connection.name}</Text>
                          <Text className={"text-gray-500"}>
                            {`Created on ${moment(connection.createdAt).format("LL")}`}
                          </Text>
                        </div>
                      </Row>
                    </CardBody>
                    {_canAccess("projectAdmin") && (
                      <CardFooter className="gap-2">
                        <Button
                          variant="flat"
                          onClick={() => _onEditConnection(connection)}
                          fullWidth
                        >
                          Edit
                        </Button>
                        <Button
                          color="danger"
                          variant="flat"
                          onClick={() => _onRemoveConfirmation(connection)}
                          isLoading={removeLoading === connection.id}
                          fullWidth
                        >
                          {"Remove"}
                        </Button>
                      </CardFooter>
                    )}
                  </Card>
                </div>
              );
            })}
          </div>
        </Row>

        <Spacer y={10} />
      </Container>

      {/* REMOVE CONFIRMATION MODAL */}
      <Modal isOpen={removeModal} backdrop="blur" onClose={() => setRemoveModal(false)}>
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Are you sure you want to remove this connection?</Text>
          </ModalHeader>
          <ModalBody>
            <p>
              {"All the charts that are using this connection will stop working."}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              color="default"
              onClick={() => setRemoveModal(false)}
              auto
            >
              Go back
            </Button>
            <Button
              color="danger"
              isLoading={!!removeLoading}
              onClick={_onRemoveConnection}
              endContent={<HiTrash />}
              auto
            >
              Remove completely
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  selectedConnection: {
    boxShadow: `${primary} 0 3px 3px 0, ${primary} 0 0 0 3px`,
  },
  smallerText: {
    fontSize: 12,
  },
};

Connections.propTypes = {
  team: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  cleanErrors: PropTypes.func.isRequired,
  getTemplates: PropTypes.func.isRequired,
  templates: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    team: state.team.active,
    user: state.user.data,
    templates: state.template,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    cleanErrors: () => dispatch(cleanErrorsAction()),
    getTemplates: (teamId) => dispatch(getTemplatesAction(teamId)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Connections);
