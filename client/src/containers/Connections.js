import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import moment from "moment";
import {
  Card, Image, Button, Icon, Container, Divider,
  Modal, Header, Message, Dimmer, Segment,
} from "semantic-ui-react";

import ConnectionForm from "../components/ConnectionForm";
import ApiConnectionForm from "../components/ApiConnectionForm";
import PostgresConnectionForm from "../components/PostgresConnectionForm";
import MysqlConnectionForm from "../components/MysqlConnectionForm";
import {
  testConnection, updateConnection, removeConnection, getProjectConnections
} from "../actions/connection";
import mongoLogo from "../assets/mongodb-logo-1.png";
import canAccess from "../config/canAccess";
import mysql from "../assets/mysql.svg";
import rest from "../assets/api.png";
import postgres from "../assets/postgres.png";
import firebase from "../assets/firebase_logo.png";

/*
  Description
*/
class Connections extends Component {
  constructor(props) {
    super(props);

    this.state = {
      testModal: false,
    };
  }

  _testConnection = (id) => {
    const { testConnection, match } = this.props;

    this.setState({
      testModal: true,
      testModalLoading: true,
      testModalFailed: false,
      testModalSuccess: false,
    });
    testConnection(match.params.projectId, id)
      .then(() => {
        this.setState({ testModalSuccess: true, testModalLoading: false });
      })
      .catch(() => {
        this.setState({ testModalFailed: true, testModalLoading: false });
      });
  }

  _prepareConnectionStatus = (connection) => {
    this.setState({ selectedConnection: connection, statusModal: true });
  }

  _changeConnectionStatus = (connection) => {
    const { updateConnection, match } = this.props;

    if (this.state.selectedConnection) connection = this.state.selectedConnection; // eslint-disable-line
    this.setState({
      statusChangeLoading: true,
      statusChangeFailed: false,
    });

    updateConnection(
      match.params.projectId,
      connection.id,
      { active: !connection.active }
    )
      .then(() => {
        this.setState({
          statusChangeLoading: false,
          statusModal: false,
          selectedConnection: false
        });
      })
      .catch(() => {
        this.setState({ statusChangeLoading: false, statusChangeFailed: true });
      });
  }

  _onOpenConnectionForm = () => {
    this.setState({ newConnectionModal: true });
  }

  _onAddNewConnection = (error) => {
    if (error) return;

    this.setState({ formType: null, editConnection: null });
  }

  _onRemoveConfirmation = (connection) => {
    this.setState({ selectedConnection: connection, removeModal: true });
  }

  _onRemoveConnection = () => {
    const { removeConnection, getProjectConnections, match } = this.props;
    const { selectedConnection } = this.state;

    this.setState({ removeLoading: selectedConnection.id, removeError: false });
    removeConnection(match.params.projectId, selectedConnection.id)
      .then(() => {
        return getProjectConnections(match.params.projectId);
      })
      .then(() => {
        this.setState({
          removeLoading: false,
          selectedConnection: false,
          removeModal: false,
        });
      })
      .catch(() => {
        this.setState({ removeError: true, removeModal: true, selectedConnection: false });
      });
  }

  _onEditConnection = (connection) => {
    document.getElementById("connection-form-area").scrollIntoView({
      behavior: "smooth"
    });
    this.setState({ editConnection: connection, formType: connection.type });
  }

  _closeConnectionForm = () => {
    this.setState({
      newConnectionModal: false, formType: null, editConnection: null,
    });
  }

  _canAccess(role) {
    const { user, team } = this.props;
    return canAccess(role, user.id, team.TeamRoles);
  }

  renderComingSoon() {
    return (
      <Header textAlign="center" icon inverted>
        <Icon size="huge" name="lock" />
        Coming soon
      </Header>
    );
  }

