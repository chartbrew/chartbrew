import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Collapse, Container, Dropdown, Input, Link, Loading, Row, Spacer, Text,
  useTheme,
} from "@nextui-org/react";
import { InfoCircle } from "react-iconly";
import { FaExternalLinkSquareAlt } from "react-icons/fa";
import AceEditor from "react-ace";
import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import Badge from "../../../components/Badge";

/*
** Customer.io form uses
** connection.password = API Key
** connection.host = Customer.io region
*/
function CustomerioConnectionForm(props) {
  const {
    editConnection, onTest, projectId, onComplete, addError, testResult
  } = props;

  const [connection, setConnection] = useState({ type: "customerio", host: "us", optionsArray: [] });
  const [errors, setErrors] = useState({});
  const [testLoading, setTestLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const { isDark } = useTheme();

  const regionOptions = [
    {
      key: "us", value: "us", flag: "us", text: "United States"
    },
    {
      key: "eu", value: "eu", flag: "eu", text: "Europe"
    },
  ];

  useEffect(() => {
    _init();
  }, []);

  useEffect(() => {
    if (editConnection) {
      setConnection(editConnection);
    }
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
    if (!connection.password) {
      setTimeout(() => {
        setErrors({ ...errors, password: "Please enter the Customer.io API Key" });
      }, 100);
      return;
    }
    if (!connection.host) {
      setTimeout(() => {
        setErrors({ ...errors, host: "Please select a region" });
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

  const _getRegionText = (region) => {
    const regionOption = regionOptions.find((option) => option.value === region);
    return regionOption ? regionOption.text : "";
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
            {!editConnection && "Connect to Customer.io"}
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
        <Spacer y={1} />
        <Row align="center">
          <Input.Password
            label="Your Customer.io API key"
            placeholder="Enter your Customer.io API key"
            value={connection.password || ""}
            onChange={(e) => {
              setConnection({ ...connection, password: e.target.value });
            }}
            helperColor="error"
            helperText={errors.password}
            bordered
            fullWidth
            css={{ "@md": { width: "600px" } }}
          />
        </Row>
        <Spacer y={1} />
        <Row align="center">
          <Collapse.Group bordered css={{ maxWidth: 600 }}>
            <Collapse title={<Text b>How to get the API key</Text>}>
              <Container>
                <Row align="center">
                  <Link
                    href="https://fly.customer.io/settings/api_credentials?keyType=app"
                    target="_blank"
                    rel="noreferrer noopener"
                    css={{ ai: "center", color: "$primary" }}
                  >
                    <Text b color="primary">{"1. Create a Customer.io App API Key "}</Text>
                    <Spacer x={0.2} />
                    <FaExternalLinkSquareAlt size={14} />
                  </Link>
                </Row>
                <Spacer y={0.5} />
                <Row>
                  <Text b>{"2. (Optional) Add your server's IP address to the allowlist"}</Text>
                </Row>
                <Spacer y={0.5} />
                <Row>
                  <Text b>{"3. Copy and paste the API Key here"}</Text>
                </Row>
              </Container>
            </Collapse>
          </Collapse.Group>
        </Row>
        <Spacer y={1} />
        <Row align="flex-start">
          <Dropdown>
            <Dropdown.Trigger>
              <Input
                label="Where is your Customer.io data located?"
                initialValue="us"
                value={_getRegionText(connection.host)}
              />
            </Dropdown.Trigger>
            <Dropdown.Menu
              onAction={(key) => setConnection({ ...connection, host: key })}
              selectedKeys={[connection.host]}
              selectionMode="single"
            >
              {regionOptions.map((option) => (
                <Dropdown.Item key={option.value}>
                  {option.text}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
          <Spacer x={0.5} />
          <Link href="https://fly.customer.io/settings/privacy" target="_blank" rel="noopener noreferrer" title="Locate the region" css={{ color: "$primary" }}>
            <InfoCircle />
          </Link>
        </Row>

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
  saveBtn: {
    marginRight: 0,
  },
};

CustomerioConnectionForm.defaultProps = {
  editConnection: null,
  addError: null,
  testResult: null,
};

CustomerioConnectionForm.propTypes = {
  onComplete: PropTypes.func.isRequired,
  onTest: PropTypes.func.isRequired,
  projectId: PropTypes.string.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
  testResult: PropTypes.object,
};

export default CustomerioConnectionForm;
