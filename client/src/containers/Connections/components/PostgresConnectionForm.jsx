import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Link, Spacer, Chip, Tabs, Tab, Divider, Switch, Select, SelectItem,
} from "@heroui/react";
import AceEditor from "react-ace";
import { useDispatch } from "react-redux";
import { useParams } from "react-router";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import Container from "../../../components/Container";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import { useTheme } from "../../../modules/ThemeContext";
import { LuCircleCheck, LuChevronRight, LuExternalLink, LuUpload } from "react-icons/lu";
import { testRequest, testRequestWithFiles } from "../../../slices/connection";

const formStrings = {
  postgres: {
    csPlaceholder: "postgres://username:password@postgres.example.com:5432/dbname",
    csDescription: "postgres://username:password@postgres.example.com:5432/dbname",
    hostname: "postgres.example.com",
  },
  timescaledb: {
    csPlaceholder: "postgres://username:password@helpful.example.tsdb.cloud.timescale.com:35646/dbname",
    csDescription: "postgres://username:password@helpful.example.tsdb.cloud.timescale.com:35646/dbname",
    hostname: "helpful.example.tsdb.cloud.timescale.com",
  },
  supabasedb: {
    csPlaceholder: "postgres://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-[REGION].pooler.supabase.com:5432/postgres",
    csDescription: "postgres://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-[REGION].pooler.supabase.com:5432/postgres",
    hostname: "aws-[REGION].pooler.supabase.com",
  },
  rdsPostgres: {
    csPlaceholder: "postgres://[USERNAME]:[PASSWORD]@[HOSTNAME]:[PORT]/[DB_NAME]",
    csDescription: "postgres://[USERNAME]:[PASSWORD]@[HOSTNAME]:[PORT]/[DB_NAME]",
    hostname: "example-database.ref.region.rds.amazonaws.com",
  },
};