  render() {
    const { connections, match } = this.props;
    const {
      statusChangeFailed, removeError, formType, newConnectionModal,
      editConnection, testModalLoading, testModal, testModalSuccess, testModalFailed,
      statusChangeLoading, statusModal, removeLoading, removeModal,
    } = this.state;

    return (
      <div style={styles.container}>
        <Container style={styles.mainContent}>
          {connections.length > 0
            && (
            <Container>
              {(statusChangeFailed || removeError)
                && (
                <Message negative>
                  <Message.Header>Oups! A server error intrerruped the request</Message.Header>
                  <p>Please refresh the page and try again.</p>
                </Message>
                )}

              {!formType
                && (
                <Button primary icon labelPosition="right" onClick={this._onOpenConnectionForm}>
                  <Icon name="plus" />
                  Add a new connection
                </Button>
                )}
              {formType
                && (
                <Button secondary icon labelPosition="right" onClick={this._closeConnectionForm}>
                  <Icon name="x" />
                  Close
                </Button>
                )}

              <Divider />
            </Container>
            )}

          {(connections.length < 1 || newConnectionModal) && !formType
            && (
            <div>
              <Header as="h2">
                {"Select a connection type"}
              </Header>
              <Segment>
                <Card.Group centered itemsPerRow={5} stackable>
                  <Card color="violet" raised link onClick={() => this.setState({ formType: "mongodb" })}>
                    <Image src={mongoLogo} />
                    <Card.Content>
                      <Card.Header>MongoDB</Card.Header>
                    </Card.Content>
                  </Card>
                  <Card color="violet" raised link onClick={() => this.setState({ formType: "api" })}>
                    <Image src={rest} />
                    <Card.Content>
                      <Card.Header>API</Card.Header>
                    </Card.Content>
                  </Card>
                  <Card color="violet" raised link onClick={() => this.setState({ formType: "postgres" })}>
                    <Image src={postgres} />
                    <Card.Content>
                      <Card.Header>PostgreSQL</Card.Header>
                    </Card.Content>
                  </Card>
                  <Card color="violet" raised link onClick={() => this.setState({ formType: "mysql" })}>
                    <Image src={mysql} />
                    <Card.Content>
                      <Card.Header>MySQL</Card.Header>
                    </Card.Content>
                  </Card>
                  <Card color="olive" raised>
                    <Dimmer.Dimmable
                      as={Image}
                      dimmed
                      dimmer={{ active: true, content: this.renderComingSoon() }}
                      onMouseEnter={this.handleShow}
                      onMouseLeave={this.handleHide}
                      src={firebase}
                    />
                    <Card.Content>
                      <Card.Header>Firebase</Card.Header>
                    </Card.Content>
                  </Card>
                </Card.Group>
              </Segment>
            </div>
            )}

          <div id="connection-form-area">
            {formType === "mongodb"
              && (
              <ConnectionForm
                projectId={match.params.projectId}
                onComplete={(error) => this._onAddNewConnection(error)}
                editConnection={editConnection}
              />
              )}

            {formType === "api"
              && (
              <ApiConnectionForm
                projectId={match.params.projectId}
                onComplete={(error) => this._onAddNewConnection(error)}
                editConnection={editConnection}
              />
              )}

            {formType === "postgres"
              && (
              <PostgresConnectionForm
                projectId={match.params.projectId}
                onComplete={(error) => this._onAddNewConnection(error)}
                editConnection={editConnection}
              />
              )}

            {formType === "mysql"
              && (
              <MysqlConnectionForm
                projectId={match.params.projectId}
                onComplete={(error) => this._onAddNewConnection(error)}
                editConnection={editConnection}
              />
              )}
          </div>

          {connections.length > 0
            && (
            <Header as="h2">
              {"Your connections"}
            </Header>
            )}
          {connections.map(connection => {
            return (
              <Card key={connection.id} fluid>
                <Card.Content>
                  <Image
                    floated="right"
                    size="tiny"
                    src={
                      connection.type === "mongodb" ? mongoLogo
                        : connection.type === "api" ? rest
                          : connection.type === "postgres" ? postgres
                            : connection.type === "mysql" ? mysql : mongoLogo
                    }
                  />
                  <Card.Header>{connection.name}</Card.Header>
                  <Card.Meta>{`Created on ${moment(connection.createdAt).format("LLL")}`}</Card.Meta>
                  <Card.Description>
                    {/*
                      connection.active &&
                      <Label color="green">The connection is active</Label>
                    */}
                    {/*
                      !connection.active &&
                      <Label color="red">The connection is not active</Label>
                    */}
                  </Card.Description>
                </Card.Content>
                <Card.Content extra>
                  <div className="ui three buttons">
                    <Button basic color="teal" onClick={() => this._testConnection(connection.id)}>
                      <Icon name="flask" />
                      Test
                    </Button>
                    {/*
                      connection.active &&
                      <Button
                        basic
                        color="yellow"
                        onClick={() => this._prepareConnectionStatus(connection)}
                      >
                        <Icon name="pause" />
                        De-activate
                      </Button>
                    */}
                    {/*
                      !connection.active &&
                      <Button
                        basic
                        color="green"
                        loading={this.state.statusChangeLoading}
                        onClick={() => this._changeConnectionStatus(connection)}
                      >
                        <Icon name="play" />
                        Activate
                      </Button>
                    */}
                    {this._canAccess("admin")
                      && (
                      <Button
                        basic
                        secondary
                        onClick={() => this._onEditConnection(connection)}
                      >
                        <Icon name="pencil" />
                        Edit
                      </Button>
                      )}
                    {this._canAccess("admin")
                      && (
                      <Button
                        basic
                        color="red"
                        loading={removeLoading === connection.id}
                        onClick={() => this._onRemoveConfirmation(connection)}
                      >
                        <Icon name="x" />
                        Remove
                      </Button>
                      )}
                  </div>
                </Card.Content>
              </Card>
            );
          })}
        </Container>

        {/* TESTING CONNECTION MODAL */}
        <Modal open={testModal} basic size="small" onClose={() => this.setState({ testModal: false })}>
          <Header
            icon={testModalLoading ? "flask" : testModalSuccess ? "checkmark" : "x"}
            color={testModalSuccess ? "green" : testModalFailed ? "red" : null}
            content="Testing your connection settings"
          />
          <Modal.Content>
            {testModalLoading
              && (
              <p>
                {"Testing underway..."}
              </p>
              )}
            {testModalSuccess
              && (
              <p>
                {"Yay! We connected successfully."}
              </p>
              )}
            {testModalFailed
              && (
              <p>
                {"Oh no! We were unable to connect to your database. Check your settings and try again."}
              </p>
              )}
          </Modal.Content>
          <Modal.Actions>
            <Button
              inverted
              loading={testModalLoading}
              onClick={() => this.setState({ testModal: false })}
            >
              <Icon name="checkmark" />
              {" "}
              Close
            </Button>
          </Modal.Actions>
        </Modal>

        {/* STATUS MODAL */}
        <Modal open={statusModal} basic size="small" onClose={() => this.setState({ statusModal: false })}>
          <Header
            icon="question circle"
            content="Are you sure you want to stop this connection?"
          />
          <Modal.Content>
            <p>
              {"All the charts that are using this connection will stop updating."}
            </p>
          </Modal.Content>
          <Modal.Actions>
            <Button
              basic
              inverted
              onClick={() => this.setState({ statusModal: false })}
            >
              Close
            </Button>
            <Button
              color="orange"
              inverted
              loading={statusChangeLoading}
              onClick={this._changeConnectionStatus}
            >
              <Icon name="checkmark" />
              De-activate
            </Button>
          </Modal.Actions>
        </Modal>

        {/* REMOVE CONFIRMATION MODAL */}
        <Modal open={removeModal} basic size="small" onClose={() => this.setState({ removeModal: false })}>
          <Header
            icon="exclamation triangle"
            content="Are you sure you want to remove this connection?"
          />
          <Modal.Content>
            <p>
              {"All the charts that are using this connection will be removed as well. If you want to temporarily stop the connection without losing the charts, you can de-activate the connection instead of removing it completely."}
            </p>
          </Modal.Content>
          <Modal.Actions>
            <Button
              basic
              inverted
              onClick={() => this.setState({ removeModal: false })}
            >
              Go back
            </Button>
            <Button
              color="orange"
              inverted
              loading={!!removeLoading}
              onClick={this._onRemoveConnection}
            >
              <Icon name="x" />
              Remove completely
            </Button>
          </Modal.Actions>
        </Modal>
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
  },
  mainContent: {
    padding: 20,
  },
};

Connections.propTypes = {
  connections: PropTypes.array.isRequired,
  team: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  testConnection: PropTypes.func.isRequired,
  updateConnection: PropTypes.func.isRequired,
  removeConnection: PropTypes.func.isRequired,
  getProjectConnections: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
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
    testConnection: (projectId, id) => dispatch(testConnection(projectId, id)),
    updateConnection: (projectId, id, data) => dispatch(updateConnection(projectId, id, data)),
    removeConnection: (projectId, id) => dispatch(removeConnection(projectId, id)),
    getProjectConnections: (projectId) => dispatch(getProjectConnections(projectId)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Connections);
