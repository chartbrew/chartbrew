import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Link, Chip, Accordion, ListBox, Select, Separator,
  TextField, Label, FieldError,
} from "@heroui/react";
import AceEditor from "react-ace";
import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";
import { LuExternalLink } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";

import Container from "../../../components/Container";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import { useTheme } from "../../../modules/ThemeContext";
import { testRequest } from "../../../slices/connection";
import { selectTeam } from "../../../slices/team";

/*
** Customer.io form uses
** connection.password = API Key
** connection.host = Customer.io region
*/
function CustomerioConnectionForm(props) {
  const {
    editConnection = null, onComplete, addError = false,
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
  const team = useSelector(selectTeam);
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

  return (
    <div className="p-4 bg-surface border border-divider rounded-3xl pb-10">
      <div>
        <p className="font-semibold">
          {!editConnection && "Connect to Customer.io"}
          {editConnection && `Edit ${editConnection.name}`}
        </p>
        <div className="h-4" />
        <Row align="center">
          <TextField fullWidth className="md:w-[600px]" name="customerio-name" isInvalid={Boolean(errors.name)}>
            <Label>Name your connection</Label>
            <Input
              placeholder="Enter a name that you can recognise later"
              value={connection.name}
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
          <TextField fullWidth className="md:w-[600px]" name="customerio-api-key" isInvalid={Boolean(errors.password)}>
            <Label>Your Customer.io API key</Label>
            <Input
              type="password"
              placeholder="Enter your Customer.io API key"
              value={connection.password}
              onChange={(e) => {
                setConnection({ ...connection, password: e.target.value });
              }}
              variant="secondary"
            />
            {errors.password ? <FieldError>{errors.password}</FieldError> : null}
          </TextField>
        </Row>
        <div className="h-2" />
        <Row align="center">
          <Accordion variant="surface" className="max-w-[600px] bg-surface-secondary">
            <Accordion.Item id="customerio-api-key-help" textValue="How to get the API key">
              <Accordion.Heading>
                <Accordion.Trigger>
                  <div className="text-sm font-bold">How to get the API key</div>
                  <Accordion.Indicator />
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body>
                  <Row align="center">
                    <Link
                      href="https://fly.customer.io/settings/api_credentials?keyType=app"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-accent flex items-center"
                    >
                      <div className="text-sm font-bold">{"1. Create a Customer.io App API Key "}</div>
                      <div className="w-1" />
                      <LuExternalLink size={14} />
                    </Link>
                  </Row>
                  <div className="h-2" />
                  <div className="text-sm">{"2. (Optional) Add your server's IP address to the allowlist"}</div>
                  <div className="h-2" />
                  <div className="text-sm">{"3. Copy and paste the API Key here"}</div>
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Row>
        <div className="h-4" />
        <div className="flex items-start max-w-[600px]">
          <Select
            variant="secondary"
            selectionMode="single"
            value={connection.host || null}
            onChange={(value) => setConnection({ ...connection, host: value })}
            aria-label="Select a region"
            isInvalid={Boolean(errors.host)}
          >
            <Label>Where is your Customer.io data located?</Label>
            <Select.Trigger>
              <Select.Value className="flex items-center gap-2" />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {regionOptions.map((option) => (
                  <ListBox.Item key={option.value} id={option.value} textValue={option.text}>
                    <span>{option.flag === "eu" ? "🇪🇺" : "🇺🇸"}</span>
                    <span>{option.text}</span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <div className="w-1" />
          <Link
            href="https://fly.customer.io/settings/privacy"
            target="_blank"
            rel="noopener noreferrer"
            title="Locate the region"
            className={"text-accent"}
          >
            <LuExternalLink size={16} />
          </Link>
        </div>
        {errors.host && (
          <Row className="max-w-[600px]">
            <Text className="text-sm text-danger">{errors.host}</Text>
          </Row>
        )}

        <div className="h-4" />

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

        <div className="h-4" />
        <Row>
          <Button
            variant="outline"
            auto
            onClick={() => _onCreateConnection(true)}
            isPending={testLoading}
          >
            {testLoading ? <ButtonSpinner /> : null}
            {"Test connection"}
          </Button>
          <div className="w-1" />
          <Button
            isPending={loading}
            onClick={_onCreateConnection}
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

CustomerioConnectionForm.propTypes = {
  onComplete: PropTypes.func.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.bool,
};

export default CustomerioConnectionForm;
