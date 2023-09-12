import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Link, Spacer, Chip, Tabs, Tab
} from "@nextui-org/react";
import AceEditor from "react-ace";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { ChevronRight } from "react-iconly";
import { FaExternalLinkSquareAlt } from "react-icons/fa";
import HelpBanner from "../../../components/HelpBanner";
import connectionImages from "../../../config/connectionImages";
import Container from "../../../components/Container";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import useThemeDetector from "../../../modules/useThemeDetector";

/*
  A form for creating a new Timescale connection
*/
function TimescaleConnectionForm(props) {
  const {
    editConnection, projectId, onComplete, addError, onTest, testResult,
  } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({ type: "postgres", subType: "timescaledb" });
  const [errors, setErrors] = useState({});
  const [formStyle, setFormStyle] = useState("string");

  const isDark = useThemeDetector();

  useEffect(() => {
    _init();
  }, []);

  const _init = () => {
    if (editConnection) {
      const newConnection = editConnection;

      if (!newConnection.connectionString && newConnection.host) {
        setFormStyle("form");
      }

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
    if (formStyle === "form" && !connection.host) {
      setTimeout(() => {
        setErrors({ ...errors, host: "Please enter a host name or IP address for your database" });
      }, 100);
      return;
    }
    if (formStyle === "string" && !connection.connectionString) {
      setTimeout(() => {
        setErrors({ ...errors, connectionString: "Please enter a connection string first" });
      }, 100);
      return;
    }

    const newConnection = connection;
    // Clean the connection string if the form style is Form
    if (formStyle === "form") {
      newConnection.connectionString = "";
    }

    // add the project ID
    newConnection.project_id = projectId;
    setConnection(newConnection);

    setTimeout(() => {
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

  return (
    <div style={styles.container}>
      <Container
        className={"bg-content2 rounded-md"}
        size="md"
      >
        <Row align="center">
          <Text size="h3">Add a new Timescale connection</Text>
        </Row>
        <Spacer y={1} />
        <Row>
          <HelpBanner
            title="How to connect and visualize TimescaleDB data with Chartbrew"
            description="Chartbrew can connect to your TimescaleDB database and create charts that tell you more about your data."
            url={"https://chartbrew.com/blog/connect-and-visualize-timescaledb-data-with-chartbrew/"}
            imageUrl={connectionImages(isDark).timescaledb}
            info="6 min read"
          />
        </Row>
        <Spacer y={1} />
        <Row align="center" style={styles.formStyle}>
          <Tabs
            aria-label="Connection options"
            selectedKey={formStyle}
            onSelectionChange={(selected) => setFormStyle(selected)}
          >
            <Tab key="string" value="string" title="Connection string" />
            <Tab key="form" value="form" label="Connection form" />
          </Tabs>
        </Row>

        {formStyle === "string" && (
          <>
            <Row align="center">
              <Input
                label="Name your connection"
                placeholder="Enter a name that you can recognise later"
                value={connection.name || ""}
                onChange={(e) => {
                  setConnection({ ...connection, name: e.target.value });
                }}
                color={errors.name ? "danger" : "default"}
                variant="bordered"
                fullWidth
              />
            </Row>
            {errors.name && (
              <Row className="p-5">
                <Text small color="danger">
                  {errors.name}
                </Text>
              </Row>
            )}
            <Spacer y={1} />
            <Row align="center">
              <Input
                type="password"
                label="Enter your TimescaleDB connection string"
                placeholder="postgres://username:password@helpful.example.tsdb.cloud.timescale.com:35646/dbname"
                value={connection.connectionString || ""}
                onChange={(e) => {
                  setConnection({ ...connection, connectionString: e.target.value });
                }}
                description={"postgres://username:password@helpful.example.tsdb.cloud.timescale.com:35646/dbname"}
                variant="bordered"
                fullWidth
              />
            </Row>
            {errors.connectionString && (
              <Row className="p-5">
                <Text small color="danger">
                  {errors.connectionString}
                </Text>
              </Row>
            )}
            <Spacer y={1} />
          </>
        )}

        {formStyle === "form" && (
          <Row>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-12 md:col-span-8 lg:col-span-8 xl:col-span-8">
                <Input
                  label="Name your connection"
                  placeholder="Enter a name that you can recognise later"
                  value={connection.name || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, name: e.target.value });
                  }}
                  color={errors.name ? "danger" : "default"}
                  description={errors.name}
                  variant="bordered"
                  fullWidth
                />
              </div>

              <div className="col-span-12 sm:col-span-12 md:col-span-10 lg:col-span-8 xl:col-span-8">
                <Input
                  label="Hostname or IP address"
                  placeholder="helpful.example.tsdb.cloud.timescale.com"
                  value={connection.host || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, host: e.target.value });
                  }}
                  color={errors.host ? "danger" : "default"}
                  description={errors.host}
                  variant="bordered"
                  fullWidth
                />
              </div>
              
              <div className="col-span-12 sm:col-span-12 md:col-span-2 lg:col-span-2 xl:col-span-2">
                <Input
                  label="Port"
                  placeholder="Optional, defaults to 5432"
                  value={connection.port || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, port: e.target.value });
                  }}
                  color={errors.port ? "danger" : "default"}
                  description={errors.port}
                  variant="bordered"
                  fullWidth
                />
              </div>

              <div className="col-span-12 sm:col-span-12 md:col-span-4 lg:col-span-4 xl:col-span-4">
                <Input
                  label="Database name"
                  placeholder="Enter your database name"
                  value={connection.dbName || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, dbName: e.target.value });
                  }}
                  color={errors.dbName ? "danger" : "default"}
                  description={errors.dbName}
                  variant="bordered"
                  fullWidth
                />
              </div>

              <div className="col-span-12 sm:col-span-12 md:col-span-4 lg:col-span-4 xl:col-span-4">
                <Input
                  label="Database username"
                  placeholder="Username"
                  value={connection.username || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, username: e.target.value });
                  }}
                  color={errors.username ? "danger" : "default"}
                  description={errors.username}
                  variant="bordered"
                  fullWidth
                />
              </div>

              <div className="col-span-12 sm:col-span-12 md:col-span-4 lg:col-span-4 xl:col-span-4">
                <Input
                  label="Database password"
                  placeholder="Database user password"
                  onChange={(e) => {
                    setConnection({ ...connection, password: e.target.value });
                  }}
                  color={errors.password ? "danger" : "default"}
                  description={errors.password}
                  variant="bordered"
                  fullWidth
                />
              </div>
            </div>
          </Row>
        )}

        <Spacer y={1} />
        <Row align="center">
          <ChevronRight set="light" />
          <Spacer x={1} />
          <Link
            href="https://docs.timescale.com/timescaledb/latest/how-to-guides/connecting/about-connecting/#find-connection-details-in-timescale-cloud"
            target="_blank"
            rel="noopener"
          >
            <Text>{"Find out how to get your TimescaleDB connection credentials"}</Text>
          </Link>
          <Spacer x={1} />
          <FaExternalLinkSquareAlt size={12} />
        </Row>

        {addError && (
          <Row>
            <Container className={"bg-danger-100 rounded-md p-10"}>
              <Row>
                <Text h5>{"Server error while trying to save your connection"}</Text>
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
        <>
          <Spacer y={2} />
          <Container className={"bg-danger-100 rounded-md p-20"}>
            <Row align="center">
              <Text b>Test underway...</Text>
            </Row>
            <Spacer y={4} />
          </Container>
        </>
      )}

      {testResult && !testLoading && (
        <Container
          className="bg-content2 rounded-md mt-20"
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
          <Spacer y={2} />
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
  helpList: {
    display: "inline-block",
  },
  saveBtn: {
    marginRight: 0,
  },
};

TimescaleConnectionForm.defaultProps = {
  onComplete: () => {},
  onTest: () => {},
  editConnection: null,
  addError: false,
  testResult: null,
};

TimescaleConnectionForm.propTypes = {
  onComplete: PropTypes.func,
  onTest: PropTypes.func,
  projectId: PropTypes.string.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
  testResult: PropTypes.object,
};

export default TimescaleConnectionForm;
