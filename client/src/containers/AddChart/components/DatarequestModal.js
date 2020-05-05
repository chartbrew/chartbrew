import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Modal, Button,
} from "semantic-ui-react";
import ApiBuilder from "./ApiBuilder";

function DatarequestModal(props) {
  const {
    open, dataset, onClose, dataRequest, connection,
  } = props;

  const _onClose = () => {
    onClose();
  };

  return (
    <Modal open={open} size="fullscreen" onClose={_onClose}>
      <Modal.Header>{`Configure ${dataset.name}`}</Modal.Header>
      <Modal.Content>
        {connection.type === "api" && (
          <ApiBuilder
            dataRequest={dataRequest}
            connection={connection}
          />
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={_onClose} basic>Close</Button>
        <Button primary onClick={() => {}}>Save</Button>
      </Modal.Actions>
    </Modal>
  );
}

DatarequestModal.defaultProps = {
  open: false,
};

DatarequestModal.propTypes = {
  open: PropTypes.bool,
  dataset: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  connection: PropTypes.object.isRequired,
  dataRequest: PropTypes.object.isRequired,
};

const mapStateToProps = () => {
  return {
  };
};

export default connect(mapStateToProps)(DatarequestModal);
