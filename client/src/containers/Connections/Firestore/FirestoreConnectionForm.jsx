import React, {
  useState, useEffect, useCallback, useMemo
} from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Link, Chip, Accordion, Separator,
} from "@heroui/react";
import AceEditor from "react-ace";
import { useDropzone } from "react-dropzone";
import { useDispatch, useSelector } from "react-redux";
import { LuExternalLink, LuFileCode2 } from "react-icons/lu";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { blue } from "../../../config/colors";
import Container from "../../../components/Container";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import { useTheme } from "../../../modules/ThemeContext";
import { semanticColors } from "../../../lib/themeTokens";
import { testRequest } from "../../../slices/connection";
import { selectTeam } from "../../../slices/team";

/*
  The Form used to create Firestore connections
*/
function FirestoreConnectionForm(props) {
  const {
    editConnection = null, onComplete = () => {}, addError = false,
  } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({
    type: "firestore", subType: "firestore", optionsArray: [], firebaseServiceAccount: ""
  });
  const [errors, setErrors] = useState({});
  const [jsonVisible, setJsonVisible] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const { isDark } = useTheme();
  const dispatch = useDispatch();
  const team = useSelector(selectTeam);

  useEffect(() => {
    _init();
  }, []);

  useEffect(() => {
    if (connection && connection.firebaseServiceAccount) {
      setJsonVisible(true);
    }
  }, [connection]);

  const baseStyle = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px",
    borderWidth: 2,
    borderRadius: 2,
    borderColor: semanticColors[isDark ? "dark" : "light"].content3.DEFAULT,
    borderStyle: "dashed",
    backgroundColor: semanticColors[isDark ? "dark" : "light"].content2.DEFAULT,
    color: blue,
    outline: "none",
    transition: "border .24s ease-in-out"
  };

  const activeStyle = {
    borderColor: "#2196f3"
  };

  const acceptStyle = {
    borderColor: "#00e676"
  };

  const rejectStyle = {
    borderColor: "#ff1744"
  };

  function StyledDropzone() {
    const onDrop = useCallback((acceptedFiles) => {
      const reader = new FileReader();
      reader.readAsText(acceptedFiles[0]);
      reader.onload = () => {
        let jsonData = reader.result;
        jsonData = JSON.stringify(JSON.parse(reader.result), null, 4);
        setConnection({ ...connection, firebaseServiceAccount: jsonData });
      };
    }, []);

    const {
      getRootProps,
      getInputProps,
      isDragActive,
      isDragAccept,
      isDragReject
    } = useDropzone({ accept: "application/json", onDrop });

    const style = useMemo(() => ({
      ...baseStyle,
      ...(isDragActive ? activeStyle : {}),
      ...(isDragAccept ? acceptStyle : {}),
      ...(isDragReject ? rejectStyle : {})
    }), [
      isDragActive,
      isDragReject,
      isDragAccept
    ]);

    return (
      <div style={{ cursor: "pointer" }}>
        <div {...getRootProps({ style })}>
          <input {...getInputProps()} />
          <a className={"text-accent flex items-center"}>
            <LuFileCode2 size={24} />
            <div className="w-4" />
            {" Drag and drop your JSON authentication file here"}
          </a>
        </div>
      </div>
    );
  }

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
      newConnection.firebaseServiceAccount = JSON.stringify(
        _getFirebaseAuth(newConnection), null, 4
      );
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

    setTimeout(() => {
      const newConnection = connection;
      if (test === true) {
        setTestLoading(true);
        _onTestRequest(newConnection)
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
    if (!firebaseServiceAccount) return "";
    try {
      return JSON.parse(data.firebaseServiceAccount);
    } catch (e) {
      return data.firebaseServiceAccount || "";
    }
  };

  return (
    <div className="p-4 bg-content1 shadow-md border-1 border-solid border-content3 rounded-lg">
      <div>
        <p className="font-semibold">
          {!editConnection && "Connect to Firestore"}
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
            isInvalid={!!errors.name}
            errorMessage={errors.name || undefined}
            variant="secondary"
            fullWidth
          />
        </Row>
        <div className="h-8" />

        <Row align="center">
          <StyledDropzone />
        </Row>

        <div className="h-8" />

        {!jsonVisible && (
          <Row>
            <Button
              onPress={() => setJsonVisible(true)}
              size="sm"
              variant="tertiary"
            >
              Click here to copy the JSON manually
            </Button>
          </Row>
        )}

        {jsonVisible && (
          <>
            <Row>
              <Text>Add your Service Account details here</Text>
            </Row>
            <Row justify="flex-start" className={"max-w-[600px]"}>
              <Container className={"p-0"}>
                <AceEditor
                  mode="json"
                  theme={isDark ? "one_dark" : "tomorrow"}
                  style={{ borderRadius: 10 }}
                  height="250px"
                  width="none"
                  value={connection.firebaseServiceAccount || ""}
                  name="queryEditor"
                  onChange={(value) => {
                    setConnection({ ...connection, firebaseServiceAccount: value });
                  }}
                  editorProps={{ $blockScrolling: true }}
                />
              </Container>
            </Row>
          </>
        )}

        <div className="h-8" />
        <Row align="center">
          <Accordion variant="surface" className="max-w-[600px]">
            <Accordion.Item id="firestore-auth-help" textValue="How to authenticate">
              <Accordion.Heading>
                <Accordion.Trigger>
                  <span className="flex-1 text-start">
                    <Text b>How to authenticate</Text>
                  </span>
                  <Accordion.Indicator />
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body>
              <Row align="center">
                <Link
                  href="https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk?authuser=0"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="align-middle text-accent"
                >
                  <Text b className={"text-accent"}>{"1. Create a Firebase Service Account "}</Text>
                  <div className="w-2" />
                  <LuExternalLink size={18} />
                </Link>
              </Row>
              <Row align="center">
                <Text>{"Log in with your Google account and select the project you want to connect to."}</Text>
              </Row>
              <div className="h-4" />
              <Row>
                <Text b>{"2. Once authenticated, press on 'Generate new private key'"}</Text>
              </Row>
              <Row>
                <Text>{"This will start a download with a JSON file on your computer."}</Text>
              </Row>
              <div className="h-4" />
              <Row>
                <Text b>{"3. Drag and drop the file below or copy the contents in the text editor."}</Text>
              </Row>
              <Row>
                <Text>{"The JSON file contains authentication details that Chartbrew needs in order to connect to your Firebase."}</Text>
              </Row>
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Row>
        <div className="h-8" />

        {addError && (
          <Row>
            <Container className={"bg-red-100 p-10 rounded-md"}>
              <Row>
                <Text b>{"Server error while trying to save your connection"}</Text>
              </Row>
              <Row>
                <Text>Please try adding your connection again.</Text>
              </Row>
            </Container>
          </Row>
        )}

        <div className="h-8" />
        <Row>
          <Button
            variant="ghost"
            onPress={() => _onCreateConnection(true)}
            isPending={testLoading}
          >
            {testLoading ? <ButtonSpinner /> : null}
            {"Test connection"}
          </Button>
          <div className="w-2" />
          <Button
            isPending={loading}
            onPress={_onCreateConnection}
            variant="primary"
          >
            {loading ? <ButtonSpinner /> : null}
            {"Save connection"}
          </Button>
        </Row>
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
              </Text>
              <Chip color={testResult.status < 400 ? "success" : "danger"} variant="soft" size="sm">
                {`Status code: ${testResult.status}`}
              </Chip>
            </Row>
            <div className="h-2" />
            <AceEditor
              mode="json"
              theme={isDark ? "one_dark" : "tomorrow"}
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

FirestoreConnectionForm.propTypes = {
  onComplete: PropTypes.func.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
};

export default FirestoreConnectionForm;
