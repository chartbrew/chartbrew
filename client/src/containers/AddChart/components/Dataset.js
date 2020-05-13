import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import _ from "lodash";
import {
  Container, Icon, Divider, Dropdown, Button, Grid,
  Form, Input,
} from "semantic-ui-react";
import moment from "moment";

import mongoImg from "../../../assets/mongodb-logo-1.png";
import mysqlImg from "../../../assets/mysql.svg";
import apiImg from "../../../assets/api.png";
import postgresImg from "../../../assets/postgres.png";
import DatarequestModal from "./DatarequestModal";

function Dataset(props) {
  const { dataset, connections, onUpdate } = props;
  const [newDataset, setNewDataset] = useState(dataset);
  const [dropdownConfig, setDropdownConfig] = useState([]);
  const [dataRequest] = useState({});
  const [configOpened, setConfigOpened] = useState(false);
  const [saveRequired, setSaveRequired] = useState(false);
  const [shouldSave, setShouldSave] = useState(null);

  useEffect(() => {
    const config = [];
    connections.map((connection) => {
      const image = connection.type === "mongodb"
        ? mongoImg : connection.type === "api"
          ? apiImg : connection.type === "mysql"
            ? mysqlImg : postgresImg;

      config.push({
        key: connection.id,
        value: connection.id,
        text: connection.name,
        image: {
          src: image,
        }
      });

      return connection;
    });
    setDropdownConfig(config);
    // if (!dataset.id && connections[0]) setDataset(connections[0]);
  }, [connections]);

  // update the dataset with the active one
  useEffect(() => {
    setNewDataset(dataset);
  }, [dataset]);

  // update the dataset prop based on new changes
  useEffect(() => {
    if (_.isEqual(dataset, newDataset)) {
      setSaveRequired(false);
      return;
    }

    setSaveRequired(true);
    if (shouldSave === null) {
      setShouldSave(moment().add(2, "seconds"));
    } else if (moment().isAfter(shouldSave)) {
      onUpdate(newDataset);
      setShouldSave(moment().add(2, "seconds"));
    } else {
      setShouldSave(moment().add(2, "seconds"));
    }
  }, [newDataset]);

  const _onChangeConnection = (e, data) => {
    onUpdate({ connection_id: data.value });
  };

  const _openConfigModal = () => {
    setConfigOpened(true);
  };

  const _onCloseConfig = () => {
    setConfigOpened(false);
  };

  const _onSaveDataset = () => {
    onUpdate(newDataset);
  };

  const _onDeleteDataset = () => {
    if (!newDataset.deleted && newDataset.deleted !== false) {
      setNewDataset({ ...newDataset, deleted: true });
    } else {
      setNewDataset({ ...newDataset, deleted: !newDataset.deleted });
    }
  };

  const _onChangeLegend = (e, data) => {
    if (data.value && data.value.length > 0) {
      setNewDataset({ ...newDataset, legend: data.value });
    }
  };

  const _getActiveConnection = () => {
    let activeConnection;
    connections.map((connection) => {
      if (newDataset.connection_id === connection.id) {
        activeConnection = connection;
      }

      return connection;
    });

    return activeConnection;
  };

  if (!dataset || !dataset.id) return (<span />);

  return (
    <Container text style={styles.container}>
      <Form>
        <Form.Field>
          <label>Dataset name</label>
          <Input
            placeholder="Enter the dataset name"
            value={newDataset.legend}
            onChange={_onChangeLegend}
          />
        </Form.Field>
      </Form>
      <Divider hidden />

      <Grid stackable>
        <Grid.Row columns={2}>
          <Grid.Column>
            <Dropdown
              placeholder="Select an available connection from the list"
              selection
              value={newDataset.connection_id}
              options={dropdownConfig}
              disabled={connections.length < 1}
              onChange={_onChangeConnection}
              fluid
            />
          </Grid.Column>
          <Grid.Column textAlign="left">
            <Button
              primary
              icon
              labelPosition="right"
              disabled={!newDataset.connection_id}
              onClick={_openConfigModal}
            >
              <Icon name="cog" />
              Configure
            </Button>
          </Grid.Column>
        </Grid.Row>
        <Grid.Row>
          <Grid.Column>
            <Divider />
            <Button
              primary
              icon
              labelPosition="right"
              onClick={_onSaveDataset}
              disabled={!saveRequired}
            >
              <Icon name="checkmark" />
              {saveRequired ? "Save" : "Saved"}
            </Button>
            <Button
              basic
              negative={!newDataset.deleted}
              icon
              labelPosition="right"
              onClick={_onDeleteDataset}
            >
              <Icon name={newDataset.deleted ? "archive" : "trash"} />
              {newDataset.deleted ? "Re-activate dataset" : "Remove dataset"}
            </Button>
          </Grid.Column>
        </Grid.Row>
      </Grid>

      {newDataset.connection_id && (
        <DatarequestModal
          dataset={dataset}
          connection={_getActiveConnection()}
          dataRequest={dataRequest}
          open={configOpened}
          onClose={_onCloseConfig}
        />
      )}
    </Container>
  );
}

Dataset.propTypes = {
  dataset: PropTypes.object.isRequired,
  connections: PropTypes.array.isRequired,
  onUpdate: PropTypes.func.isRequired,
};

const styles = {
  container: {
    flex: 1,
  },
  closeBtn: {
    float: "left",
  },
};

const mapStateToProps = (state) => {
  return {
    datasetLoading: state.dataset.loading,
    connections: state.connection.data,
  };
};

export default connect(mapStateToProps)(Dataset);
