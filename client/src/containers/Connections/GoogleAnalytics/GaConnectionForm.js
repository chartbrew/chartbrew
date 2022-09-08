/* eslint-disable react/jsx-props-no-spreading */

import React, {
  useState, useEffect,
} from "react";
import PropTypes from "prop-types";
import {
  Button, Container, Input, Loading, Row, Spacer, Text, useTheme,
} from "@nextui-org/react";
import AceEditor from "react-ace";
import cookie from "react-cookies";
import { FaGoogle } from "react-icons/fa";
import { HiRefresh } from "react-icons/hi";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { API_HOST } from "../../../config/settings";
import Badge from "../../../components/Badge";

/*
  The Form used to create GA connections
*/
function GaConnectionForm(props) {
  const {
    editConnection, projectId, onComplete, addError, onTest, testResult,
  } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({ type: "googleAnalytics", optionsArray: [], name: "Google Analytics" });
  const [errors, setErrors] = useState({});

  const { isDark } = useTheme();

  useEffect(() => {
    _init();
  }, [editConnection]);

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
        onComplete(newConnection, true)
          .then(() => setLoading(false))
          .catch(() => setLoading(false));
      }
    }, 100);
  };

  const _onGoogleAuth = () => {
    const url = `${API_HOST}/project/${projectId}/connection/${connection.id}/google/auth`;
    const method = "GET";
    const headers = new Headers({
      "Accept": "application/json",
      "Authorization": cookie.load("brewToken"),
    });

    return fetch(url, { method, headers })
      .then((response) => {
        if (!response.ok) return Promise.reject(response.status);

        return response.json();
      })
      .then((result) => {
        if (result.url) {
          window.location.href = result.url;
        } else {
          Promise.reject("No URL found");
        }
      })
      .catch(() => {
        setErrors({ ...errors, auth: "Cannot authenticate with Google. Please try again." });
      });
  };

  return (
    <div style={styles.container}>
      <Container
        css={{
          backgroundColor: "$backgroundContrast",
          br: "$md",
          p: 10,
          "@xs": {
            p: 20,
          },
          "@sm": {
            p: 20,
          },
          "@md": {
            p: 20,
          },
        }}
        md
        justify="flex-start"
      >
        <Row align="center">
          <Text h3>
            {!editConnection && "Connect to Google Analytics"}
            {editConnection && `Edit ${editConnection.name}`}
          </Text>
        </Row>
        <Spacer y={1} />
        <Row align="center">
          <Input
            label="Name your connection"
            placeholder="Enter a name that you can recognise later"
            value={connection.name || ""}
            onChange={(e) => {
              setConnection({ ...connection, name: e.target.value });
            }}
            helperColor="error"
            helperText={errors.name}
            bordered
            fullWidth
            css={{ "@md": { width: "600px" } }}
          />
        </Row>
        <Spacer y={0.5} />
        <Row>
          {!editConnection && (
            <Button
              color={"secondary"}
              disabled={loading || !connection.name}
              onClick={_onCreateConnection}
              auto
            >
              {loading && <Loading type="points" />}
              {!loading && "Create connection"}
            </Button>
          )}
          {editConnection && !connection.OAuth && (
            <Button
              color={"secondary"}
              iconRight={<FaGoogle size={20} />}
              onClick={_onGoogleAuth}
              auto
            >
              {"Authenticate with Google"}
            </Button>
          )}
          {editConnection && connection.OAuth && (
            <Button
              color={"secondary"}
              iconRight={<HiRefresh size={22} />}
              onClick={_onGoogleAuth}
              auto
            >
              {"Click here to re-authenticate"}
            </Button>
          )}
        </Row>
        {editConnection && connection.OAuth && (
          <Row>
            <Text color="success">
              {`Authenticated as ${connection.OAuth.email}`}
            </Text>
          </Row>
        )}
        {errors.auth && (
          <Row>
            <Text color="error">{errors.auth}</Text>
          </Row>
        )}
        <Spacer y={1} />

        {addError && (
          <Row>
            <Container css={{ backgroundColor: "$red300", p: 10 }}>
              <Row>
                <Text h5>{"Server error while trying to save your connection"}</Text>
              </Row>
              <Row>
                <Text>Please try adding your connection again.</Text>
              </Row>
            </Container>
          </Row>
        )}
        <Spacer y={1} />
        <Row>
          <Button
            ghost
            auto
            onClick={() => _onCreateConnection(true)}
            disabled={!connection.name || !connection.oauth_id || testLoading}
          >
            {testLoading && <Loading type="points" color="currentColor" />}
            {!testLoading && "Test connection"}
          </Button>
          <Spacer x={0.2} />
          <Button
            disabled={loading || !connection.oauth_id}
            onClick={_onCreateConnection}
            auto
          >
            {loading && <Loading type="points" color="currentColor" />}
            {!loading && "Save connection"}
          </Button>
        </Row>
      </Container>
      <Spacer y={1} />

      {testLoading && (
        <Container css={{ backgroundColor: "$backgroundContrast", br: "$md", p: 20 }} md>
          <Row align="center">
            <Loading type="points">
              Test underway...
            </Loading>
          </Row>
          <Spacer y={2} />
        </Container>
      )}

      {testResult && !testLoading && (
        <Container
          css={{
            backgroundColor: "$backgroundContrast", br: "$md", p: 20, mt: 20
          }}
          md
        >
          <Row align="center">
            <Text>
              {"Test Result "}
              <Badge
                type={testResult.status < 400 ? "success" : "error"}
              >
                {`Status code: ${testResult.status}`}
              </Badge>
            </Text>
          </Row>
          <Spacer y={1} />
          <AceEditor
            mode="json"
            theme={isDark ? "one_dark" : "tomorrow"}
            style={{ borderRadius: 10 }}
            height="150px"
            width="none"
            value={testResult.body || "Hello"}
            readOnly
            name="queryEditor"
            editorProps={{ $blockScrolling: true }}
          />
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
  baseStyle: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px",
    borderWidth: 2,
    borderRadius: 2,
    borderColor: "#eeeeee",
    borderStyle: "dashed",
    backgroundColor: "#fafafa",
    color: "#bdbdbd",
    outline: "none",
    transition: "border .24s ease-in-out"
  },
  activeStyle: {
    borderColor: "#2196f3"
  },
  acceptStyle: {
    borderColor: "#00e676"
  },
  rejectStyle: {
    borderColor: "#ff1744"
  },
};

GaConnectionForm.defaultProps = {
  editConnection: null,
  addError: null,
  testResult: null,
};

GaConnectionForm.propTypes = {
  onComplete: PropTypes.func.isRequired,
  onTest: PropTypes.func.isRequired,
  projectId: PropTypes.string.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
  testResult: PropTypes.object,
};

export default GaConnectionForm;
