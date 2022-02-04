import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Segment, Form, Button, Icon, Header, Label, Message, Container,
  Placeholder, Divider, List, Transition,
} from "semantic-ui-react";
import AceEditor from "react-ace";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import { secondary } from "../../../config/colors";

const sampleAuth = `{
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "example",
  "private_key": "-----BEGIN PRIVATE KEY-----example-----END PRIVATE KEY-----",
  "client_email": "firebase-adminsdk@example.iam.gserviceaccount.com",
  "client_id": "00000000000000000000",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk%40example.iam.gserviceaccount.com"
}`;

/*
  The Form used to create API connections
*/
function RealtimeDbConnectionForm(props) {
  const {
    editConnection, projectId, onComplete, addError, onTest, testResult,
  } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({ type: "realtimedb", optionsArray: [], firebaseServiceAccount: sampleAuth });
  const [errors, setErrors] = useState({});
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    _init();
  }, []);

  const _init = () => {
    if (editConnection) {
      const newConnection = editConnection;
      newConnection.firebaseServiceAccount = _getFirebaseAuth(newConnection);
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
    if (!connection.firebaseServiceAccount) {
      setTimeout(() => {
        setErrors({ ...errors, firebaseServiceAccount: "Please enter Firebase credentials" });
      }, 100);
      return;
    }

    // add the project ID
    setConnection({ ...connection, project_id: projectId });

    setTimeout(() => {
      const newConnection = connection;
      if (!connection.id) newConnection.project_id = projectId;
      if (test === true) {
        setTestLoading(true);
        onTest(newConnection)
          .then(() => setTestLoading(false))
          .catch(() => setTestLoading(false));
      } else {
        setLoading(true);
        onComplete(newConnection)
          .then(() => setLoading(false))
          .catch(() => setLoading(false));
      }
    }, 100);
  };

  const _getFirebaseAuth = (data) => {
    const { firebaseServiceAccount } = data;
    if (!firebaseServiceAccount) return sampleAuth;
    try {
      return JSON.stringify(data.firebaseServiceAccount, null, 4);
    } catch (e) {
      return data.firebaseServiceAccount || sampleAuth;
    }
  };

  return (
    <div style={styles.container}>
      <Segment style={styles.mainSegment}>
        <Header as="h3" style={{ marginBottom: 20 }}>
          {!editConnection && "Connect to your Firebase"}
          {editConnection && `Edit ${editConnection.name}`}
        </Header>

        <div style={styles.formStyle}>
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

            <Form.Field>
              <Divider />

              <Header as="h4" onClick={() => setShowInstructions(!showInstructions)} style={styles.tableFields}>
                {"See connection instructions "}
                {!showInstructions && (<Icon size="small" name="chevron down" />)}
                {showInstructions && (<Icon size="small" name="chevron up" />)}
              </Header>
              <Transition animation="fade down" visible={showInstructions}>
                <div>
                  <List divided relaxed="very">
                    <List.Item as="a" href="https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk?authuser=0" target="_blank" rel="noreferrer noopener">
                      <List.Content>
                        <List.Header style={{ color: secondary }}>
                          {"1. Create a Firebase Service Account "}
                          <Icon name="external alternate" />
                        </List.Header>
                        <List.Description>{"Log in with your Google account and select the project you want to connect to."}</List.Description>
                      </List.Content>
                    </List.Item>

                    <List.Item>
                      <List.Content>
                        <List.Header>{"2. Once authenticated, press on 'Generate new private key'"}</List.Header>
                        <List.Description>{"This will start a download with a JSON file on your computer."}</List.Description>
                      </List.Content>
                    </List.Item>

                    <List.Item>
                      <List.Content>
                        <List.Header>{"3. Open the JSON file and copy the contents below."}</List.Header>
                        <List.Description>{"The JSON file contains authentication details that Chartbrew needs in order to connect to your Firebase."}</List.Description>
                      </List.Content>
                    </List.Item>
                  </List>
                </div>
              </Transition>
              <Divider hidden />

            </Form.Field>

            <Form.Field>
              <label>Add your Service Account details here</label>
              <AceEditor
                mode="json"
                theme="tomorrow"
                height="250px"
                width="none"
                value={connection.firebaseServiceAccount || ""}
                name="queryEditor"
                onChange={(value) => {
                  setConnection({ ...connection, firebaseServiceAccount: value });
                }}
                editorProps={{ $blockScrolling: true }}
              />
            </Form.Field>

            <Divider hidden />
          </Form>
        </div>

        {addError
          && (
            <Message negative>
              <Message.Header>{"Server error while trying to save your connection"}</Message.Header>
              <p>Please try adding your connection again.</p>
            </Message>
          )}

        <Message icon>
          <Icon name="wrench" />
          <Message.Content>
            <Message.Header>Realtime Database has just arrived</Message.Header>
            {"The integration was just added to Chartbrew. If you spot any issues, please let me know at "}
            <a href="mailto:raz@chartbrew.com?subject=Realtime Database feedback">raz@chartbrew.com</a>
          </Message.Content>
        </Message>

        <Divider hidden />
        <Container fluid textAlign="right">
          <Button
            primary
            basic
            onClick={() => _onCreateConnection(true)}
            loading={testLoading}
          >
            Test connection
          </Button>
          {!editConnection && (
            <Button
              primary
              loading={loading}
              onClick={_onCreateConnection}
              icon
              labelPosition="right"
              style={styles.saveBtn}
            >
              <Icon name="checkmark" />
              Save connection
            </Button>
          )}
          {editConnection && (
            <Button
              secondary
              loading={loading}
              onClick={_onCreateConnection}
              icon
              labelPosition="right"
              style={styles.saveBtn}
            >
              <Icon name="checkmark" />
              Save changes
            </Button>
          )}
        </Container>
      </Segment>

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
              {`Status code: ${testResult.status}`}
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
  mainSegment: {
    padding: 20,
  },
  formStyle: {
    marginTop: 20,
    marginBottom: 20,
  },
  saveBtn: {
    marginRight: 0,
  },
};

RealtimeDbConnectionForm.defaultProps = {
  editConnection: null,
  addError: null,
  testResult: null,
};

RealtimeDbConnectionForm.propTypes = {
  onComplete: PropTypes.func.isRequired,
  onTest: PropTypes.func.isRequired,
  projectId: PropTypes.string.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
  testResult: PropTypes.object,
};

export default RealtimeDbConnectionForm;
