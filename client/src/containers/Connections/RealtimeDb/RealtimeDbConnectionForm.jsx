import React, {
  useState, useEffect, useMemo, useCallback
} from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Link, Spacer, Image, Chip, semanticColors, Accordion, AccordionItem, CircularProgress,
} from "@nextui-org/react";
import { PaperUpload } from "react-iconly";
import { FaExternalLinkSquareAlt } from "react-icons/fa";
import AceEditor from "react-ace";
import { useDropzone } from "react-dropzone";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { blue } from "../../../config/colors";
import realtimeDbImage from "../../../assets/realtime-db-url.webp";
import HelpBanner from "../../../components/HelpBanner";
import connectionImages from "../../../config/connectionImages";
import Container from "../../../components/Container";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import useThemeDetector from "../../../modules/useThemeDetector";

/*
  The Form used to create API connections
*/
function RealtimeDbConnectionForm(props) {
  const {
    editConnection, projectId, onComplete, addError, onTest, testResult,
  } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({
    type: "realtimedb", subType: "realtimedb", optionsArray: [], firebaseServiceAccount: "",
  });
  const [errors, setErrors] = useState({});
  const [jsonVisible, setJsonVisible] = useState(false);

  const isDark = useThemeDetector();

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
      <div className="container" style={{ cursor: "pointer" }}>
        <div {...getRootProps({ style })}>
          <input {...getInputProps()} />
          <Link css={{ ai: "center", color: "$primary" }}>
            <PaperUpload />
            <Spacer x={0.2} />
            {" Drag and drop your JSON authentication file here"}
          </Link>
        </div>
      </div>
    );
  }

  const _init = () => {
    if (editConnection) {
      const newConnection = editConnection;
      newConnection.firebaseServiceAccount = JSON.stringify(
        _getFirebaseAuth(newConnection), null, 4,
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
    if (!firebaseServiceAccount) return "";
    try {
      return JSON.parse(data.firebaseServiceAccount);
    } catch (e) {
      return data.firebaseServiceAccount || "";
    }
  };

  return (
    <div style={styles.container}>
      <Container
        className={"bg-content2"}
        size="md"
        justify="flex-start"
      >
        <Row align="center">
          <Text h3>
            {!editConnection && "Connect to Firebase Realtime Database"}
            {editConnection && `Edit ${editConnection.name}`}
          </Text>
        </Row>
        <Spacer y={2} />
        <Row>
          <HelpBanner
            title="How to visualize your Realtime Database data with Chartbrew"
            description="Connect to Firebase Realtime Database to create reports and visualize your data. This tutorial will show you how to connect and create your first chart.
            "
            url={"https://chartbrew.com/blog/visualize-your-firebase-realtime-database-with-chartbrew/"}
            imageUrl={connectionImages(isDark).realtimedb}
            info="5 min read"
          />
        </Row>
        <Spacer y={4} />
        <Row align="center">
          <Input
            label="Name your connection"
            placeholder="Enter a name that you can recognise later"
            value={connection.name || ""}
            onChange={(e) => {
              setConnection({ ...connection, name: e.target.value });
            }}
            color={errors.name ? "danger" : "primary"}
            description={errors.name}
            bordered
            fullWidth
          />
        </Row>
        <Spacer y={4} />
        <Row align="center">
          <Input
            label="Database URL"
            placeholder="You Realtime Database URL"
            value={connection.connectionString || ""}
            onChange={(e) => {
              setConnection({ ...connection, connectionString: e.target.value });
            }}
            color={errors.connectionString ? "danger" : "primary"}
            description={errors.connectionString}
            variant="bordered"
            fullWidth
          />
        </Row>
        <Spacer y={4} />
        <Row align="center">
          <StyledDropzone />
        </Row>
        <Spacer y={2} />

        {!jsonVisible && (
          <Row>
            <Button
              onClick={() => setJsonVisible(true)}
              size="sm"
              auto
              variant="ghost"
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
        <Spacer y={4} />

        <Row align="center">
          <Accordion variant="bordered" className="max-w-[600px]">
            <AccordionItem title={<Text b>How to authenticate</Text>}>
              <Container>
                <Row align="center">
                  <Link
                    href="https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk?authuser=0"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="align-middle text-primary"
                  >
                    <Text b className={"text-primary"}>{"1. Create a Firebase Service Account "}</Text>
                    <Spacer x={1} />
                    <FaExternalLinkSquareAlt size={14} />
                  </Link>
                </Row>
                <Row align="center">
                  <Text>{"Log in with your Google account and select the project you want to connect to."}</Text>
                </Row>
                <Spacer y={2} />
                <Row>
                  <Text b>{"2. Once authenticated, press on 'Generate new private key'"}</Text>
                </Row>
                <Row>
                  <Text>{"This will start a download with a JSON file on your computer."}</Text>
                </Row>
                <Spacer y={2} />
                <Row>
                  <Text b>{"3. Drag and drop the file below or copy the contents in the text editor."}</Text>
                </Row>
                <Row>
                  <Text>{"The JSON file contains authentication details that Chartbrew needs in order to connect to your Firebase."}</Text>
                </Row>
              </Container>
            </AccordionItem>
            <AccordionItem title={<Text b>How to get the database URL</Text>}>
              <Container>
                <Row align="center">
                  <Link
                    href="https://console.firebase.google.com/project"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="align-middle text-primary"
                  >
                    <Text b>{"1. Select your project from here "}</Text>
                    <Spacer x={1} />
                    <FaExternalLinkSquareAlt size={14} />
                  </Link>
                </Row>
                <Row align="center">
                  <Text>{"Log in with your Google account and select the project you want to connect to."}</Text>
                </Row>
                <Spacer y={2} />
                <Row>
                  <Text b>{"2. Once you select a project, navigate to 'Realtime Database'"}</Text>
                </Row>
                <Row>
                  <Text>{"You can find this option in the side menu of your Firebase dashboard."}</Text>
                </Row>
                <Spacer y={2} />
                <Row>
                  <Text b>{"3. Copy the database URL and paste it in the field above"}</Text>
                </Row>
                <Row>
                  <Text>{"You can find the URL as soon as you access the Realtime Database menu option."}</Text>
                </Row>
                <Row>
                  <Image src={realtimeDbImage} width="431" height="190" alt="Realtime database URL" />
                </Row>
              </Container>
            </AccordionItem>
          </Accordion>
        </Row>
        <Spacer y={4} />

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

        <Spacer y={4} />
        <Row>
          <Button
            variant="ghost"
            auto
            onClick={() => _onCreateConnection(true)}
            isLoading={testLoading}
          >
            {"Test connection"}
          </Button>
          <Spacer x={1} />
          <Button
            isLoading={loading}
            onClick={_onCreateConnection}
            auto
          >
            {"Save connection"}
          </Button>
        </Row>
      </Container>

      {testLoading && (
        <Container className={"bg-content2 p-20"} size="md">
          <Row align="center">
            <CircularProgress aria-label="Loading..." />
          </Row>
          <Spacer y={4} />
        </Container>
      )}

      {testResult && !testLoading && (
        <Container
          className={"bg-content2 p-20 mt-20"}
          size="md"
        >
          <Row align="center">
            <Text>
              {"Test Result "}
            </Text>
            <Chip color={testResult.status < 400 ? "success" : "danger"}>
              {`Status code: ${testResult.status}`}
            </Chip>
          </Row>
          <Spacer y={1} />
          <AceEditor
            mode="json"
            theme="tomorrow"
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
