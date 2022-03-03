import React from "react";
import PropTypes from "prop-types";

function CustomerioConnectionForm() {
  return (
    <div />
  );
}

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
