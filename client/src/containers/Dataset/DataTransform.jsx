import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Select,
  SelectItem,
  Switch,
  Accordion,
  AccordionItem,
} from "@heroui/react";
import AceEditor from "react-ace";
import { useTheme } from "../../modules/ThemeContext";
import { debounce } from "lodash";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

function DataTransform({ isOpen, onClose, onSave, initialTransform }) {
  const { isDark } = useTheme();
  const [transformConfig, setTransformConfig] = useState({});
  const [editorValue, setEditorValue] = useState("");

  useEffect(() => {
    if (initialTransform) {
      setTransformConfig(initialTransform);
      setEditorValue(JSON.stringify(initialTransform, null, 2));
    } else {
      const defaultConfig = {
        enabled: true,
        type: "flattenNested",
        config: {
          baseArrayPath: "",
          nestedArrayPath: "",
          outputFields: {}
        }
      };
      setTransformConfig(defaultConfig);
      setEditorValue(JSON.stringify(defaultConfig, null, 2));
    }
  }, [initialTransform]);

  const debouncedUpdateConfig = debounce((value) => {
    try {
      const parsed = JSON.parse(value);
      setTransformConfig(parsed);
    } catch (e) {
      // Invalid JSON, ignore
    }
  }, 500);

  const handleEditorChange = (value) => {
    setEditorValue(value);
    debouncedUpdateConfig(value);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="text-lg">Transform data</div>
          <div className="text-sm text-default-500">
            {"Configure the transformation to apply to the data after it's fetched from the connection."}
          </div>
        </ModalHeader>
        <ModalBody>
          <Select
            label="Transformation type"
            placeholder="Select a transformation type"
            onSelectionChange={(keys) => {
              const type = keys.currentKey;
              const newConfig = {
                enabled: true,
                type,
                config: type === "flattenNested" ? {
                  baseArrayPath: "",
                  nestedArrayPath: "",
                  outputFields: {}
                } : {}
              };
              setTransformConfig(newConfig);
              setEditorValue(JSON.stringify(newConfig, null, 2));
            }}
            selectedKeys={transformConfig.type ? [transformConfig.type] : []}
            selectionMode="single"
            variant="bordered"
            disallowEmptySelection
          >
            <SelectItem key="flattenNested" textValue="Flatten nested array">
              Flatten nested array
            </SelectItem>
          </Select>

          {transformConfig.type && (
            <div className="w-full">
              <AceEditor
                mode="json"
                theme={isDark ? "one_dark" : "tomorrow"}
                style={{ borderRadius: 10 }}
                height="300px"
                width="none"
                value={editorValue}
                onChange={handleEditorChange}
                name="transformEditor"
                editorProps={{ $blockScrolling: true }}
                className="rounded-md border-1 border-solid border-content3"
              />
            </div>
          )}

          <Switch
            title="Enable transformation"
            isSelected={transformConfig.enabled}
            onValueChange={(value) => {
              setTransformConfig({ ...transformConfig, enabled: value });
              setEditorValue(JSON.stringify({ ...transformConfig, enabled: value }, null, 2));
            }}
            size="sm"
          >
            Enable transformation
          </Switch>

          {transformConfig.type === "flattenNested" && (
            <div>
              <Accordion variant="bordered">
                <AccordionItem
                  key="flatten-nested-help"
                  aria-label="How to use Flatten Nested Array"
                  title="How to use Flatten Nested Array"
                  subtitle="Learn how to configure the flatten nested array transformation"
                  variant="bordered"
                  classNames={{
                    title: "text-sm",
                    subtitle: "text-xs",
                  }}
                >
                  <div className="px-2 pb-2">
                    <p className="mb-4 text-sm">
                      The Flatten Nested Array transformation helps you combine data from two related arrays into a single, flat structure. This is useful when you have data like a list of orders, where each order contains a list of items.
                    </p>

                    <h4 className="font-semibold mb-2 text-sm">Configuration Fields:</h4>
                    <ul className="list-disc pl-6 space-y-2 text-sm">
                      <li>
                        <span className="font-medium">baseArrayPath:</span> The path to your main array (e.g., &quot;orders&quot;)
                      </li>
                      <li>
                        <span className="font-medium">nestedArrayPath:</span> The path to the nested array within each main item (e.g., &quot;items&quot;)
                      </li>
                      <li>
                        <span className="font-medium">outputFields:</span> Define how to combine the fields from both arrays
                      </li>
                    </ul>

                    <h4 className="font-semibold mt-4 mb-2 text-sm">Example:</h4>
                    <p className="mb-2 text-sm">If your data looks like this:</p>
                    <pre className="bg-default-100 p-3 rounded-md text-xs mb-4">
                      {`{
  "orders": [
    {
      "id": "123",
      "customer": "John",
      "items": [
        { "product": "Apple", "price": 1.99 },
        { "product": "Banana", "price": 0.99 }
      ]
    }
  ]
}`}
                    </pre>
                    <p className="mb-2 text-sm">You would configure it like this:</p>
                    <pre className="bg-default-100 p-3 rounded-md text-xs">
                      {`{
  "enabled": true,
  "type": "flattenNested",
  "config": {
    "baseArrayPath": "orders",
    "nestedArrayPath": "items",
    "outputFields": {
      "orderId": {
        "from": "base",
        "path": "id"
      },
      "product": {
        "from": "nested",
        "path": "product"
      },
      "price": {
        "from": "nested",
        "path": "price"
      }
    }
  }
}`}
                    </pre>
                    <p className="mt-4 text-sm">
                      This will create a flat list where each item combines the order details with its product details. The &quot;from&quot; field specifies whether to get the value from the base array (&quot;base&quot;) or the nested array (&quot;nested&quot;), and &quot;path&quot; specifies the exact location of the field in the data structure.
                    </p>
                  </div>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            onPress={onClose}
            color="default"
            variant="bordered"
          >
            Close
          </Button>
          <Button
            onPress={() => {
              try {
                // Validate JSON before saving
                const finalConfig = JSON.parse(editorValue);
                onSave({ ...finalConfig, enabled: transformConfig.enabled });
                onClose();
              } catch (e) {
                // If JSON is invalid, don't save
                console.error("Invalid JSON configuration");
              }
            }}
            color="primary"
          >
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

DataTransform.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  initialTransform: PropTypes.object,
};

export default DataTransform;
