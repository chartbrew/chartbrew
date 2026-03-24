import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Modal,
} from "@heroui/react";
import { useDispatch } from "react-redux";

import { createTemplate } from "../slices/template";

function CreateTemplateForm(props) {
  const {
    teamId, projectId, visible = false, onClose,
  } = props;

  const [templateName, setTemplateName] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState(false);

  const dispatch = useDispatch();

  const _onSaveTemplate = () => {
    if (!templateName) {
      setValidationError(true);
      return false;
    }

    setValidationError(false);
    setLoading(true);

    return dispatch(createTemplate({
      team_id: teamId,
      project_id: projectId,
      name: templateName
    }))
      .then(() => {
        setLoading(false);
        onClose(true);
        return true;
      })
      .catch(() => {
        setLoading(false);
      });
  };

  return (
    <Modal.Backdrop
      isOpen={visible}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>Create a template</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="text-sm">
              Templates are saved as a snapshot of the dashboard at the time of creation. You can use them to quickly create new dashboards.
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              _onSaveTemplate();
            }}>
              <Input
                label="Template name"
                placeholder="Enter a name for the template"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                color={validationError ? "error" : "default"}
                variant="bordered"
                fullWidth
                autoFocus
              />
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="tertiary"
              size="sm"
              onPress={() => onClose()}
            >
              Close
            </Button>
            <Button
              isPending={loading}
              onPress={_onSaveTemplate}
              size="sm"
              variant="primary"
            >
              Save template
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

CreateTemplateForm.propTypes = {
  teamId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  projectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  visible: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
};

export default CreateTemplateForm;
