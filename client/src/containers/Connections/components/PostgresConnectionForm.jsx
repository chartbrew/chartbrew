import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Link, Spacer, Chip, Tabs, Tab, Divider, Switch, Select, SelectItem,
} from "@nextui-org/react";
import AceEditor from "react-ace";
import { RiArrowRightSLine } from "react-icons/ri";
import { useDispatch } from "react-redux";
import { useParams } from "react-router";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import Container from "../../../components/Container";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import useThemeDetector from "../../../modules/useThemeDetector";
import { LuExternalLink, LuUpload } from "react-icons/lu";
import { testRequest } from "../../../slices/connection";

/*
  A form for creating a new Postgres connection
*/
function PostgresConnectionForm(props) {
  const {
    editConnection, onComplete, addError,
  } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({ type: "postgres", subType: "postgres" });
  const [errors, setErrors] = useState({});
  const [formStyle, setFormStyle] = useState("string");
  const [testResult, setTestResult] = useState(null);
  const [sslCerts, setSslCerts] = useState({
    sslRootCert: null,
    sslClientCert: null,
    sslClientKey: null,
  });
  const [sslCertsErrors, setSslCertsErrors] = useState({
    sslRootCert: null,
    sslClientCert: null,
    sslClientKey: null,
  });

  const isDark = useThemeDetector();
  const dispatch = useDispatch();
  const params = useParams();

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

  const _onTestRequest = (data) => {
    const newTestResult = {};
    return dispatch(testRequest({ team_id: params.teamId, connection: data }))
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
    setConnection(newConnection);

    setTimeout(() => {
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

  const isValidExtension = (fileName, validExtensions = [".crt", ".key", ".pem"]) => {
    return validExtensions.some(extension => fileName.toLowerCase().endsWith(extension));
  };

  const isValidFileSize = (file, maxSizeInBytes = 8192) => { // 8KB max size
    return file.size <= maxSizeInBytes;
  };

  const _selectRootCert = (e) => {
    const file = e.target.files[0];
    if (!isValidExtension(file.name)) {
      setSslCertsErrors({ ...sslCertsErrors, sslRootCert: "Invalid file type. Try .crt or .pem" });
      return;
    }
    if (!isValidFileSize(file)) {
      setSslCertsErrors({ ...sslCertsErrors, sslRootCert: "File size is too large. Max size is 8KB" });
      return;
    }

    setSslCerts({ ...sslCerts, sslRootCert: file });
  };

  const _selectClientCert = (e) => {
    const file = e.target.files[0];
    if (!isValidExtension(file.name)) {
      setSslCertsErrors({ ...sslCertsErrors, sslClientCert: "Invalid file type. Try .crt or .pem" });
      return;
    }
    if (!isValidFileSize(file)) {
      setSslCertsErrors({ ...sslCertsErrors, sslClientCert: "File size is too large. Max size is 8KB" });
      return;
    }
    setSslCerts({ ...sslCerts, sslClientCert: file });
  };

  const _selectClientKey = (e) => {
    const file = e.target.files[0];
    if (!isValidExtension(file.name, [".key"])) {
      setSslCertsErrors({ ...sslCertsErrors, sslClientKey: "Invalid file type. Try .key" });
      return;
    }
    if (!isValidFileSize(file)) {
      setSslCertsErrors({ ...sslCertsErrors, sslClientKey: "File size is too large. Max size is 8KB" });
      return;
    }
    setSslCerts({ ...sslCerts, sslClientKey: file });
  };

  return (
    <div className="p-unit-lg bg-content1 border-1 border-solid border-content3 rounded-lg">
      <div>
        <p className="font-semibold">
          {!editConnection && "Add a new PostgreSQL connection"}
          {editConnection && `Edit ${editConnection.name}`}
        </p>
        <Spacer y={4} />
        <Row align="center">
          <Tabs
            aria-label="Connection options"
            selectedKey={formStyle}
            onSelectionChange={(selected) => setFormStyle(selected)}
          >
            <Tab key="string" value="string" title="Connection string" />
            <Tab key="form" value="form" title="Connection form" />
          </Tabs>
        </Row>
        <Spacer y={2} />

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
              <Row className={"p-5"}>
                <Text small className={"text-danger"}>
                  {errors.name}
                </Text>
              </Row>
            )}
            <Spacer y={2} />
            <Row align="center">
              <Input
                label="Enter your Postgres connection string"
                placeholder="postgres://username:password@postgres.example.com:5432/dbname"
                value={connection.connectionString || ""}
                onChange={(e) => {
                  setConnection({ ...connection, connectionString: e.target.value });
                }}
                description={"postgres://username:password@postgres.example.com:5432/dbname"}
                variant="bordered"
                fullWidth
              />
            </Row>
            {errors.connectionString && (
              <Row className={"p-5"}>
                <Text small className="text-danger">
                  {errors.connectionString}
                </Text>
              </Row>
            )}
            <Spacer y={2} />
          </>
        )}

        {formStyle === "form" && (
          <Row>
            <div className="grid grid-cols-12 gap-2">
              <div className="sm:col-span-12 md:col-span-8">
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

              <div className="sm:col-span-12 md:col-span-10">
                <Input
                  label="Hostname or IP address"
                  placeholder="postgres.example.com"
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
              <div className="sm:col-span-12 md:col-span-2">
                <Input
                  label="Port"
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

              <div className="sm:col-span-12 md:col-span-4">
                <Input
                  label="Database name"
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

              <div className="sm:col-span-12 md:col-span-4">
                <Input
                  label="Database username"
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

              <div className="sm:col-span-12 md:col-span-4">
                <Input
                  type="password"
                  label="Database password"
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
        <Spacer y={2} />
        <Row align="center">
          <Switch
            label="SSL"
            checked={connection.ssl || false}
            onChange={(e) => {
              setConnection({ ...connection, ssl: e.target.checked });
            }}
            size="sm"
          >
            {"Enable SSL"}
          </Switch>
        </Row>
        {connection.ssl && (
          <>
            <Spacer y={2} />
            <Row align="center">
              <Select
                variant="bordered"
                label="SSL Mode"
                value={connection.sslMode || "prefer"}
                onChange={(e) => {
                  setConnection({ ...connection, sslMode: e.target.value });
                }}
                className="w-full md:w-1/2 lg:w-1/3"
                size="sm"
              >
                <SelectItem value="disable">{"Disable"}</SelectItem>
                <SelectItem value="prefer">{"Prefer"}</SelectItem>
                <SelectItem value="require">{"Require"}</SelectItem>
                <SelectItem value="verify-ca">{"Verify CA"}</SelectItem>
                <SelectItem value="verify-full">{"Verify Full"}</SelectItem>
              </Select>
            </Row>
            <Spacer y={2} />
            <Row align="center">
              <input
                type="file"
                id="rootCertInput"
                style={{ display: "none" }}
                onChange={_selectRootCert}
              />
              <Button
                variant="ghost"
                startContent={<LuUpload />}
                onClick={() => document.getElementById("rootCertInput").click()}
              >
                {"SSL root certificate (.pem)"}
              </Button>
              <Spacer x={2} />
              {sslCerts.sslRootCert && (
                <span className="text-sm">{sslCerts.sslRootCert.name}</span>
              )}
              {sslCertsErrors.sslRootCert && (
                <span className="text-sm text-danger">
                  {sslCertsErrors.sslRootCert}
                </span>
              )}
            </Row>
            <Spacer y={2} />
            <Row align="center">
              <input
                type="file"
                id="clientCertInput"
                style={{ display: "none" }}
                onChange={_selectClientCert}
              />
              <Button
                variant="ghost"
                startContent={<LuUpload />}
                onClick={() => document.getElementById("clientCertInput").click()}
              >
                {"SSL client certificate (.pem)"}
              </Button>
              <Spacer x={2} />
              {sslCerts.sslRootCert && (
                <span className="text-sm">{sslCerts.sslClientCert.name}</span>
              )}
              {sslCertsErrors.sslClientCert && (
                <span className="text-sm text-danger">
                  {sslCertsErrors.sslClientCert}
                </span>
              )}
            </Row>
            <Spacer y={2} />
            <Row align="center">
              <input
                type="file"
                id="clientKeyInput"
                style={{ display: "none" }}
                onChange={_selectClientKey}
              />
              <Button
                variant="ghost"
                startContent={<LuUpload />}
                onClick={() => document.getElementById("clientKeyInput").click()}
              >
                {"SSL client key (PKCS-8/DER)"}
              </Button>
              <Spacer x={2} />
              {sslCerts.sslClientKey && (
                <span className="text-sm">{sslCerts.sslClientKey.name}</span>
              )}
              {sslCertsErrors.sslClientKey && (
                <span className="text-sm text-danger">
                  {sslCertsErrors.sslClientKey}
                </span>
              )}
            </Row>
          </>
        )}

        <Spacer y={4} />
        <Row align="center">
          <RiArrowRightSLine />
          <Spacer x={1} />
          <Link
            target="_blank"
            rel="noopener noreferrer"
            href="https://gist.github.com/oinopion/4a207726edba8b99fd0be31cb28124d0"
          >
            <Text>{"For security reasons, connect to your PostgreSQL database with read-only credentials"}</Text>
          </Link>
          <Spacer x={1} />
          <LuExternalLink size={12} />
        </Row>
        <Row align="center">
          <RiArrowRightSLine />
          <Spacer x={1} />
          <Link
            href="https://coderwall.com/p/cr2a1a/allowing-remote-connections-to-your-postgresql-vps-installation"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Text>{"Find out how to allow remote connections to your PostgreSQL database"}</Text>
          </Link>
          <Spacer x={1} />
          <LuExternalLink size={12} />
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
            color="primary"
          >
            {"Save connection"}
          </Button>
        </Row>
      </div>

      {testResult && !testLoading && (
        <>
          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />
          <div>
            <Row align="center">
              <Text>
                {"Test Result "}
                <Chip
                  type={testResult.status < 400 ? "success" : "danger"}
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
          </div>
        </>
      )}
    </div>
  );
}

PostgresConnectionForm.defaultProps = {
  onComplete: () => {},
  editConnection: null,
  addError: false,
};

PostgresConnectionForm.propTypes = {
  onComplete: PropTypes.func,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
};

export default PostgresConnectionForm;
