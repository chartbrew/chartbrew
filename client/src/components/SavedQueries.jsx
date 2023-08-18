import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Button, Container, Input, Loading, Modal, Row, Spacer, Text, Tooltip,
} from "@nextui-org/react";
import { CloseSquare, Edit, TickSquare } from "react-iconly";

import { getSavedQueries, updateSavedQuery, deleteSavedQuery } from "../actions/savedQuery";
import { secondaryTransparent } from "../config/colors";

/*
  Contains the project creation functionality
*/
function SavedQueries(props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editQuery, setEditQuery] = useState();
  const [editLoading, setEditLoading] = useState();
  const [savedQuerySummary, setSavedQuerySummary] = useState();
  const [removeQuery, setRemoveQuery] = useState();
  const [removeLoading, setRemoveLoading] = useState();

  const {
    project, type, getSavedQueries, updateSavedQuery, deleteSavedQuery,
    savedQueries, onSelectQuery, selectedQuery, style
  } = props;

  useEffect(() => {
    _getSavedQueries();
  }, []);

  const _getSavedQueries = () => {
    setLoading(true);
    getSavedQueries(project.id, type)
      .then(() => {
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  const _onEditQueryConfirmation = (query) => {
    setEditQuery(query);
  };

  const _onEditQuery = () => {
    setEditLoading(true);
    updateSavedQuery(project.id, editQuery.id, {
      summary: savedQuerySummary,
    })
      .then(() => {
        setEditLoading(false);
        setEditQuery(null);
        setSavedQuerySummary("");
      })
      .catch(() => {
        setEditLoading(false);
        setEditQuery(null);
        setSavedQuerySummary("");
      });
  };

  const _onRemoveQueryConfirmation = (queryId) => {
    setRemoveQuery(queryId);
  };

  const _onRemoveQuery = () => {
    setRemoveLoading(true);
    deleteSavedQuery(project.id, removeQuery)
      .then(() => {
        setRemoveQuery(null);
        setRemoveLoading(false);
      })
      .catch(() => {
        setRemoveQuery(null);
        setRemoveLoading(false);
      });
  };

  return (
    <div style={{ ...styles.container, ...style }}>
      {loading && (
        <Loading type="spinner">
          Loading queries
        </Loading>
      )}

      {error && (
        <Text color="error">
          {"Could not get your saved queries. Try to refresh the page or get in touch with us to fix the issue"}
        </Text>
      )}

      {savedQueries.length > 0 && (
        <Container css={{ pl: 0, width: "100%" }}>
          {savedQueries.map((query) => {
            return (
              <Row
                key={query.id}
                style={selectedQuery === query.id ? styles.selectedItem : {}}
                justify="space-between"
                align="center"
                gap={1}
                css={{ pb: 10 }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <Text b>{query.summary}</Text>
                  <Spacer y={0.2} />
                  <Text small>{`created by ${query.User.name}`}</Text>
                </div>
                <div style={{ display: "flex", flexDirection: "row", justifyContent: "flex-end" }}>
                  <Tooltip content="Use this query" css={{ zIndex: 10000 }}>
                    <Button
                      icon={<TickSquare />}
                      color="success"
                      onClick={() => onSelectQuery(query)}
                      css={{ minWidth: "fit-content" }}
                      size="sm"
                    />
                  </Tooltip>
                  <Spacer x={0.2} />
                  <Tooltip content="Edit the summary" css={{ zIndex: 10000 }}>
                    <Button
                      icon={editQuery && editLoading && editQuery.id === query.id ? <Loading type="spinner" /> : <Edit />}
                      color="secondary"
                      disabled={editQuery && editLoading && editQuery.id === query.id}
                      onClick={() => _onEditQueryConfirmation(query)}
                      css={{ minWidth: "fit-content" }}
                      size="sm"
                    />
                  </Tooltip>
                  <Spacer x={0.2} />
                  <Tooltip content="Remove the saved query" css={{ zIndex: 10000 }}>
                    <Button
                      icon={<CloseSquare />}
                      color="error"
                      onClick={() => _onRemoveQueryConfirmation(query.id)}
                      css={{ minWidth: "fit-content" }}
                      size="sm"
                    />
                  </Tooltip>
                </div>
              </Row>
            );
          })}
        </Container>
      )}
      {savedQueries.length < 1 && !loading
        && <p><i>{"The project doesn't have any saved queries yet"}</i></p>}

      {/* Update query modal */}
      <Modal open={!!editQuery} size="small" onClose={() => setEditQuery(null)}>
        <Modal.Header>
          <Text h3>Edit the query</Text>
        </Modal.Header>
        <Modal.Body>
          <Input
            label="Edit the description of the query"
            placeholder="Type a summary here"
            value={savedQuerySummary ? savedQuerySummary /* eslint-disable-line */
              : editQuery ? editQuery.summary : ""}
            fluid
            onChange={(e) => setSavedQuerySummary(e.target.value)}
            bordered
            fullWidth
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            flat
            color="warning"
            onClick={() => setEditQuery(null)}
            auto
          >
            Close
          </Button>
          <Button
            disabled={editLoading || !savedQuerySummary}
            onClick={_onEditQuery}
            auto
          >
            Save the query
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Update query modal */}
      <Modal open={!!removeQuery} size="small" basic onClose={() => setRemoveQuery(null)}>
        <Modal.Header>
          <Text h3>Are you sure you want to remove the query?</Text>
        </Modal.Header>
        <Modal.Body>
          <Text>{"This action will be permanent."}</Text>
        </Modal.Body>
        <Modal.Footer>
          <Button
            flat
            color="warning"
            onClick={() => setRemoveQuery(null)}
            auto
          >
            Close
          </Button>
          <Button
            color="error"
            disabled={removeLoading}
            onClick={_onRemoveQuery}
            auto
          >
            Remove the query
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

const styles = {
  container: {
    width: "100%",
  },
  selectedItem: {
    backgroundColor: secondaryTransparent(0.1),
  },
};

SavedQueries.defaultProps = {
  onSelectQuery: () => {},
  selectedQuery: -1,
  type: "",
  style: {},
};

SavedQueries.propTypes = {
  project: PropTypes.object.isRequired,
  savedQueries: PropTypes.array.isRequired,
  getSavedQueries: PropTypes.func.isRequired,
  updateSavedQuery: PropTypes.func.isRequired,
  deleteSavedQuery: PropTypes.func.isRequired,
  onSelectQuery: PropTypes.func,
  selectedQuery: PropTypes.number,
  type: PropTypes.string,
  style: PropTypes.object,
};

const mapStateToProps = (state) => {
  return {
    project: state.project.active,
    savedQueries: state.savedQuery.data,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getSavedQueries: (projectId, type) => dispatch(getSavedQueries(projectId, type)),
    updateSavedQuery: (projectId, savedQueryId, data) => (
      dispatch(updateSavedQuery(projectId, savedQueryId, data))
    ),
    deleteSavedQuery: (projectId, savedQueryId) => (
      dispatch(deleteSavedQuery(projectId, savedQueryId))
    ),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(SavedQueries);
