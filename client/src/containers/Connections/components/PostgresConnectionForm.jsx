import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import {
  Button,
  Input,
  Link,
  Chip,
  Tabs,
  Separator,
  Switch,
  Select,
  Alert,
  Label,
  ListBox,
  TextField,
  Description,
  FieldError,
} from "@heroui/react";
import AceEditor from "../../../components/CodeEditor";
import { useDispatch, useSelector } from "react-redux";
import { LuCircleCheck, LuChevronRight, LuExternalLink, LuUpload } from "react-icons/lu";

import Container from "../../../components/Container";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import { useTheme } from "../../../modules/ThemeContext";
import { testRequest, testRequestWithFiles } from "../../../slices/connection";
import { selectTeam } from "../../../slices/team";

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
  const [connection, setConnection] = useState({ type: "postgres", subType: "postgres" });
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
  const [sshFiles, setSshFiles] = useState({
    sshPrivateKey: null,
  });
  const [sshFilesErrors, setSshFilesErrors] = useState({
    sshPrivateKey: null,
  });

  const { isDark } = useTheme();
  const dispatch = useDispatch();
  const team = useSelector(selectTeam);
  const initRef = useRef(false);

  useEffect(() => {
    if (editConnection?.id && !initRef.current) {
      initRef.current = true;
      _init();
    }
  }, [editConnection]);

  useEffect(() => {
    if (connection.subType !== subType && !editConnection) {
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
    
    const files = {
      ...sslCerts
    };
    
    if (data.useSsh && sshFiles.sshPrivateKey) {
      files.sshPrivateKey = sshFiles.sshPrivateKey;
    }
    
    if ((data.ssl && sslCerts.sslCa) || (data.useSsh && sshFiles.sshPrivateKey)) {
      response = await dispatch(testRequestWithFiles({
        team_id: team.id,
        connection: data,
        files
      }));
    } else {
      response = await dispatch(testRequest({ team_id: team.id, connection: data }));
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
    
    // Validate SSH tunnel settings if enabled
    if (connection.useSsh) {
      if (!connection.sshHost) {
        setTimeout(() => {
          setErrors({ ...errors, sshHost: "Please enter the SSH host" });
        }, 100);
        return;
      }
      if (!connection.sshUsername) {
        setTimeout(() => {
          setErrors({ ...errors, sshUsername: "Please enter the SSH username" });
        }, 100);
        return;
      }
      if (!connection.sshPassword && !sshFiles.sshPrivateKey) {
        setTimeout(() => {
          setErrors({ ...errors, sshPassword: "Please provide either a password or a private key" });
        }, 100);
        return;
      }
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
        
        const files = {
          ...sslCerts
        };
        
        if (connection.useSsh && sshFiles.sshPrivateKey) {
          files.sshPrivateKey = sshFiles.sshPrivateKey;
        }
        
        onComplete(newConnection, files)
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
  
  const _selectSshPrivateKey = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Reset errors
    setSshFilesErrors({ ...sshFilesErrors, sshPrivateKey: null });
    
    // Validate file size (32KB max for SSH keys)
    if (file.size > 32768) {
      setSshFilesErrors({ ...sshFilesErrors, sshPrivateKey: "File size is too large. Max size is 32KB" });
      return;
    }
    
    setSshFiles({ ...sshFiles, sshPrivateKey: file });
  };

  const _onChangeSSL = (checked) => {
    if (checked && !connection.sslMode) {
      setConnection({ ...connection, ssl: checked, sslMode: "require" });
    } else {
      setConnection({ ...connection, ssl: checked });
    }
  };

  return (
    <div className="p-4 bg-surface border border-solid border-divider rounded-3xl">
      <div>
        <p className="font-bold">
          {!editConnection && "Add a new connection"}
          {editConnection && `Edit ${editConnection.name}`}
        </p>
        <div className="h-4" />
        <Tabs
          aria-label="Connection options"
          selectedKey={formStyle}
          onSelectionChange={(selected) => setFormStyle(selected)}
          className="max-w-lg"
        >
          <Tabs.ListContainer>
            <Tabs.List>
              <Tabs.Tab id="string">
                <Tabs.Indicator />
                Connection string
              </Tabs.Tab>
              <Tabs.Tab id="form">
                <Tabs.Indicator />
                Connection form
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <div className="h-4" />

        {formStyle === "string" && (
          <>
            <Row align="center">
              <TextField fullWidth name="pg-string-name" isInvalid={Boolean(errors.name)}>
                <Label>Name your connection</Label>
                <Input
                  placeholder="Enter a name that you can recognise later"
                  value={connection.name || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, name: e.target.value });
                  }}
                  variant="secondary"
                />
                {errors.name ? <FieldError>{errors.name}</FieldError> : null}
              </TextField>
            </Row>
            <div className="h-4" />
            <Row align="center">
              <TextField fullWidth name="pg-string-uri" isInvalid={Boolean(errors.connectionString)}>
                <Label>Enter your Postgres connection string</Label>
                <Input
                  placeholder={formStrings[subType]?.csPlaceholder || ""}
                  value={connection.connectionString || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, connectionString: e.target.value });
                  }}
                  variant="secondary"
                />
                {errors.connectionString ? (
                  <FieldError>{errors.connectionString}</FieldError>
                ) : (
                  <Description>{formStrings[subType]?.csDescription}</Description>
                )}
              </TextField>
            </Row>
            <div className="h-2" />
          </>
        )}

        {formStyle === "form" && (
          <div className="grid grid-cols-12 gap-2">
            <div className="sm:col-span-12 md:col-span-8">
              <TextField fullWidth name="pg-form-name" isInvalid={Boolean(errors.name)}>
                <Label>Name your connection</Label>
                <Input
                  placeholder="Enter a name that you can recognise later"
                  value={connection.name || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, name: e.target.value });
                  }}
                  variant="secondary"
                />
                {errors.name ? <FieldError>{errors.name}</FieldError> : null}
              </TextField>
            </div>

            <div className="sm:col-span-12 md:col-span-10">
              <TextField fullWidth name="pg-form-host" isInvalid={Boolean(errors.host)}>
                <Label>Hostname or IP address</Label>
                <Input
                  placeholder={formStrings[subType]?.hostname}
                  value={connection.host || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, host: e.target.value });
                  }}
                  variant="secondary"
                />
                {errors.host ? <FieldError>{errors.host}</FieldError> : null}
              </TextField>
            </div>
            <div className="sm:col-span-12 md:col-span-2">
              <TextField fullWidth name="pg-form-port" isInvalid={Boolean(errors.port)}>
                <Label>Port</Label>
                <Input
                  value={connection.port || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, port: e.target.value });
                  }}
                  variant="secondary"
                />
                {errors.port ? <FieldError>{errors.port}</FieldError> : null}
              </TextField>
            </div>

            <div className="sm:col-span-12 md:col-span-4">
              <TextField fullWidth name="pg-form-db" isInvalid={Boolean(errors.dbName)}>
                <Label>Database name</Label>
                <Input
                  value={connection.dbName || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, dbName: e.target.value });
                  }}
                  placeholder="Enter your database name"
                  variant="secondary"
                />
                {errors.dbName ? <FieldError>{errors.dbName}</FieldError> : null}
              </TextField>
            </div>

            <div className="sm:col-span-12 md:col-span-4">
              <TextField fullWidth name="pg-form-user" isInvalid={Boolean(errors.username)}>
                <Label>Database username</Label>
                <Input
                  value={connection.username || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, username: e.target.value });
                  }}
                  placeholder="Enter your database username"
                  variant="secondary"
                />
                {errors.username ? <FieldError>{errors.username}</FieldError> : null}
              </TextField>
            </div>

            <div className="sm:col-span-12 md:col-span-4">
              <TextField fullWidth name="pg-form-pass" isInvalid={Boolean(errors.password)}>
                <Label>Database password</Label>
                <Input
                  type="password"
                  value={connection.password || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, password: e.target.value });
                  }}
                  placeholder="Enter your database password"
                  variant="secondary"
                />
                {errors.password ? <FieldError>{errors.password}</FieldError> : null}
              </TextField>
            </div>
          </div>
        )}
        <div className="h-2" />
        <Row align="center">
          <Switch
            id="postgres-connection-ssl"
            isSelected={connection.ssl || false}
            onChange={(selected) => _onChangeSSL(selected)}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>
              <Label htmlFor="postgres-connection-ssl">{"Enable SSL"}</Label>
            </Switch.Content>
          </Switch>
        </Row>
        {connection.ssl && (
          <>
            <div className="h-4" />
            <Row align="center">
              <Select
                variant="secondary"
                value={connection.sslMode || null}
                onChange={(value) => {
                  setConnection({ ...connection, sslMode: value });
                }}
                className="w-full md:w-1/2 lg:w-1/3"
                size="sm"
                selectionMode="single"
                disallowEmptySelection
                aria-label="Select an SSL mode"
              >
                <Label>SSL Mode</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="require" textValue="Require">
                      {"Require"}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="disable" textValue="Disable">
                      {"Disable"}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="prefer" textValue="Prefer">
                      {"Prefer"}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="verify-ca" textValue="Verify CA">
                      {"Verify CA"}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="verify-full" textValue="Verify Full">
                      {"Verify Full"}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </Row>
            <div className="h-4" />
            <Row align="center">
              <input
                type="file"
                id="rootCertInput"
                style={{ display: "none" }}
                onChange={_selectRootCert}
              />
              <Button
                variant="tertiary"
                onPress={() => document.getElementById("rootCertInput").click()}
              >
                <LuUpload />
                {"Certificate authority"}
              </Button>
              <div className="w-4" />
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
            <div className="h-4" />
            <Row align="center">
              <input
                type="file"
                id="clientCertInput"
                style={{ display: "none" }}
                onChange={_selectClientCert}
              />
              <Button
                variant="tertiary"
                onPress={() => document.getElementById("clientCertInput").click()}
              >
                <LuUpload />
                {"SSL certificate"}
              </Button>
              <div className="w-4" />
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
            <div className="h-4" />
            <Row align="center">
              <input
                type="file"
                id="clientKeyInput"
                style={{ display: "none" }}
                onChange={_selectClientKey}
              />
              <Button
                variant="tertiary"
                onPress={() => document.getElementById("clientKeyInput").click()}
              >
                <LuUpload />
                {"SSL key"}
              </Button>
              <div className="w-4" />
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
            <div className="h-4" />
            <Row align="center">
              <span className="text-sm">
                {"Certificates are accepted in .crt, .pem, and .key formats"}
              </span>
            </Row>
          </>
        )}

        <div className="h-4" />
        <Row align="center">
          <Switch
            id="postgres-connection-ssh-tunnel"
            isSelected={connection.useSsh || false}
            onChange={(selected) => setConnection({ ...connection, useSsh: selected })}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>
              <Label htmlFor="postgres-connection-ssh-tunnel">
                <div className="flex items-center gap-2">
                  {"Use SSH Tunnel"}
                  <Chip variant="secondary" size="sm" className="rounded-sm">{"New!"}</Chip>
                </div>
              </Label>
            </Switch.Content>
          </Switch>
        </Row>
        {connection.useSsh && (
          <>
            <div className="h-4" />
            <div className="grid grid-cols-12 gap-2">
              <div className="sm:col-span-12 md:col-span-8">
                <TextField fullWidth name="pg-ssh-host" isInvalid={Boolean(errors.sshHost)}>
                  <Label>SSH Host</Label>
                  <Input
                    placeholder="ssh.example.com"
                    value={connection.sshHost || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, sshHost: e.target.value });
                    }}
                    variant="secondary"
                  />
                  {errors.sshHost ? <FieldError>{errors.sshHost}</FieldError> : null}
                </TextField>
              </div>
              <div className="sm:col-span-12 md:col-span-4">
                <TextField fullWidth name="pg-ssh-port">
                  <Label>SSH Port</Label>
                  <Input
                    placeholder="22"
                    value={connection.sshPort || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, sshPort: e.target.value });
                    }}
                    variant="secondary"
                  />
                </TextField>
              </div>
              <div className="sm:col-span-12 md:col-span-6">
                <TextField fullWidth name="pg-ssh-user" isInvalid={Boolean(errors.sshUsername)}>
                  <Label>SSH Username</Label>
                  <Input
                    placeholder="username"
                    value={connection.sshUsername || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, sshUsername: e.target.value });
                    }}
                    variant="secondary"
                  />
                  {errors.sshUsername ? <FieldError>{errors.sshUsername}</FieldError> : null}
                </TextField>
              </div>
              <div className="sm:col-span-12 md:col-span-6">
                <TextField fullWidth name="pg-ssh-pass" isInvalid={Boolean(errors.sshPassword)}>
                  <Label>SSH Password</Label>
                  <Input
                    type="password"
                    placeholder="Leave empty if using private key"
                    value={connection.sshPassword || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, sshPassword: e.target.value });
                    }}
                    variant="secondary"
                  />
                  {errors.sshPassword ? <FieldError>{errors.sshPassword}</FieldError> : null}
                </TextField>
              </div>
            </div>
            <div className="h-4" />
            <Row align="center">
              <input
                type="file"
                id="sshPrivateKeyInput"
                style={{ display: "none" }}
                onChange={_selectSshPrivateKey}
              />
              <Button
                variant="tertiary"
                onPress={() => document.getElementById("sshPrivateKeyInput").click()}
              >
                <LuUpload />
                {"SSH Private Key"}
              </Button>
              <div className="w-4" />
              {sshFiles.sshPrivateKey && (
                <span className="text-sm">{sshFiles.sshPrivateKey.name}</span>
              )}
              {sshFilesErrors.sshPrivateKey && (
                <span className="text-sm text-danger">
                  {sshFilesErrors.sshPrivateKey}
                </span>
              )}
              {!sshFilesErrors.sshPrivateKey && connection.sshPrivateKey && (
                <LuCircleCheck className="text-success" size={20} />
              )}
            </Row>
            <div className="h-4" />
            <Row align="center">
              <TextField className="w-full md:w-1/2" name="pg-ssh-passphrase">
                <Label>Private Key Passphrase</Label>
                <Input
                  type="password"
                  placeholder="Leave empty if not needed"
                  value={connection.sshPassphrase || ""}
                  onChange={(e) => {
                    setConnection({ ...connection, sshPassphrase: e.target.value });
                  }}
                  variant="secondary"
                />
              </TextField>
            </Row>
            <div className="h-4" />
            <div className="grid grid-cols-12 gap-2">
              <div className="sm:col-span-12 md:col-span-8">
                <TextField fullWidth name="pg-ssh-jump-host">
                  <Label>Jump Host (Bastion Server)</Label>
                  <Input
                    placeholder="bastion.example.com (optional)"
                    value={connection.sshJumpHost || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, sshJumpHost: e.target.value });
                    }}
                    variant="secondary"
                  />
                </TextField>
              </div>
              <div className="sm:col-span-12 md:col-span-4">
                <TextField fullWidth name="pg-ssh-jump-port">
                  <Label>Jump Host Port</Label>
                  <Input
                    placeholder="22"
                    value={connection.sshJumpPort || ""}
                    onChange={(e) => {
                      setConnection({ ...connection, sshJumpPort: e.target.value });
                    }}
                    variant="secondary"
                  />
                </TextField>
              </div>
            </div>
            <div className="h-4" />
            <div>
              <Alert status="accent">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Something not working?</Alert.Title>
                  <Alert.Description className="block text-sm">
                    SSH tunneling is a new feature and some things might not work as expected. If you&apos;re having trouble, please contact support.
                  </Alert.Description>
                  <div className="mt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      as={"a"}
                      href="mailto:support@chartbrew.com"
                      target="_blank"
                    >
                      {"Contact support"}
                    </Button>
                  </div>
                </Alert.Content>
              </Alert>
            </div>
          </>
        )}

        <div className="h-8" />
        <div>
          <FormGuides subType={subType} />
        </div>

        {addError && (
          <Row>
            <Container className="rounded-medium bg-red-300 p-2.5 dark:bg-red-400/80">
              <Row>
                <Text h5>{"Server error while trying to save your connection"}</Text>
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
            variant="outline"
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
          <div className="h-4" />
          <Separator />
          <div className="h-4" />
          <div>
            <Row align="center">
              <Text>
                {"Test Result "}
                <Chip
                  color={testResult.status < 400 ? "success" : "danger"}
                  variant="soft"
                  size="sm"
                >
                  {`Status code: ${testResult.status}`}
                </Chip>
              </Text>
            </Row>
            <div className="h-4" />
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
        <div className="flex items-center gap-2">
          <LuChevronRight size={14} />
          <Link
            href="https://docs.timescale.com/timescaledb/latest/how-to-guides/connecting/about-connecting/#find-connection-details-in-timescale-cloud"
            target="_blank"
            rel="noopener"
          >
            <Text>{"Find out how to get your TimescaleDB connection credentials"}</Text>
          </Link>
          <div className="w-2" />
          <LuExternalLink size={14} />
        </div>
      </>
    )
  }

  if (subType === "supabasedb") {
    return (
      <>
        <div className="flex items-center gap-2">
          <LuChevronRight size={14} />
          <Link
            target="_blank"
            rel="noopener"
            href="https://chartbrew.com/blog/connect-and-visualize-supabase-database-with-chartbrew/#create-a-read-only-user"
            className="text-foreground/70!"
          >
            {"For security reasons, connect to your Supabase database with read-only credentials"}
          </Link>
          <LuExternalLink size={14} />
        </div>
      </>
    );
  }

  if (subType === "rdsPostgres") {
    return (
      <>
        <div className="flex items-center gap-2">
          <LuChevronRight size={14} />
          <Link
            target="_blank"
            rel="noopener noreferrer"
            href="https://chartbrew.com/blog/how-to-connect-and-visualize-amazon-rds-with-chartbrew/#ensure-your-database-user-has-read-only-access-optional-but-recommended"
            className="text-foreground/70!"
          >
            {"For security reasons, connect to your PostgreSQL database with read-only credentials"}
          </Link>
          <LuExternalLink size={14} />
        </div>
        <div className="flex items-center gap-2">
          <LuChevronRight size={14} />
          <Link
            href="https://chartbrew.com/blog/how-to-connect-and-visualize-amazon-rds-with-chartbrew/#adjust-your-rds-instance-to-allow-remote-connections"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/70!"
          >
            {"Find out how to allow remote connections to your PostgreSQL database"}
          </Link>
          <LuExternalLink size={14} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <LuChevronRight size={14} />
        <div className="w-2" />
        <Link
          target="_blank"
          rel="noopener noreferrer"
          href="https://gist.github.com/oinopion/4a207726edba8b99fd0be31cb28124d0"
          className="text-foreground/70!"
        >
          {"For security reasons, connect to your PostgreSQL database with read-only credentials"}
        </Link>
        <LuExternalLink size={14} />
      </div>
      <div className="flex items-center gap-2">
        <LuChevronRight size={14} />
        <div className="w-2" />
        <Link
          href="https://coderwall.com/p/cr2a1a/allowing-remote-connections-to-your-postgresql-vps-installation"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground/70!"
        >
          {"Find out how to allow remote connections to your PostgreSQL database"}
        </Link>
        <LuExternalLink size={14} />
      </div>
    </>
  );
}

FormGuides.propTypes = {
  subType: PropTypes.string.isRequired,
};

export default PostgresConnectionForm;
