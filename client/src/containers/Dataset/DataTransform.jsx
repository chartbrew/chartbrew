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
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
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
            <div className="w-full mt-4">
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
                onSave(finalConfig);
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
