import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Link, Spacer, Chip, Accordion, AccordionItem, Select, SelectItem, Divider,
} from "@heroui/react";
import AceEditor from "react-ace";
import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";
import { LuExternalLink, LuInfo } from "react-icons/lu";
import { useDispatch } from "react-redux";
import { useParams } from "react-router";

import Container from "../../../components/Container";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import { useTheme } from "../../../modules/ThemeContext";
import { testRequest } from "../../../slices/connection";

/*
** Customer.io form uses
** connection.password = API Key
** connection.host = Customer.io region
*/
function CustomerioConnectionForm(props) {
  const {
    editConnection, onComplete, addError,
  } = props;

  const [connection, setConnection] = useState({
    type: "customerio", subType: "customerio", host: "us", optionsArray: []
  });
  const [errors, setErrors] = useState({});
  const [testLoading, setTestLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const { isDark } = useTheme();
  const dispatch = useDispatch();
  const params = useParams();
  const initRef = useRef(null);

  const regionOptions = [
    {
      key: "us", value: "us", flag: "us", text: "United States"
    },
    {
      key: "eu", value: "eu", flag: "eu", text: "Europe"
    },
  ];

  useEffect(() => {
    if (!initRef.current && editConnection?.id) {
      initRef.current = true;
      _init();
    }
  }, [editConnection]);

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

  const _init = () => {
    if (editConnection) {
      const newConnection = { ...editConnection };

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

    const newConnection = { ...connection };
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
  };

  const _getRegionText = (region) => {
    const regionOption = regionOptions.find((option) => option.value === region);
    return regionOption ? regionOption.text : "";
  };

  return (
    <div className="p-4 bg-content1 border-1 border-solid border-content3 rounded-lg">
      <div>
        <p className="font-semibold">
          {!editConnection && "Connect to Customer.io"}
          {editConnection && `Edit ${editConnection.name}`}
        </p>
        <Spacer y={4} />
        <Row align="center">
          <Input
            label="Name your connection"
            placeholder="Enter a name that you can recognise later"
            value={connection.name}
            onChange={(e) => {
              setConnection({ ...connection, name: e.target.value });
            }}
            color={errors.name ? "danger" : "default"}
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
            value={connection.password}
            onChange={(e) => {
              setConnection({ ...connection, password: e.target.value });
            }}
            color={errors.password ? "danger" : "default"}
            description={errors.password}
            variant="bordered"
            fullWidth
            className="md:w-[600px]"
          />
        </Row>
        <Spacer y={2} />
        <Row align="center">
          <Accordion variant="bordered" className={"max-w-[600px]"}>
            <AccordionItem title={<Text>How to get the API key</Text>}>
              <Row align="center">
                <Link
                  href="https://fly.customer.io/settings/api_credentials?keyType=app"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="align-middle text-primary"
                >
                  <Text className="text-primary">{"1. Create a Customer.io App API Key "}</Text>
                  <Spacer x={1} />
                  <LuExternalLink size={14} />
                </Link>
              </Row>
              <Spacer y={2} />
              <Row>
                <Text>{"2. (Optional) Add your server's IP address to the allowlist"}</Text>
              </Row>
              <Spacer y={2} />
              <Row>
                <Text>{"3. Copy and paste the API Key here"}</Text>
              </Row>
            </AccordionItem>
          </Accordion>
        </Row>
        <Spacer y={4} />
        <Row align="flex-start" className={"max-w-[600px] items-center"}>
          <Select
            variant="bordered"
            label="Where is your Customer.io data located?"
            value={_getRegionText(connection.host)}
            selectedKeys={[connection.host]}
            selectionMode="single"
            onSelectionChange={(keys) => setConnection({ ...connection, host: keys.currentKey })}
            renderValue={(items) => (
              <div className="flex items-center gap-1">
                <span>{regionOptions.find((r) => r.key === items[0].key).flag === "eu" ? "🇪🇺" : "🇺🇸"}</span>
                <span>{items[0].textValue}</span>
              </div>
            )}
            aria-label="Select a region"
          >
            {regionOptions.map((option) => (
              <SelectItem key={option.value} startContent={option.flag === "eu" ? "🇪🇺" : "🇺🇸"} textValue={option.text}>
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
            <LuInfo />
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
          </div>
        </>
      )}
    </div>
  );
}

CustomerioConnectionForm.defaultProps = {
  editConnection: null,
  addError: null,
};

CustomerioConnectionForm.propTypes = {
  onComplete: PropTypes.func.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
};

export default CustomerioConnectionForm;
