import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Link, Spacer, Chip, Accordion, AccordionItem, Select, SelectItem, CircularProgress,
} from "@nextui-org/react";
import { InfoCircle } from "react-iconly";
import { FaExternalLinkSquareAlt } from "react-icons/fa";
import AceEditor from "react-ace";
import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import HelpBanner from "../../../components/HelpBanner";
import connectionImages from "../../../config/connectionImages";
import Container from "../../../components/Container";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import useThemeDetector from "../../../modules/useThemeDetector";

/*
** Customer.io form uses
** connection.password = API Key
** connection.host = Customer.io region
*/
function CustomerioConnectionForm(props) {
  const {
    editConnection, onTest, projectId, onComplete, addError, testResult
  } = props;

  const [connection, setConnection] = useState({
    type: "customerio", subType: "customerio", host: "us", optionsArray: []
  });
  const [errors, setErrors] = useState({});
  const [testLoading, setTestLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const isDark = useThemeDetector();

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
        className={"bg-content2 rounded-md p-10"}
        size="md"
        justify="flex-start"
      >
        <Row align="center">
          <Text size="h3">
            {!editConnection && "Connect to Customer.io"}
            {editConnection && `Edit ${editConnection.name}`}
          </Text>
        </Row>
        <Spacer y={2} />
        <Row>
          <HelpBanner
            title="How to visualize your Customer.io data with Chartbrew"
            description="Chartbrew can now integrate with Customer.io to get data about customers and visualize it with beautiful charts and live reports."
            url={"https://chartbrew.com/blog/visualize-and-report-on-customerio-data-with-chartbrew/"}
            imageUrl={connectionImages(isDark).customerio}
            info="7 min read"
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
            variant="bordered"
            fullWidth
            className="md:w-[600px]"
          />
        </Row>
        <Spacer y={4} />
        <Row align="center">
          <Input
            type="password"
            label="Your Customer.io API key"
            placeholder="Enter your Customer.io API key"
            value={connection.password || ""}
            onChange={(e) => {
              setConnection({ ...connection, password: e.target.value });
            }}
            color={errors.password ? "danger" : "primary"}
            description={errors.password}
            variant="bordered"
            fullWidth
            className="md:w-[600px]"
          />
        </Row>
        <Spacer y={1} />
        <Row align="center">
          <Accordion variant="bordered" className={"max-w-[600px]"}>
            <AccordionItem title={<Text b>How to get the API key</Text>}>
              <Container>
                <Row align="center">
                  <Link
                    href="https://fly.customer.io/settings/api_credentials?keyType=app"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="align-middle text-primary"
                  >
                    <Text b className="text-primary">{"1. Create a Customer.io App API Key "}</Text>
                    <Spacer x={1} />
                    <FaExternalLinkSquareAlt size={14} />
                  </Link>
                </Row>
                <Spacer y={2} />
                <Row>
                  <Text b>{"2. (Optional) Add your server's IP address to the allowlist"}</Text>
                </Row>
                <Spacer y={2} />
                <Row>
                  <Text b>{"3. Copy and paste the API Key here"}</Text>
                </Row>
              </Container>
            </AccordionItem>
          </Accordion>
        </Row>
        <Spacer y={4} />
        <Row align="flex-start">
          <Select
            variant="bordered"
            label="Where is your Customer.io data located?"
            value={_getRegionText(connection.host)}
            selectedKeys={[connection.host]}
            selectionMode="single"
            onSelectionChange={(key) => setConnection({ ...connection, host: key })}
          >
            {regionOptions.map((option) => (
              <SelectItem key={option.value}>
                {option.text}
              </SelectItem>
            ))}
          </Select>
          <Spacer x={1} />
          <Link
            href="https://fly.customer.io/settings/privacy"
            target="_blank"
            rel="noopener noreferrer"
            title="Locate the region"
            className={"text-primary"}
          >
            <InfoCircle />
          </Link>
        </Row>

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
        <Container className="bg-content2 rounded-md p-20" size="md">
          <Row align="center">
            <CircularProgress aria-label="Loading" />
          </Row>
          <Spacer y={4} />
        </Container>
      )}

      {testResult && !testLoading && (
        <Container
          className={"bg-content2 rounded-md mt-20 p-20"}
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
