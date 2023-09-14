import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import moment from "moment";

import {
  Button, Modal, Spacer, Tabs, Tab, CardBody, Image, CardFooter, Card,
  ModalHeader, ModalBody, ModalFooter, ModalContent,
} from "@nextui-org/react";
import {
  ChevronLeft, Delete, Plus,
} from "react-iconly";

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
  testRequest as testRequestAction,
  removeConnection as removeConnectionAction,
  getProjectConnections as getProjectConnectionsAction,
  addConnection as addConnectionAction,
  saveConnection as saveConnectionAction,
  getConnection as getConnectionAction,
} from "../../actions/connection";
import {
  getTemplates as getTemplatesAction
} from "../../actions/template";
import { cleanErrors as cleanErrorsAction } from "../../actions/error";
import { getProjectCharts as getProjectChartsAction } from "../../actions/chart";
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

/*
  The page that contains all the connections
*/
function Connections(props) {
  const {
    cleanErrors, addConnection, saveConnection, match, history, connections, testRequest,
    removeConnection, getProjectConnections, user, team, getProjectCharts, getTemplates,
    templates, getConnection,
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

  useEffect(() => {
    cleanErrors();
    getTemplates(match.params.teamId);
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
      return addConnection(match.params.projectId, connection)
        .then((newConnection) => {
          if (redirect) {
            history.push(`/${match.params.teamId}/${match.params.projectId}/chart`);
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
      return saveConnection(match.params.projectId, connection)
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
    return testRequest(match.params.projectId, data)
      .then(async (response) => {
        newTestResult.status = response.status;
        newTestResult.body = await response.text();

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

    removeConnection(match.params.projectId, selectedConnection.id)
      .then(() => {
        return getProjectConnections(match.params.projectId);
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

    return getConnection(match.params.projectId, connection.id)
      .then((connectionData) => {
        setEditConnection(connectionData);
        setFormType(connection.type);
        return connectionData;
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
    getProjectCharts(match.params.projectId)
      .then(() => {
        history.push(`/${match.params.teamId}/${match.params.projectId}/dashboard`);
        window.location.reload();
      });
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };
  const isDark = useThemeDetector();
  return (
    <div style={styles.container}>
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
                color="secondary"
                startContent={<ChevronLeft set="bold" />}
                onClick={_closeConnectionForm}
                auto
              >
                Back
              </Button>
            )}
          </Row>
        )}

        {connections.length > 0 && !formType && (
          <Row>
            <Button
              endContent={<Plus />}
              auto
              onClick={_onOpenConnectionForm}
            >
              Add a new connection
            </Button>
          </Row>
        )}

        <Spacer y={8} />

        {(connections.length < 1 || newConnectionModal) && !formType && (
          <Container className={"p-unit-sm rounded-md bg-content3"} size="lg">
            {connections.length < 1 && (
              <Row align="center">
                <Text size="h1">
                  {"Create a connection or start with a template"}
                </Text>
                <Spacer y={2} />
              </Row>
            )}

            <Row align="center">
              <Tabs
                aria-label="Connection types"
                selectedKey={selectedMenu}
                onSelectionChange={(selected) => setSelectedMenu(selected)}
              >
                <Tab key="connections" title="Connections" />
                <Tab key="templates" title="Templates" />
                <Tab key="customTemplates" title="Custom templates" />
              </Tabs>
            </Row>
            <Spacer y={2} />
            <Row>
              {selectedMenu === "connections" && (
                <div className="grid grid-cols-12 gap-2">
                  {availableConnections.map((c) => (
                    <div key={c.type} className="col-span-3 sm:col-span-6 md:col-span-4 lg:col-span-2">
                      <Card variant="bordered" isPressable isHoverable className="project-segment" onClick={() => setFormType(c.type)}>
                        <CardBody className={"p-0"}>
                          <Image className="object-cover" width="300" height="300" src={connectionImages(isDark)[c.type]} />
                        </CardBody>
                        <CardFooter>
                          <Row wrap="wrap" justify="center" align="center">
                            <Text size="h4">
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
                    <div key={t.type} className="col-span-3 sm:col-span-6 md:col-span-4 lg:col-span-3">
                      <Card variant="flat" isPressable isHoverable className="project-segment" onClick={() => setFormType(t.type)}>
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
                  teamId={match.params.teamId}
                  projectId={match.params.projectId}
                  connections={connections}
                  onComplete={_onCompleteTemplate}
                  isAdmin={_canAccess("admin")}
                />
              )}
            </Row>
            <Spacer y={4} />
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
              projectId={match.params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "mongodb" && (
            <MongoConnectionForm
              projectId={match.params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "postgres" && (
            <PostgresConnectionForm
              projectId={match.params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "mysql" && (
            <MysqlConnectionForm
              projectId={match.params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "realtimedb" && (
            <RealtimeDbConnectionForm
              projectId={match.params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "firestore" && (
            <FirestoreConnectionForm
              projectId={match.params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "googleAnalytics" && (
            <GaConnectionForm
              projectId={match.params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "strapi" && (
            <StrapiConnectionForm
              projectId={match.params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "customerio" && (
            <CustomerioConnectionForm
              projectId={match.params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
          )}
          {formType === "timescaledb" && (
            <TimescaleConnectionForm
              projectId={match.params.projectId}
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
              teamId={match.params.teamId}
              projectId={match.params.projectId}
              onComplete={_onCompleteTemplate}
              addError={addError}
              connections={connections}
            />
          )}
          {formType === "cmTemplate" && (
            <ChartMogulTemplate
              teamId={match.params.teamId}
              projectId={match.params.projectId}
              onComplete={_onCompleteTemplate}
              addError={addError}
              connections={connections}
            />
          )}
          {formType === "mailgunTemplate" && (
            <MailgunTemplate
              teamId={match.params.teamId}
              projectId={match.params.projectId}
              onComplete={_onCompleteTemplate}
              addError={addError}
              connections={connections}
            />
          )}
          {formType === "googleAnalyticsTemplate" && (
            <GaTemplate
              teamId={match.params.teamId}
              projectId={match.params.projectId}
              onComplete={_onCompleteTemplate}
              addError={addError}
              connections={connections}
              selection={templateConnection}
            />
          )}
          {formType === "plausibleTemplate" && (
            <PlausibleTemplate
              teamId={match.params.teamId}
              projectId={match.params.projectId}
              onComplete={_onCompleteTemplate}
              addError={addError}
              connections={connections}
            />
          )}
        </div>

        {(formType || newConnectionModal) && <Spacer y={4} />}

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
                <div className="col-span-3 sm:col-span-12 md:col-span-6 lg:col-span-4" key={connection.id}>
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
                    {_canAccess("editor") && (
                      <CardFooter className="gap-2">
                        <Button
                          variant="flat"
                          onClick={() => _onEditConnection(connection)}
                          size="sm"
                          fullWidth
                        >
                          Edit
                        </Button>
                        <Button
                          color="danger"
                          variant="flat"
                          onClick={() => _onRemoveConfirmation(connection)}
                          size="sm"
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
              variant="flat"
              color="danger"
              isLoading={!!removeLoading}
              onClick={_onRemoveConnection}
              endContent={<Delete />}
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
  connections: PropTypes.array.isRequired,
  team: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  removeConnection: PropTypes.func.isRequired,
  getProjectConnections: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
  cleanErrors: PropTypes.func.isRequired,
  saveConnection: PropTypes.func.isRequired,
  addConnection: PropTypes.func.isRequired,
  testRequest: PropTypes.func.isRequired,
  getProjectCharts: PropTypes.func.isRequired,
  getTemplates: PropTypes.func.isRequired,
  templates: PropTypes.object.isRequired,
  getConnection: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    connections: state.connection.data,
    team: state.team.active,
    user: state.user.data,
    templates: state.template,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    testRequest: (projectId, data) => dispatch(testRequestAction(projectId, data)),
    removeConnection: (projectId, id) => dispatch(removeConnectionAction(projectId, id)),
    getProjectConnections: (projectId) => dispatch(getProjectConnectionsAction(projectId)),
    addConnection: (projectId, connection) => dispatch(addConnectionAction(projectId, connection)),
    saveConnection: (projectId, connection) => {
      return dispatch(saveConnectionAction(projectId, connection));
    },
    cleanErrors: () => dispatch(cleanErrorsAction()),
    getProjectCharts: (projectId) => dispatch(getProjectChartsAction(projectId)),
    getTemplates: (teamId) => dispatch(getTemplatesAction(teamId)),
    getConnection: (projectId, connectionId) => {
      return dispatch(getConnectionAction(projectId, connectionId));
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Connections);
