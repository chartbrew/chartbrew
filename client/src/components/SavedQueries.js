import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  List, Button, Icon, Popup, Loader, Message, Modal, Header, Input, TransitionablePortal
} from "semantic-ui-react";

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
      <Loader active={loading} />

      {error
        && (
        <Message negative>
          <Message.Header>Could not get your saved queries</Message.Header>
          <p>Try to refresh the page or get in touch with us to fix the issue.</p>
        </Message>
        )}

      {savedQueries.length > 0
        && (
        <List
          divided
          selection
          verticalAlign="middle"
        >
          {savedQueries.map((query) => {
            return (
              <List.Item
                key={query.id}
                style={selectedQuery === query.id ? styles.selectedItem : {}}
              >
                <List.Content floated="right">
                  <Popup
                    trigger={(
                      <Button
                        icon
                        positive
                        onClick={() => onSelectQuery(query)}
                      >
                        <Icon name="check" />
                      </Button>
                    )}
                    content="Use this query"
                    position="top left"
                  />

                  <Popup
                    trigger={(
                      <Button
                        icon
                        secondary
                        loading={editQuery && editLoading && editQuery.id === query.id}
                        onClick={() => _onEditQueryConfirmation(query)}
                      >
                        <Icon name="pencil" />
                      </Button>
                    )}
                    content="Edit the summary"
                    position="top center"
                  />

                  <Popup
                    trigger={(
                      <Button
                        icon
                        negative
                        onClick={() => _onRemoveQueryConfirmation(query.id)}
                      >
                        <Icon name="x" />
                      </Button>
                    )}
                    content="Remove the saved query"
                    position="top right"
                  />
                </List.Content>

                <List.Content verticalAlign="middle">
                  <List.Header>{query.summary}</List.Header>
                  <List.Description>{`created by ${query.User.name}`}</List.Description>
                </List.Content>
              </List.Item>
            );
          })}
        </List>
        )}
      {savedQueries.length < 1 && !loading
        && <p><i>{"The project doesn't have any saved queries yet"}</i></p>}

      {/* Update query modal */}
      <TransitionablePortal open={!!editQuery}>
        <Modal open={!!editQuery} size="small" onClose={() => setEditQuery(null)}>
          <Header
            content="Edit the query"
            inverted
          />
          <Modal.Content>
            <Header size="small">Edit the description of the query</Header>
            <Input
              placeholder="Type a summary here"
              value={savedQuerySummary ? savedQuerySummary /* eslint-disable-line */
                : editQuery ? editQuery.summary : ""}
              fluid
              onChange={(e, data) => setSavedQuerySummary(data.value)}
            />
          </Modal.Content>
          <Modal.Actions>
            <Button
              onClick={() => setEditQuery(null)}
            >
              Close
            </Button>
            <Button
              primary
              disabled={!savedQuerySummary}
              icon
              labelPosition="right"
              loading={editLoading}
              onClick={_onEditQuery}
            >
              <Icon name="checkmark" />
              Save the query
            </Button>
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>

      {/* Update query modal */}
      <TransitionablePortal open={!!removeQuery}>
        <Modal open={!!removeQuery} size="small" basic onClose={() => setRemoveQuery(null)}>
          <Header
            icon="exclamation triangle"
            content="Are you sure you want to remove the query?"
            inverted
          />
          <Modal.Content>
            <p>{"This action will be permanent."}</p>
          </Modal.Content>
          <Modal.Actions>
            <Button
              onClick={() => setRemoveQuery(null)}
            >
              Close
            </Button>
            <Button
              negative
              icon
              labelPosition="right"
              loading={removeLoading}
              onClick={_onRemoveQuery}
            >
              <Icon name="x" />
              Remove the query
            </Button>
          </Modal.Actions>
        </Modal>
      </TransitionablePortal>
    </div>
  );
}

const styles = {
  container: {
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
