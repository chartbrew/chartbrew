import React, {
  useState, useEffect,
} from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Spacer, Chip, CircularProgress,
} from "@nextui-org/react";
import AceEditor from "react-ace";
import cookie from "react-cookies";
import { FaGoogle } from "react-icons/fa";
import { HiRefresh } from "react-icons/hi";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { API_HOST } from "../../../config/settings";
import HelpBanner from "../../../components/HelpBanner";
import connectionImages from "../../../config/connectionImages";
import Container from "../../../components/Container";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import useThemeDetector from "../../../modules/useThemeDetector";

/*
  The Form used to create GA connections
*/
function GaConnectionForm(props) {
  const {
    editConnection, projectId, onComplete, addError, onTest, testResult,
  } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({
    type: "googleAnalytics", subType: "googleAnalytics", optionsArray: [], name: "Google Analytics"
  });
  const [errors, setErrors] = useState({});

  const isDark = useThemeDetector();

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
    <div className="p-unit-lg bg-content1 shadow-md border-1 border-solid border-content3 rounded-lg">
      <div>
        <Row align="center">
          <Text size="lg">
            {!editConnection && "Connect to Google Analytics"}
            {editConnection && `Edit ${editConnection.name}`}
          </Text>
        </Row>
        <Spacer y={2} />
        <Row>
          <HelpBanner
            title="How to visualize your Google Analytics data with Chartbrew"
            description="Learn how you can power up your Chartbrew dashboards with the Google Analytics integration. Get to know your data with Chartbrew."
            url={"https://chartbrew.com/blog/integrate-google-analytics-ga4-with-your-chartbrew-dashboards/"}
            imageUrl={connectionImages(isDark).googleAnalytics}
            info="5 min read"
          />
        </Row>
        <Spacer y={8} />
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
            variant="bordered"
            fullWidth
            className="md:w-[600px]"
          />
        </Row>
        <Spacer y={4} />
        <Row>
          {!editConnection && (
            <Button
              color={"secondary"}
              isLoading={loading || !connection.name}
              onClick={_onCreateConnection}
              auto
            >
              {"Create connection"}
            </Button>
          )}
          {editConnection && !connection.OAuth && (
            <Button
              color={"secondary"}
              endContent={<FaGoogle size={20} />}
              onClick={_onGoogleAuth}
              auto
            >
              {"Authenticate with Google"}
            </Button>
          )}
          {editConnection && connection.OAuth && (
            <Button
              color={"secondary"}
              endContent={<HiRefresh size={22} />}
              onClick={_onGoogleAuth}
              auto
            >
              {"Click here to re-authenticate"}
            </Button>
          )}
        </Row>
        {editConnection && connection.OAuth && (
          <Row>
            <Text className="text-success">
              {`Authenticated as ${connection.OAuth.email}`}
            </Text>
          </Row>
        )}
        {errors.auth && (
          <Row>
            <Text className="textdanger">{errors.auth}</Text>
          </Row>
        )}
        <Spacer y={4} />

        {addError && (
          <Row>
            <Container className={"bg-danger-100 p-10"}>
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
        {editConnection && (
          <Row>
            <Button
              variant="ghost"
              auto
              onClick={() => _onCreateConnection(true)}
              disabled={!connection.name || !connection.oauth_id}
              isLoading={testLoading}
            >
              {"Test connection"}
            </Button>
            <Spacer x={1} />
            <Button
              disabled={!connection.oauth_id}
              isLoading={loading}
              onClick={_onCreateConnection}
              color="primary"
            >
              {"Save connection"}
            </Button>
          </Row>
        )}
      </div>
      <Spacer y={4} />

      {testLoading && (
        <Container className="bg-content2 rounded-md" size="md">
          <Row align="center">
            <CircularProgress aria-label="Loading" />
          </Row>
          <Spacer y={4} />
        </Container>
      )}

      {testResult && !testLoading && (
        <Container
          className={"bg-content2 rounded-md mt-20"}
          size="md"
        >
          <Row align="center">
            <Text>
              {"Test Result "}
              <Chip
                color={testResult.status < 400 ? "success" : "danger"}
              >
                {`Status code: ${testResult.status}`}
              </Chip>
            </Text>
          </Row>
          <Spacer y={4} />
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
