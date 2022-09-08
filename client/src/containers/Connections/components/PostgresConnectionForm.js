import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Container, Grid, Input, Link, Loading, Row, Spacer, Text, useTheme,
} from "@nextui-org/react";
import AceEditor from "react-ace";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { ChevronRight } from "react-iconly";
import { FaExternalLinkSquareAlt } from "react-icons/fa";
import Badge from "../../../components/Badge";

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
  const [formStyle, setFormStyle] = useState("string");

  const { isDark } = useTheme();

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
      >
        <Row align="center">
          <Text h3>Add a new PostgreSQL connection</Text>
        </Row>

        <Spacer y={0.5} />
        <Row align="center" style={styles.formStyle}>
          <Link
            css={{
              background: formStyle === "string" ? "$background" : "$backgroundContrast",
              p: 5,
              pr: 10,
              pl: 10,
              br: "$sm"
            }}
            onClick={() => setFormStyle("string")}
          >
            <Text>Connection string</Text>
          </Link>
          <Spacer x={0.5} />
          <Link
            css={{
              background: formStyle === "form" ? "$background" : "$backgroundContrast",
              p: 5,
              pr: 10,
              pl: 10,
              br: "$sm"
            }}
            onClick={() => setFormStyle("form")}
          >
            <Text>Connection form</Text>
          </Link>
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
                color={errors.name ? "error" : "default"}
                bordered
                fullWidth
              />
            </Row>
            {errors.name && (
              <Row css={{ p: 5 }}>
                <Text small color="error">
                  {errors.name}
                </Text>
              </Row>
            )}
            <Spacer y={0.5} />
            <Row align="center">
              <Input.Password
                label="Enter your Postgres connection string"
                placeholder="postgres://username:password@postgres.example.com:5432/dbname"
                value={connection.connectionString || ""}
                onChange={(e) => {
                  setConnection({ ...connection, connectionString: e.target.value });
                }}
                helperText={"postgres://username:password@postgres.example.com:5432/dbname"}
                bordered
                fullWidth
              />
            </Row>
            {errors.connectionString && (
              <Row css={{ p: 5 }}>
                <Text small color="error">
                  {errors.connectionString}
                </Text>
              </Row>
            )}
            <Spacer y={0.5} />
          </>
        )}

        {formStyle === "form" && (
          <Row>
            <Grid.Container gap={1.5}>
              <Grid xs={12} sm={8}>
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
                />
              </Grid>

              <Grid xs={12} sm={10} md={8}>
                <Input
                  label="Hostname or IP address"
                  placeholder="postgres.example.com"
                  value={connection.host || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, host: e.target.value });
                  }}
                  helperColor="error"
                  helperText={errors.host}
                  bordered
                  fullWidth
                />
              </Grid>
              <Grid xs={12} sm={2} md={4}>
                <Input
                  label="Port"
                  placeholder="Optional, defaults to 5432"
                  value={connection.port || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, port: e.target.value });
                  }}
                  helperColor="error"
                  helperText={errors.port}
                  bordered
                  fullWidth
                />
              </Grid>

              <Grid xs={12} sm={4} md={4}>
                <Input
                  label="Database name"
                  placeholder="Enter your database name"
                  value={connection.dbName || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, dbName: e.target.value });
                  }}
                  helperColor="error"
                  helperText={errors.dbName}
                  bordered
                  fullWidth
                />
              </Grid>

              <Grid xs={12} sm={4} md={4}>
                <Input
                  label="Database username"
                  placeholder="Username"
                  value={connection.username || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, username: e.target.value });
                  }}
                  helperColor="error"
                  helperText={errors.username}
                  bordered
                  fullWidth
                />
              </Grid>

              <Grid xs={12} sm={4} md={4}>
                <Input.Password
                  label="Database password"
                  placeholder="Database user password"
                  onChange={(e) => {
                    setConnection({ ...connection, password: e.target.value });
                  }}
                  helperColor="error"
                  helperText={errors.password}
                  bordered
                  fullWidth
                />
              </Grid>
            </Grid.Container>
          </Row>
        )}

        <Spacer y={2} />
        <Row align="center">
          <ChevronRight />
          <Spacer x={0.2} />
          <Link
            target="_blank"
            rel="noopener noreferrer"
            href="https://gist.github.com/oinopion/4a207726edba8b99fd0be31cb28124d0"
          >
            <Text>{"For security reasons, connect to your PostgreSQL database with read-only credentials"}</Text>
          </Link>
          <Spacer x={0.2} />
          <FaExternalLinkSquareAlt size={12} />
        </Row>
        <Row align="center">
          <ChevronRight />
          <Spacer x={0.2} />
          <Link
            href="https://coderwall.com/p/cr2a1a/allowing-remote-connections-to-your-postgresql-vps-installation"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Text>{"Find out how to allow remote connections to your PostgreSQL database"}</Text>
          </Link>
          <Spacer x={0.2} />
          <FaExternalLinkSquareAlt size={12} />
        </Row>

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
            disabled={testLoading}
          >
            {testLoading && <Loading type="points" color="currentColor" />}
            {!testLoading && "Test connection"}
          </Button>
          <Spacer x={0.2} />
          <Button
            disabled={loading}
            onClick={_onCreateConnection}
            auto
          >
            {loading && <Loading type="points" color="currentColor" />}
            {!loading && "Save connection"}
          </Button>
        </Row>
      </Container>

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
  helpList: {
    display: "inline-block",
  },
  saveBtn: {
    marginRight: 0,
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
