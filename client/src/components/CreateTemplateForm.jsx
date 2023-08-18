import React, { useState } from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import {
  Button, Input, Loading, Modal, Spacer, Text,
} from "@nextui-org/react";

import {
  createTemplate as createTemplateAction,
} from "../actions/template";

function CreateTemplateForm(props) {
  const {
    teamId, projectId, visible, onClose, createTemplate,
  } = props;

  const [templateName, setTemplateName] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState(false);

  const _onSaveTemplate = () => {
    if (!templateName) {
      setValidationError(true);
      return false;
    }

    setValidationError(false);
    setLoading(true);

    return createTemplate(teamId, projectId, templateName)
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
    <Modal open={visible} closeIcon onClose={() => onClose()} size="small">
      <Modal.Header>
        <Text h3>Create a template</Text>
      </Modal.Header>
      <Modal.Body>
        <Spacer y={1} />
        <form onSubmit={(e) => {
          e.preventDefault();
          _onSaveTemplate();
        }}>
          <Input
            labelPlaceholder="Enter a name for the template"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            color={validationError ? "error" : "default"}
            bordered
            fullWidth
            autoFocus
          />
        </form>
        <Spacer y={1} />
      </Modal.Body>
      <Modal.Footer>
        <Button
          flat
          color="warning"
          onClick={() => onClose()}
          auto
        >
          Close
        </Button>
        <Button
          disabled={loading}
          onClick={_onSaveTemplate}
          auto
        >
          {loading && <Loading type="points" />}
          {!loading && "Save template"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

CreateTemplateForm.propTypes = {
  teamId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  projectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  visible: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  createTemplate: PropTypes.func.isRequired,
};

CreateTemplateForm.defaultProps = {
  visible: false,
};

const mapStateToProps = () => {};
const mapDispatchToProps = (dispatch) => {
  return {
    createTemplate: (teamId, projectId, name) => (
      dispatch(createTemplateAction(teamId, projectId, name))
    ),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(CreateTemplateForm);
