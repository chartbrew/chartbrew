import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Segment, Form, Button, Header, Label, Message, Placeholder, Container,
} from "semantic-ui-react";
import brace from "brace"; // eslint-disable-line
import AceEditor from "react-ace";

import "brace/mode/json";
import "brace/theme/tomorrow";
/*
  The Form for creating a new Mysql connection
*/
function MysqlConnectionForm(props) {
  const {
    editConnection, projectId, onComplete, addError, onTest, testResult,
  } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({ type: "mysql" });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    _init();
  }, []);

  const _init = () => {
    if (editConnection) {
      const newConnection = editConnection;
      setConnection(newConnection);
    }
  };

  const _onCreateConnection = (test = false) => {
    setErrors({});
    if (!connection.name || connection.name.length > 24) {
      setTimeout(() => {
        setErrors({ ...errors, name: "Please enter a name which is less than 24 characters" });
      }, 100);
      return;
    }
    if (!connection.host) {
      setTimeout(() => {
        setErrors({ ...errors, host: "Please enter a host name or IP address for your database" });
      }, 100);
      return;
    }

    // add the project ID
    setConnection({ ...connection, project_id: projectId });
    setTimeout(() => {
      if (test) {
        setTestLoading(true);
        onTest(connection)
          .then(() => setTestLoading(false))
          .catch(() => setTestLoading(false));
      } else {
        setLoading(true);
        onComplete(connection);
      }
    }, 100);
  };

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
                setConnection({ ...connection, name: data.value });
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
                  setConnection({ ...connection, host: data.value });
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
                placeholder="Optional, defaults to 3306"
                value={connection.port}
                onChange={(e, data) => {
                  setConnection({ ...connection, port: data.value });
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
                onChange={(e, data) => setConnection({ ...connection, dbName: data.value })}
                />
            </Form.Field>
            <Form.Field width={5}>
              <label>Username</label>
              <Form.Input
                placeholder="Enter your database username"
                value={connection.username}
                onChange={(e, data) => setConnection({ ...connection, username: data.value })}
                />
            </Form.Field>
            <Form.Field width={5}>
              <label>Password</label>
              <Form.Input
                placeholder="Enter your database password"
                type="password"
                onChange={(e, data) => setConnection({ ...connection, password: data.value })}
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
          <p>{"When you grant user privileges you might have to grant access to the server Chartbrew is running from (if the app is running on a separate server than the database)."}</p>
          <a href="https://www.cyberciti.biz/tips/how-do-i-enable-remote-access-to-mysql-database-server.html" target="_blank" rel="noopener noreferrer">
            Check this link on how to do it
          </a>
        </Message>
      </Segment>
      <Button.Group attached="bottom">
        <Button
          primary
          basic
          onClick={() => _onCreateConnection(true)}
          loading={testLoading}
        >
          Test connection
        </Button>
        {!editConnection
          && (
          <Button
            primary
            loading={loading}
            onClick={_onCreateConnection}
          >
            Connect
          </Button>
          )}
        {editConnection
          && (
          <Button
            secondary
            loading={loading}
            onClick={_onCreateConnection}
          >
            Save changes
          </Button>
          )}
      </Button.Group>
      {testLoading && (
        <Segment>
          <Placeholder>
            <Placeholder.Line />
            <Placeholder.Line />
            <Placeholder.Line />
            <Placeholder.Line />
            <Placeholder.Line />
          </Placeholder>
        </Segment>
      )}

      {testResult && !testLoading && (
        <Container fluid style={{ marginTop: 15 }}>
          <Header attached="top">
            Test Result
            <Label
              color={testResult.status < 400 ? "green" : "orange"}
            >
              {testResult.status < 400 ? "Your connection works!" : "We couldn't connect"}
            </Label>
          </Header>
          <Segment attached>
            <AceEditor
              mode="json"
              theme="tomorrow"
              height="150px"
              width="none"
              value={testResult.body}
              readOnly
              name="queryEditor"
              editorProps={{ $blockScrolling: true }}
            />
          </Segment>
        </Container>
      )}
    </div>
  );
}
const styles = {
  container: {
    flex: 1,
  },
};

MysqlConnectionForm.defaultProps = {
  onComplete: () => {},
  onTest: () => {},
  editConnection: null,
  addError: false,
  testResult: null,
};

MysqlConnectionForm.propTypes = {
  onComplete: PropTypes.func,
  onTest: PropTypes.func,
  projectId: PropTypes.string.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
  testResult: PropTypes.object,
};

export default MysqlConnectionForm;
