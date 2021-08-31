import React, { useState } from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import {
  Button,
  Form, Input, Modal, TransitionablePortal
} from "semantic-ui-react";

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
    <TransitionablePortal open={visible}>
      <Modal open={visible} closeIcon onClose={() => onClose()} size="small">
        <Modal.Header>Create a template</Modal.Header>
        <Modal.Content>
          <Form>
            <Form.Field error={validationError}>
              <label>Template name</label>
              <Input
                placeholder="Enter a name you can recognize later"
                value={templateName}
                onChange={(e, data) => setTemplateName(data.value)}
              />
            </Form.Field>
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button
            content="Cancel"
            onClick={() => onClose()}
          />
          <Button
            primary
            content="Save template"
            loading={loading}
            onClick={_onSaveTemplate}
          />
        </Modal.Actions>
      </Modal>
    </TransitionablePortal>
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
