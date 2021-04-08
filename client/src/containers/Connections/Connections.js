import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import moment from "moment";
import {
  Card, Image, Button, Icon, Container, Divider,
  Modal, Header, Message, Segment, Step, TransitionablePortal,
} from "semantic-ui-react";

import MongoConnectionForm from "./components/MongoConnectionForm";
import ApiConnectionForm from "./components/ApiConnectionForm";
import PostgresConnectionForm from "./components/PostgresConnectionForm";
import MysqlConnectionForm from "./components/MysqlConnectionForm";
import FirebaseConnectionForm from "./Firebase/FirebaseConnectionForm";
import FirestoreConnectionForm from "./Firestore/FirestoreConnectionForm";
import {
  testRequest as testRequestAction,
  removeConnection as removeConnectionAction,
  getProjectConnections as getProjectConnectionsAction,
  addConnection as addConnectionAction,
  saveConnection as saveConnectionAction,
} from "../../actions/connection";
import { cleanErrors as cleanErrorsAction } from "../../actions/error";
import mongoLogo from "../../assets/mongodb-logo-1.png";
import canAccess from "../../config/canAccess";
import mysql from "../../assets/mysql.svg";
import rest from "../../assets/api.png";
import postgres from "../../assets/postgres.png";
import firebaseLogo from "../../assets/firebase-real-time-database.png";
import firestoreLogo from "../../assets/firebase-firestore.png";
import { primary } from "../../config/colors";