/*
  A form for creating a new Postgres connection
*/
function PostgresConnectionForm(props) {
  const {
    editConnection, onComplete, addError, subType,
  } = props;

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connection, setConnection] = useState({ type: "postgres" });
  const [errors, setErrors] = useState({});
  const [formStyle, setFormStyle] = useState("string");
  const [testResult, setTestResult] = useState(null);
  const [sslCerts, setSslCerts] = useState({
    sslCa: null,
    sslCert: null,
    sslKey: null,
  });
  const [sslCertsErrors, setSslCertsErrors] = useState({
    sslCa: null,
    sslCert: null,
    sslKey: null,
  });

  const { isDark } = useTheme();
  const dispatch = useDispatch();
  const params = useParams();

  useEffect(() => {
    _init();
  }, []);

  useEffect(() => {
    if (connection.subType !== subType) {
      setConnection({ ...connection, subType });
    }
  }, [subType]);

  const _init = () => {
    if (editConnection) {
      const newConnection = editConnection;

      if (!newConnection.connectionString && newConnection.host) {
        setFormStyle("form");
      }

      setConnection(newConnection);
    }
  };

  const _onTestRequest = async (data) => {
    const newTestResult = {};
    let response;
    
    if (data.ssl && sslCerts.sslCa) {
      response = await dispatch(testRequestWithFiles({
        team_id: params.teamId,
        connection: data,
        files: sslCerts
      }));
    } else {
      response = await dispatch(testRequest({ team_id: params.teamId, connection: data }));
    }
    
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
        onComplete(newConnection, sslCerts)
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
      setSslCertsErrors({ ...sslCertsErrors, sslCa: "Invalid file type. Try .crt or .pem" });
      return;
    }
    if (!isValidFileSize(file)) {
      setSslCertsErrors({ ...sslCertsErrors, sslCa: "File size is too large. Max size is 8KB" });
      return;
    }

    setSslCerts({ ...sslCerts, sslCa: file });
  };

  const _selectClientCert = (e) => {
    const file = e.target.files[0];
    if (!isValidExtension(file.name)) {
      setSslCertsErrors({ ...sslCertsErrors, sslCert: "Invalid file type. Try .crt or .pem" });
      return;
    }
    if (!isValidFileSize(file)) {
      setSslCertsErrors({ ...sslCertsErrors, sslCert: "File size is too large. Max size is 8KB" });
      return;
    }
    setSslCerts({ ...sslCerts, sslCert: file });
  };

  const _selectClientKey = (e) => {
    const file = e.target.files[0];
    if (!isValidExtension(file.name)) {
      setSslCertsErrors({ ...sslCertsErrors, sslKey: "Invalid file type. Try .key" });
      return;
    }
    if (!isValidFileSize(file)) {
      setSslCertsErrors({ ...sslCertsErrors, sslKey: "File size is too large. Max size is 8KB" });
      return;
    }
    setSslCerts({ ...sslCerts, sslKey: file });
  };

  const _onChangeSSL = (checked) => {
    if (checked && !connection.sslMode) {
      setConnection({ ...connection, ssl: checked, sslMode: "require" });
    } else {
      setConnection({ ...connection, ssl: checked });
    }
  };

  return (
    <div className="p-4 bg-content1 border-1 border-solid border-content3 rounded-lg">
      <div>
        <p className="font-bold">
          {!editConnection && "Add a new connection"}
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
                placeholder={formStrings[subType].csPlaceholder}
                value={connection.connectionString || ""}
                onChange={(e) => {
                  setConnection({ ...connection, connectionString: e.target.value });
                }}
                description={formStrings[subType].csDescription}
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
                  placeholder={formStrings[subType].hostname}
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
            isSelected={connection.ssl || false}
            checked={connection.ssl || false}
            onChange={(e) => _onChangeSSL(e.target.checked)}
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
                selectedKeys={[connection.sslMode]}
                onSelectionChange={(keys) => {
                  setConnection({ ...connection, sslMode: keys.currentKey });
                }}
                className="w-full md:w-1/2 lg:w-1/3"
                size="sm"
                selectionMode="single"
                disallowEmptySelection
                aria-label="Select an SSL mode"
              >
                <SelectItem key="require" textValue="Require">{"Require"}</SelectItem>
                <SelectItem key="disable" textValue="Disable">{"Disable"}</SelectItem>
                <SelectItem key="prefer" textValue="Prefer">{"Prefer"}</SelectItem>
                <SelectItem key="verify-ca" textValue="Verify CA">{"Verify CA"}</SelectItem>
                <SelectItem key="verify-full" textValue="Verify Full">{"Verify Full"}</SelectItem>
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
                {"Certificate authority"}
              </Button>
              <Spacer x={2} />
              {sslCerts.sslCa && (
                <span className="text-sm">{sslCerts.sslCa.name}</span>
              )}
              {sslCertsErrors.sslCa && (
                <span className="text-sm text-danger">
                  {sslCertsErrors.sslCa}
                </span>
              )}
              {!sslCertsErrors.sslCa && connection.sslCa && (
                <LuCircleCheck className="text-success" size={20} />
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
                {"SSL certificate"}
              </Button>
              <Spacer x={2} />
              {sslCerts.sslCert && (
                <span className="text-sm">{sslCerts.sslCert.name}</span>
              )}
              {sslCertsErrors.sslCert && (
                <span className="text-sm text-danger">
                  {sslCertsErrors.sslCert}
                </span>
              )}
              {!sslCertsErrors.sslCert && connection.sslCert && (
                <LuCircleCheck className="text-success" size={20} />
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
                {"SSL key"}
              </Button>
              <Spacer x={2} />
              {sslCerts.sslKey && (
                <span className="text-sm">{sslCerts.sslKey.name}</span>
              )}
              {sslCertsErrors.sslKey && (
                <span className="text-sm text-danger">
                  {sslCertsErrors.sslKey}
                </span>
              )}
              {!sslCertsErrors.sslKey && connection.sslKey && (
                <LuCircleCheck className="text-success" size={20} />
              )}
            </Row>
            <Spacer y={2} />
            <Row align="center">
              <span className="text-sm">
                {"Certificates are accepted in .crt, .pem, and .key formats"}
              </span>
            </Row>
          </>
        )}

        <Spacer y={4} />
        <div>
          <FormGuides subType={subType} />
        </div>

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
  subType: "postgres",
};

PostgresConnectionForm.propTypes = {
  onComplete: PropTypes.func,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
  subType: PropTypes.string,
};

function FormGuides({ subType }) {
  if (subType === "timescaledb") {
    return (
      <>
        <Row align="center">
          <LuChevronRight />
          <Spacer x={1} />
          <Link
            href="https://docs.timescale.com/timescaledb/latest/how-to-guides/connecting/about-connecting/#find-connection-details-in-timescale-cloud"
            target="_blank"
            rel="noopener"
          >
            <Text>{"Find out how to get your TimescaleDB connection credentials"}</Text>
          </Link>
          <Spacer x={1} />
          <LuExternalLink />
        </Row>
      </>
    )
  }

  if (subType === "supabasedb") {
    return (
      <>
        <Row align="center">
          <LuChevronRight />
          <Spacer x={1} />
          <Link
            target="_blank"
            rel="noopener"
            href="https://chartbrew.com/blog/connect-and-visualize-supabase-database-with-chartbrew/#create-a-read-only-user"
          >
            <Text>{"For security reasons, connect to your Supabase database with read-only credentials"}</Text>
          </Link>
          <Spacer x={1} />
          <LuExternalLink />
        </Row>
      </>
    );
  }

  if (subType === "rdsPostgres") {
    return (
      <>
        <Row align="center">
          <LuChevronRight />
          <Spacer x={1} />
          <Link
            target="_blank"
            rel="noopener noreferrer"
            href="https://chartbrew.com/blog/how-to-connect-and-visualize-amazon-rds-with-chartbrew/#ensure-your-database-user-has-read-only-access-optional-but-recommended"
          >
            <Text>{"For security reasons, connect to your PostgreSQL database with read-only credentials"}</Text>
          </Link>
          <Spacer x={1} />
          <LuExternalLink />
        </Row>
        <Row align="center">
          <LuChevronRight />
          <Spacer x={1} />
          <Link
            href="https://chartbrew.com/blog/how-to-connect-and-visualize-amazon-rds-with-chartbrew/#adjust-your-rds-instance-to-allow-remote-connections"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Text>{"Find out how to allow remote connections to your PostgreSQL database"}</Text>
          </Link>
          <Spacer x={1} />
          <LuExternalLink />
        </Row>
      </>
    );
  }

  return (
    <>
      <Row align="center">
        <LuChevronRight />
        <Spacer x={1} />
        <Link
          target="_blank"
          rel="noopener noreferrer"
          href="https://gist.github.com/oinopion/4a207726edba8b99fd0be31cb28124d0"
        >
          <Text>{"For security reasons, connect to your PostgreSQL database with read-only credentials"}</Text>
        </Link>
        <Spacer x={1} />
        <LuExternalLink />
      </Row>
      <Row align="center">
        <LuChevronRight />
        <Spacer x={1} />
        <Link
          href="https://coderwall.com/p/cr2a1a/allowing-remote-connections-to-your-postgresql-vps-installation"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Text>{"Find out how to allow remote connections to your PostgreSQL database"}</Text>
        </Link>
        <Spacer x={1} />
        <LuExternalLink />
      </Row>
    </>
  );
}

FormGuides.propTypes = {
  subType: PropTypes.string.isRequired,
};

export default PostgresConnectionForm;
