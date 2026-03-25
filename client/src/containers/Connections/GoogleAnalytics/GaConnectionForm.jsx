import React, {
  useState, useEffect,
} from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Chip, Separator,
} from "@heroui/react";
import AceEditor from "react-ace";
import cookie from "react-cookies";
import { FaGoogle } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { LuRefreshCw } from "react-icons/lu";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { API_HOST } from "../../../config/settings";
import Container from "../../../components/Container";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import { useTheme } from "../../../modules/ThemeContext";
import { testRequest } from "../../../slices/connection";
import { selectTeam } from "../../../slices/team";

/*
  The Form used to create GA connections
*/
function GaConnectionForm(props) {
  const {
    editConnection = null, onComplete = () => {}, addError = false,
  } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({
    type: "googleAnalytics", subType: "googleAnalytics", optionsArray: [], name: "Google Analytics"
  });
  const [errors, setErrors] = useState({});
  const [testResult, setTestResult] = useState(null);

  const { isDark } = useTheme();
  const dispatch = useDispatch();
  const team = useSelector(selectTeam);

  useEffect(() => {
    _init();
  }, [editConnection]);

  const _onTestRequest = (data) => {
    const newTestResult = {};
    return dispatch(testRequest({ team_id: team?.id, connection: data }))
      .then(async (response) => {
        newTestResult.status = response.payload.status;
        newTestResult.body = await response.payload.text();

        try {
          newTestResult.body = JSON.parse(newTestResult.body);
          newTestResult.body = JSON.stringify(newTestResult, null, 2);
        } catch (e) {
          // the response is not in JSON format
        }

        setTestResult(newTestResult);
        return Promise.resolve(newTestResult);
      })
      .catch(() => { });
  };

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

    setTimeout(() => {
      const newConnection = connection;
      if (test === true) {
        setTestLoading(true);
        _onTestRequest(newConnection)
          .then(() => setTestLoading(false))
          .catch(() => setTestLoading(false));
      } else {
        setLoading(true);
        onComplete(newConnection, true)
          .then(() => {
            setLoading(false);
          })
          .catch(() => setLoading(false));
      }
    }, 100);
  };

  const _onGoogleAuth = () => {
    const url = `${API_HOST}/team/${team?.id}/connections/${connection.id}/google/auth`;
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
    <div className="p-4 bg-content1 border-1 border-solid border-content3 rounded-lg">
      <div>
        <p className="font-semibold">
          {!editConnection && "Connect to Google Analytics"}
          {editConnection && `Edit ${editConnection.name}`}
        </p>
        <div className="h-8" />
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
        <div className="h-8" />
        <Row>
          {!editConnection && (
            <Button
              color={"secondary"}
              isDisabled={!connection.name}
              isPending={loading}
              startContent={loading ? <ButtonSpinner /> : undefined}
              onClick={() => _onCreateConnection()}
            >
              {"Create connection"}
            </Button>
          )}
          {editConnection && !connection.OAuth && (
            <Button
              color={"secondary"}
              endContent={<FaGoogle size={20} />}
              onClick={_onGoogleAuth}
            >
              {"Authenticate with Google"}
            </Button>
          )}
          {editConnection && connection.OAuth && (
            <Button
              color={"secondary"}
              endContent={<LuRefreshCw />}
              onClick={_onGoogleAuth}
              size="sm"
            >
              {"Click here to re-authenticate"}
            </Button>
          )}
        </Row>
        {editConnection && connection.OAuth && (
          <>
            <div className="h-4" />
            <Row>
              <Chip variant="flat">
                {`Authenticated as ${connection.OAuth.email}`}
              </Chip>
            </Row>
          </>
        )}
        {errors.auth && (
          <Row>
            <Text className="textdanger">{errors.auth}</Text>
          </Row>
        )}
        <div className="h-8" />

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
        <div className="h-2" />
        {editConnection && (
          <Row>
            <Button
              variant="ghost"
              auto
              onClick={() => _onCreateConnection(true)}
              isDisabled={!connection.name || !connection.oauth_id}
              isPending={testLoading}
              startContent={testLoading ? <ButtonSpinner /> : undefined}
            >
              {"Test connection"}
            </Button>
            <div className="w-2" />
            <Button
              isDisabled={!connection.oauth_id}
              isPending={loading}
              onClick={_onCreateConnection}
              color="primary"
              startContent={loading ? <ButtonSpinner /> : undefined}
            >
              {"Save connection"}
            </Button>
          </Row>
        )}
      </div>

      {testResult && !testLoading && (
        <>
          <div className="h-8" />
          <Separator />
          <div className="h-8" />
          <div>
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
            <div className="h-8" />
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
          </div>
        </>
      )}
    </div>
  );
}

GaConnectionForm.propTypes = {
  onComplete: PropTypes.func.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
};

export default GaConnectionForm;
