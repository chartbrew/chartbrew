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
  A form for creating a new Postgres connection
*/
function PostgresConnectionForm(props) {
  const {
    editConnection, projectId, onComplete, addError, onTest, testResult,
  } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({ type: "postgres" });
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
    setConnection({ ...connection, projectId });

    setTimeout(() => {
      if (test === true) {
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
      <Header attached="top" as="h2">Add a new PostgreSQL connection</Header>
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
                placeholder="postgres.example.com"
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
                placeholder="Optional, defaults to 5432"
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
          <p>{"Out of abundance of caution, we recommend all our users to connect read-only permissions to their PostgreSQL database."}</p>
          <a href="https://gist.github.com/oinopion/4a207726edba8b99fd0be31cb28124d0" target="_blank" rel="noopener noreferrer">
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
            attached="bottom"
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
            attached="bottom"
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

PostgresConnectionForm.defaultProps = {
  onComplete: () => {},
  onTest: () => {},
  editConnection: null,
  addError: false,
  testResult: null,
};

PostgresConnectionForm.propTypes = {
  onComplete: PropTypes.func,
  onTest: PropTypes.func,
  projectId: PropTypes.string.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
  testResult: PropTypes.object,
};

export default PostgresConnectionForm;
