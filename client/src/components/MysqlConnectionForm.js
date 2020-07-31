import React, { Component } from "react";
import PropTypes from "prop-types";
import {
  Segment, Form, Button, Header, Label, Message
} from "semantic-ui-react";

/*
  The Form for creating a new Mysql connection
*/
class MysqlConnectionForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      connection: { type: "mysql" },
      errors: {},
    };
  }

  componentDidMount() {
    this._init();
  }

  _init = () => {
    const { editConnection } = this.props;
    if (editConnection) {
      const newConnection = editConnection;
      this.setState({ connection: newConnection });
    }
  }

  _onCreateConnection = () => {
    const {
      projectId, onComplete,
    } = this.props;
    const { connection, errors } = this.state;

    this.setState({ errors: {} }, () => {
      if (!connection.name || connection.name.length > 24) {
        this.setState({ errors: { ...errors, name: "Please enter a name which is less than 24 characters" } });
        return;
      }
      if (!connection.host) {
        this.setState({ errors: { ...errors, host: "Please enter a host name or IP address for your database" } });
        return;
      }

      // add the project ID
      this.setState({
        connection: {
          ...connection, project_id: projectId,
        },
        loading: true,
      }, () => {
        onComplete(connection);
      });
    });
  }

  render() {
    const { editConnection } = this.props;
    const {
      connection, errors, addError, loading,
    } = this.state;
    return (
      <div style={styles.container}>
        <Header attached="top" as="h2">Add a new MySQL connection</Header>
        <Segment attached>
          <Form>
            <Form.Field error={!!errors.name} required>
              <label>Name your connection</label>
              <Form.Input
                placeholder="Enter a name that you can recognise later"
                value={connection.name || ""}
                onChange={(e, data) => {
                  this.setState({ connection: { ...connection, name: data.value } });
                }}
              />
              {errors.name
                && (
                <Label basic color="red" pointing>
                  {errors.name}
                </Label>
                )}
            </Form.Field>

            <Form.Group widths={2}>
              <Form.Field error={!!errors.host} required width={10}>
                <label>The hostname of your API</label>
                <Form.Input
                  placeholder="mysql.example.com"
                  value={connection.host || ""}
                  onChange={(e, data) => {
                    this.setState({ connection: { ...connection, host: data.value } });
                  }}
                />
                {errors.host
                  && (
                  <Label basic color="red" pointing>
                    {errors.host}
                  </Label>
                  )}
              </Form.Field>
              <Form.Field width={6}>
                <label>Port</label>
                <Form.Input
                  placeholder="Port number (optional)"
                  value={connection.port}
                  onChange={(e, data) => {
                    this.setState({ connection: { ...connection, port: data.value } });
                  }}
                />
              </Form.Field>
            </Form.Group>

            <Form.Group widths={3}>
              <Form.Field width={6}>
                <label>Database name</label>
                <Form.Input
                  placeholder="Enter your database name"
                  value={connection.dbName}
                  onChange={(e, data) => this.setState({
                    connection: { ...connection, dbName: data.value }
                  })}
                />
              </Form.Field>
              <Form.Field width={5}>
                <label>Username</label>
                <Form.Input
                  placeholder="Enter your database username"
                  value={connection.username}
                  onChange={(e, data) => this.setState({
                    connection: { ...connection, username: data.value }
                  })}
                />
              </Form.Field>
              <Form.Field width={5}>
                <label>Password</label>
                <Form.Input
                  placeholder="Enter your database password"
                  type="password"
                  onChange={(e, data) => this.setState({
                    connection: { ...connection, password: data.value }
                  })}
                />
              </Form.Field>
            </Form.Group>
          </Form>

          {addError
            && (
            <Message negative>
              <Message.Header>{"Server error while trying to save your connection"}</Message.Header>
              <p>Please try adding your connection again.</p>
            </Message>
            )}
          <Message info>
            <Message.Header>Avoid using users that can write data</Message.Header>
            <p>{"Out of abundance of caution, we recommend all our users to connect read-only permissions to their MySQL database."}</p>
            <a href="https://www.digitalocean.com/community/tutorials/how-to-create-a-new-user-and-grant-permissions-in-mysql" target="_blank" rel="noopener noreferrer">
              Check this link on how to do it
            </a>
          </Message>

          <Message info>
            <Message.Header>{"You need to allow remote connections to your MySQL database"}</Message.Header>
            <p>{"When you grant user privileges you might have to grant access to the server Chartbrew is running from (if the app is running separately than the database)."}</p>
            <a href="https://www.cyberciti.biz/tips/how-do-i-enable-remote-access-to-mysql-database-server.html" target="_blank" rel="noopener noreferrer">
              Check this link on how to do it
            </a>
          </Message>
        </Segment>
        {!editConnection
          && (
          <Button
            primary
            attached="bottom"
            loading={loading}
            onClick={this._onCreateConnection}
          >
            Connect
          </Button>
          )}
        {editConnection
          && (
          <Button
            secondary
            attached="bottom"
            loading={loading}
            onClick={this._onCreateConnection}
          >
            Save changes
          </Button>
          )}
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
  },
};

MysqlConnectionForm.defaultProps = {
  onComplete: () => {},
  editConnection: null,
};

MysqlConnectionForm.propTypes = {
  onComplete: PropTypes.func,
  projectId: PropTypes.string.isRequired,
  editConnection: PropTypes.object,
};

export default MysqlConnectionForm;
