import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import moment from "moment";

import {
  Button, Card, Container, Grid, Loading, Modal, Row, Spacer, Text, Link,
} from "@nextui-org/react";
import {
  ChevronLeft, Delete, Plus, Scan
} from "react-iconly";

import { FaMagic, FaPlug } from "react-icons/fa";
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
import plausibleDash from "./Plausible/plausible-template.jpeg";
import simpleanalyticsDash from "./SimpleAnalytics/simpleanalytics-template.jpeg";
import chartmogulDash from "./ChartMogul/chartmogul-template.jpeg";
import mailgunDash from "./Mailgun/mailgun-template.jpeg";
import gaDash from "./GoogleAnalytics/ga-template.jpeg";

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

  return (
    <div style={styles.container}>
      <Container style={styles.mainContent}>
        {formType && (
          <Row>
            {removeError && (
              <Row align="center">
                <Text color="error" b>
                  {"Oups! A server error intrerruped the request. Please refresh the page and try again."}
                </Text>
              </Row>
            )}

            {formType && (
              <Button
                color="secondary"
                icon={<ChevronLeft set="bold" />}
                onClick={_closeConnectionForm}
                auto
              >
                Back
              </Button>
            )}

            <Spacer y={2} />
          </Row>
        )}

        {connections.length > 0 && !formType && (
          <Row>
            <Button
              iconRight={<Plus />}
              auto
              onClick={_onOpenConnectionForm}
            >
              Add a new connection
            </Button>
          </Row>
        )}

        <Spacer y={2} />

        {(connections.length < 1 || newConnectionModal) && !formType && (
          <Container css={{
            background: "$backgroundContrast", p: "$6", br: "$md"
          }}>
            {connections.length < 1 && (
              <Row align="center">
                <Text h1>
                  {"Create a connection or start with a template"}
                </Text>
                <Spacer y={1} />
              </Row>
            )}

            <Row align="center" wrap="wrap" gap={1}>
              <Link
                css={{
                  background: selectedMenu === "connections" ? "$background" : "$backgroundContrast",
                  p: 5,
                  pr: 10,
                  pl: 10,
                  br: "$sm",
                  "@xsMax": { width: "90%" },
                  ai: "center",
                  color: "$text",
                }}
                onClick={() => setSelectedMenu("connections")}
              >
                <FaPlug size={20} />
                <Spacer x={0.2} />
                <Text>{" Connections"}</Text>
              </Link>
              <Spacer x={0.2} />
              <Link
                css={{
                  background: selectedMenu === "templates" ? "$background" : "$backgroundContrast",
                  p: 5,
                  pr: 10,
                  pl: 10,
                  br: "$sm",
                  "@xsMax": { width: "90%" },
                  ai: "center",
                  color: "$text",
                }}
                onClick={() => setSelectedMenu("templates")}
              >
                <FaMagic size={20} />
                <Spacer x={0.2} />
                <Text>{" Community templates"}</Text>
              </Link>
              <Spacer x={0.2} />
              <Link
                css={{
                  background: selectedMenu === "customTemplates" ? "$background" : "$backgroundContrast",
                  p: 5,
                  pr: 10,
                  pl: 10,
                  br: "$sm",
                  "@xsMax": { width: "90%" },
                  ai: "center",
                  color: "$text",
                }}
                onClick={() => setSelectedMenu("customTemplates")}
              >
                <Scan />
                <Spacer x={0.2} />
                <Text>{" Custom templates"}</Text>
              </Link>
            </Row>
            <Spacer y={1} />
            <Row>
              {selectedMenu === "connections" && (
                <Grid.Container gap={2}>
                  <Grid xs={6} sm={4} md={2}>
                    <Card variant="bordered" isPressable isHoverable className="project-segment" onClick={() => setFormType("api")}>
                      <Card.Body css={{ p: 0 }}>
                        <Card.Image objectFit="cover" width="300" height="300" src={connectionImages.api} />
                      </Card.Body>
                      <Card.Footer>
                        <Row wrap="wrap" justify="center" align="center">
                          <Text h4>
                            API
                          </Text>
                        </Row>
                      </Card.Footer>
                    </Card>
                  </Grid>
                  <Grid xs={6} sm={4} md={2}>
                    <Card variant="bordered" isPressable isHoverable className="project-segment" onClick={() => setFormType("mongodb")}>
                      <Card.Body css={{ p: 0 }}>
                        <Card.Image objectFit="cover" width="300" height="300" src={connectionImages.mongodb} />
                      </Card.Body>
                      <Card.Footer>
                        <Row wrap="wrap" justify="center" align="center">
                          <Text h4>
                            MongoDB
                          </Text>
                        </Row>
                      </Card.Footer>
                    </Card>
                  </Grid>
                  <Grid xs={6} sm={4} md={2}>
                    <Card variant="bordered" isPressable isHoverable className="project-segment" onClick={() => setFormType("postgres")}>
                      <Card.Body css={{ p: 0 }}>
                        <Card.Image objectFit="cover" width="300" height="300" src={connectionImages.postgres} />
                      </Card.Body>
                      <Card.Footer>
                        <Row wrap="wrap" justify="center" align="center">
                          <Text h4>
                            PostgreSQL
                          </Text>
                        </Row>
                      </Card.Footer>
                    </Card>
                  </Grid>
                  <Grid xs={6} sm={4} md={2}>
                    <Card variant="bordered" isPressable isHoverable className="project-segment" onClick={() => setFormType("mysql")}>
                      <Card.Body css={{ p: 0 }}>
                        <Card.Image objectFit="cover" width="300" height="300" src={connectionImages.mysql} />
                      </Card.Body>
                      <Card.Footer>
                        <Row wrap="wrap" justify="center" align="center">
                          <Text h4>
                            MySQL
                          </Text>
                        </Row>
                      </Card.Footer>
                    </Card>
                  </Grid>
                  <Grid xs={6} sm={4} md={2}>
                    <Card variant="bordered" isPressable isHoverable className="project-segment" onClick={() => setFormType("firestore")}>
                      <Card.Body css={{ p: 0 }}>
                        <Card.Image objectFit="cover" width="300" height="300" src={connectionImages.firestore} />
                      </Card.Body>
                      <Card.Footer>
                        <Row wrap="wrap" justify="center" align="center">
                          <Text h4>
                            Firestore
                          </Text>
                        </Row>
                      </Card.Footer>
                    </Card>
                  </Grid>
                  <Grid xs={6} sm={4} md={2}>
                    <Card variant="bordered" isPressable isHoverable className="project-segment" onClick={() => setFormType("realtimedb")}>
                      <Card.Body css={{ p: 0 }}>
                        <Card.Image objectFit="cover" width="300" height="300" src={connectionImages.realtimedb} />
                      </Card.Body>
                      <Card.Footer>
                        <Row wrap="wrap" justify="center" align="center">
                          <Text h4>
                            Realtime Database
                          </Text>
                        </Row>
                      </Card.Footer>
                    </Card>
                  </Grid>
                  <Grid xs={6} sm={4} md={2}>
                    <Card variant="bordered" isPressable isHoverable className="project-segment" onClick={() => setFormType("googleAnalytics")}>
                      <Card.Body css={{ p: 0 }}>
                        <Card.Image objectFit="cover" width="300" height="300" src={connectionImages.googleAnalytics} />
                      </Card.Body>
                      <Card.Footer>
                        <Row wrap="wrap" justify="center" align="center">
                          <Text h4>
                            Google Analytics
                          </Text>
                        </Row>
                      </Card.Footer>
                    </Card>
                  </Grid>
                  <Grid xs={6} sm={4} md={2}>
                    <Card variant="bordered" isPressable isHoverable className="project-segment" onClick={() => setFormType("customerio")}>
                      <Card.Body css={{ p: 0 }}>
                        <Card.Image objectFit="cover" width="300" height="300" src={connectionImages.customerio} />
                      </Card.Body>
                      <Card.Footer>
                        <Row wrap="wrap" justify="center" align="center">
                          <Text h4>
                            Customer.io
                          </Text>
                        </Row>
                      </Card.Footer>
                    </Card>
                  </Grid>
                </Grid.Container>
              )}

              {selectedMenu === "templates" && (
                <Grid.Container gap={2}>
                  <Grid xs={12} sm={6} md={4}>
                    <Card variant="flat" isPressable isHoverable className="project-segment" onClick={() => setFormType("saTemplate")}>
                      <Card.Body css={{ p: 0 }}>
                        <Card.Image objectFit="cover" width="300" height="300" src={simpleanalyticsDash} />
                      </Card.Body>
                      <Card.Footer>
                        <Row wrap="wrap" justify="center" align="center">
                          <Text h4>
                            Simple Analytics
                          </Text>
                        </Row>
                      </Card.Footer>
                    </Card>
                  </Grid>
                  <Grid xs={12} sm={6} md={4}>
                    <Card variant="flat" isPressable isHoverable className="project-segment" onClick={() => setFormType("cmTemplate")}>
                      <Card.Body css={{ p: 0 }}>
                        <Card.Image objectFit="cover" width="300" height="300" src={chartmogulDash} />
                      </Card.Body>
                      <Card.Footer>
                        <Row wrap="wrap" justify="center" align="center">
                          <Text h4>
                            ChartMogul
                          </Text>
                        </Row>
                      </Card.Footer>
                    </Card>
                  </Grid>
                  <Grid xs={12} sm={6} md={4}>
                    <Card variant="flat" isPressable isHoverable className="project-segment" onClick={() => setFormType("mailgunTemplate")}>
                      <Card.Body css={{ p: 0 }}>
                        <Card.Image objectFit="cover" width="300" height="300" src={mailgunDash} />
                      </Card.Body>
                      <Card.Footer>
                        <Row wrap="wrap" justify="center" align="center">
                          <Text h4>
                            Mailgun
                          </Text>
                        </Row>
                      </Card.Footer>
                    </Card>
                  </Grid>
                  <Grid xs={12} sm={6} md={4}>
                    <Card variant="flat" isPressable isHoverable className="project-segment" onClick={() => setFormType("googleAnalyticsTemplate")}>
                      <Card.Body css={{ p: 0 }}>
                        <Card.Image objectFit="cover" width="300" height="300" src={gaDash} />
                      </Card.Body>
                      <Card.Footer>
                        <Row wrap="wrap" justify="center" align="center">
                          <Text h4>
                            Google Analytics
                          </Text>
                        </Row>
                      </Card.Footer>
                    </Card>
                  </Grid>
                  <Grid xs={12} sm={6} md={4}>
                    <Card variant="flat" isPressable isHoverable className="project-segment" onClick={() => setFormType("plausibleTemplate")}>
                      <Card.Body css={{ p: 0 }}>
                        <Card.Image objectFit="cover" width="300" height="300" src={plausibleDash} />
                      </Card.Body>
                      <Card.Footer>
                        <Row wrap="wrap" justify="center" align="center">
                          <Text h4>
                            Plausible Analytics
                          </Text>
                        </Row>
                      </Card.Footer>
                    </Card>
                  </Grid>
                </Grid.Container>
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
            <Spacer y={1} />
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

        {(formType || newConnectionModal) && <Spacer y={2} />}

        {connections.length > 0 && (
          <Row align="center">
            <Spacer x={0.5} />
            <Text h2>
              {"Your connections"}
            </Text>
          </Row>
        )}
        <Spacer y={1} />
        <Row align="center" />
        <Row align="center">
          <Grid.Container gap={2}>
            {connections.map(connection => {
              return (
                <Grid xs={12} sm={6} md={4} key={connection.id}>
                  <Card
                    variant="bordered"
                    isPressable
                    isHoverable
                    className="project-segment"
                    style={
                      editConnection && connection.id === editConnection.id
                        ? styles.selectedConnection : {}
                    }
                    onClick={() => _onEditConnection(connection)}
                  >
                    <Card.Body css={{ p: "$4", pl: "$8" }}>
                      <Container justify="flex-start" fluid>
                        <Row align="center" justify="space-between">
                          <Text h4>{connection.name}</Text>
                          <Spacer x={0.2} />
                          <img
                            width="50px"
                            height="50px"
                            src={connectionImages[connection.type]}
                            alt={`${connection.type} logo`}
                          />
                        </Row>
                        <Row>
                          <Text css={{ color: "$accents7" }}>
                            {`Created on ${moment(connection.createdAt).format("LLL")}`}
                          </Text>
                        </Row>
                      </Container>
                    </Card.Body>
                    {_canAccess("editor") && (
                      <Card.Footer>
                        <Container>
                          <Row justify="center">
                            <Button
                              flat
                              onClick={() => _onEditConnection(connection)}
                              size="sm"
                            >
                              Edit
                            </Button>
                            <Spacer x={0.5} />
                            <Button
                              color="error"
                              flat
                              disabled={removeLoading === connection.id}
                              onClick={() => _onRemoveConfirmation(connection)}
                              size="sm"
                            >
                              {removeLoading === connection.id && (<Loading type="points" />)}
                              {!removeLoading && "Remove"}
                            </Button>
                          </Row>
                        </Container>
                      </Card.Footer>
                    )}
                  </Card>
                </Grid>
              );
            })}
          </Grid.Container>
        </Row>
      </Container>

      {/* REMOVE CONFIRMATION MODAL */}
      <Modal open={removeModal} blur onClose={() => setRemoveModal(false)}>
        <Modal.Header>
          <Text h4>Are you sure you want to remove this connection?</Text>
        </Modal.Header>
        <Modal.Body>
          <p>
            {"All the charts that are using this connection will stop working."}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            flat
            color="warning"
            onClick={() => setRemoveModal(false)}
            auto
          >
            Go back
          </Button>
          <Button
            flat
            color="error"
            disabled={!!removeLoading}
            onClick={_onRemoveConnection}
            iconRight={<Delete />}
            auto
          >
            Remove completely
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  mainContent: {
    padding: 20,
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