/*
  The page that contains all the connections
*/
function Connections(props) {
  const {
    cleanErrors, addConnection, saveConnection, match, history, connections, testRequest,
    removeConnection, getProjectConnections, user, team,
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

  useEffect(() => {
    cleanErrors();
  }, []);

  useEffect(() => {
    setTestResult(null);
  }, [selectedConnection, editConnection]);

  const _onOpenConnectionForm = () => {
    setNewConnectionModal(true);
    setTestResult(null);
  };

  const _onAddNewConnection = (connection) => {
    let redirect = false;
    if (connections.length === 0) {
      redirect = true;
    }

    if (!connection.id) {
      return addConnection(match.params.projectId, connection)
        .then(() => {
          if (redirect) {
            history.push(`/${match.params.teamId}/${match.params.projectId}/chart`);
          }
          setFormType(null);
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
    setEditConnection(connection);
    setFormType(connection.type);
  };

  const _closeConnectionForm = () => {
    setNewConnectionModal(true);
    setFormType(null);
    setEditConnection(null);
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  return (
    <div style={styles.container}>
      <Container style={styles.mainContent}>
        {formType && (
          <Container>
            {removeError && (
              <Message negative>
                <Message.Header>Oups! A server error intrerruped the request</Message.Header>
                <p>Please refresh the page and try again.</p>
              </Message>
            )}

            {formType && (
              <Button secondary icon labelPosition="left" onClick={_closeConnectionForm}>
                <Icon name="chevron left" />
                Back
              </Button>
            )}

            <Divider />
          </Container>
        )}

        {connections.length > 0 && !formType && (
          <Container>
            <Button primary icon labelPosition="right" onClick={_onOpenConnectionForm}>
              <Icon name="plus" />
              Add a new connection
            </Button>
            <Divider />
          </Container>
        )}

        {(connections.length < 1 || newConnectionModal) && !formType
          && (
          <div>
            <Divider hidden />
            {connections.length < 1 && (
              <div style={{ textAlign: "center" }}>
                <Step.Group style={{ textAlign: "left" }}>
                  <Step completed>
                    <Icon name="checkmark" />
                    <Step.Content>
                      <Step.Title>Project</Step.Title>
                      <Step.Description>Create your first project</Step.Description>
                    </Step.Content>
                  </Step>
                  <Step active>
                    <Icon name="hand point down outline" />
                    <Step.Content>
                      <Step.Title>Connect</Step.Title>
                      <Step.Description>Connect to your data source</Step.Description>
                    </Step.Content>
                  </Step>
                  <Step disabled>
                    <Step.Content>
                      <Step.Title>Visualize</Step.Title>
                      <Step.Description>Create your first chart</Step.Description>
                    </Step.Content>
                  </Step>
                </Step.Group>
                <Header as="h1" textAlign="center">
                  {"How would you like to get your data?"}
                  <Header.Subheader>Select one of the connection types below</Header.Subheader>
                </Header>
                <Divider hidden />
              </div>
            )}
            {connections.length > 0 && (
              <Header as="h2" textAlign="left">
                Select one of the connection types below
              </Header>
            )}
            <Segment attached>
              <Card.Group itemsPerRow={5} stackable>
                <Card className="project-segment" onClick={() => setFormType("api")}>
                  <Image src={rest} />
                  <Card.Content>
                    <Card.Header>API</Card.Header>
                  </Card.Content>
                </Card>
                <Card className="project-segment" onClick={() => setFormType("mongodb")}>
                  <Image src={mongoLogo} />
                  <Card.Content>
                    <Card.Header>MongoDB</Card.Header>
                  </Card.Content>
                </Card>
                <Card className="project-segment" onClick={() => setFormType("postgres")}>
                  <Image src={postgres} />
                  <Card.Content>
                    <Card.Header>PostgreSQL</Card.Header>
                  </Card.Content>
                </Card>
                <Card className="project-segment" onClick={() => setFormType("mysql")}>
                  <Image src={mysql} />
                  <Card.Content>
                    <Card.Header>MySQL</Card.Header>
                  </Card.Content>
                </Card>
                <Card className="project-segment" onClick={() => setFormType("firestore")}>
                  <Image
                    src={firestoreLogo}
                    label={{
                      as: "a", color: "olive", title: "Freshly released", corner: "left", icon: "wrench"
                    }}
                  />
                  <Card.Content>
                    <Card.Header>Firestore</Card.Header>
                  </Card.Content>
                </Card>
              </Card.Group>
            </Segment>
            <Segment attached="bottom">
              <p>
                {"Need access to another data source? "}
                <a href="https://github.com/chartbrew/chartbrew/issues" target="_blank" rel="noopener noreferrer">
                  {"Let us know 💬"}
                </a>
              </p>
            </Segment>
          </div>
          )}

        <div id="connection-form-area">
          {formType === "api"
            && (
              <ApiConnectionForm
                projectId={match.params.projectId}
                onTest={_onTestRequest}
                onComplete={_onAddNewConnection}
                editConnection={editConnection}
                addError={addError}
                testResult={testResult}
              />
            )}

          {formType === "mongodb"
            && (
            <MongoConnectionForm
              projectId={match.params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
            )}

          {formType === "postgres"
            && (
            <PostgresConnectionForm
              projectId={match.params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
            )}

          {formType === "mysql"
            && (
            <MysqlConnectionForm
              projectId={match.params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
            )}

          {formType === "firebase"
            && (
            <FirebaseConnectionForm
              projectId={match.params.projectId}
              onTest={_onTestRequest}
              onComplete={_onAddNewConnection}
              editConnection={editConnection}
              addError={addError}
              testResult={testResult}
            />
            )}

          {formType === "firestore"
            && (
              <FirestoreConnectionForm
                projectId={match.params.projectId}
                onTest={_onTestRequest}
                onComplete={_onAddNewConnection}
                editConnection={editConnection}
                addError={addError}
                testResult={testResult}
              />
            )}
        </div>

        {connections.length > 0
          && (
          <Header as="h2">
            {"Your connections"}
          </Header>
          )}
        <Card.Group itemsPerRow={3} stackable>
          {connections.map(connection => {
            return (
              <Card
                key={connection.id}
                fluid
                className="project-segment"
                style={
                  editConnection && connection.id === editConnection.id
                    ? styles.selectedConnection : {}
                }
              >
                <Card.Content>
                  <Image
                    floated="right"
                    size="tiny"
                    src={
                      connection.type === "mongodb" ? mongoLogo
                        : connection.type === "api" ? rest
                          : connection.type === "postgres" ? postgres
                            : connection.type === "mysql" ? mysql
                              : connection.type === "firebase" ? firebaseLogo
                                : connection.type === "firestore" ? firestoreLogo : mongoLogo
                    }
                  />
                  <Card.Header>{connection.name}</Card.Header>
                  <Card.Meta style={styles.smallerText}>
                    {`Created on ${moment(connection.createdAt).format("LLL")}`}
                  </Card.Meta>
                  <Card.Description />
                </Card.Content>
                <Card.Content extra>
                  <Button.Group widths={2}>
                    {_canAccess("admin")
                      && (
                      <Button
                        primary
                        basic
                        onClick={() => _onEditConnection(connection)}
                      >
                        <Icon name="pencil" />
                        Edit
                      </Button>
                      )}
                    {_canAccess("admin")
                      && (
                      <Button
                        color="red"
                        basic
                        loading={removeLoading === connection.id}
                        onClick={() => _onRemoveConfirmation(connection)}
                      >
                        <Icon name="x" />
                        Remove
                      </Button>
                      )}
                  </Button.Group>
                </Card.Content>
              </Card>
            );
          })}
        </Card.Group>
      </Container>

      {/* REMOVE CONFIRMATION MODAL */}
      <TransitionablePortal open={removeModal}>
        <Modal open={removeModal} basic size="small" onClose={() => setRemoveModal(false)}>
          <Header
            icon="exclamation triangle"
            content="Are you sure you want to remove this connection?"
          />
          <Modal.Content>
            <p>
              {"All the charts that are using this connection will stop working."}
            </p>
          </Modal.Content>
          <Modal.Actions>
            <Button
              basic
              inverted
              onClick={() => setRemoveModal(false)}
            >
              Go back
            </Button>
            <Button
              color="orange"
              inverted
              loading={!!removeLoading}
              onClick={_onRemoveConnection}
            >
              <Icon name="x" />
              Remove completely
            </Button>
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>
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
  }
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
};

const mapStateToProps = (state) => {
  return {
    connections: state.connection.data,
    team: state.team.active,
    user: state.user.data,
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
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Connections);
