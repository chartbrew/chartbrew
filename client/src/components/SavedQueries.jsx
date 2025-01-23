import React, { Fragment, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Button, Input, CircularProgress, Modal, Spacer, Tooltip, ModalHeader, ModalBody, ModalFooter, ModalContent, Divider,
} from "@heroui/react";
import { LuCheck, LuPencilLine, LuX } from "react-icons/lu";
import { useParams } from "react-router-dom";

import { getSavedQueries, updateSavedQuery, deleteSavedQuery, selectSavedQueries } from "../slices/savedQuery";
import { secondaryTransparent } from "../config/colors";
import Row from "./Row";
import Text from "./Text";

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
    type, onSelectQuery, selectedQuery, style,
  } = props;

  const savedQueries = useSelector(selectSavedQueries);

  const dispatch = useDispatch();
  const params = useParams();

  useEffect(() => {
    _getSavedQueries();
  }, []);

  const _getSavedQueries = () => {
    setLoading(true);
    dispatch(getSavedQueries({ team_id: params.teamId, type}))
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
    dispatch(updateSavedQuery({ team_id: params.teamId, data: {
      id: editQuery.id,
      summary: savedQuerySummary,
    }}))
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
    dispatch(deleteSavedQuery({ team_id: params.teamId, id: removeQuery }))
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
        <CircularProgress aria-label="loading">
          Loading queries
        </CircularProgress>
      )}

      {error && (
        <Text color="danger">
          {"Could not get your saved queries. Try to refresh the page or get in touch with us to fix the issue"}
        </Text>
      )}

      {savedQueries.length > 0 && (
        <div>
          {savedQueries.map((query) => {
            return (
              <Fragment key={query.id}>
                <Row
                  style={selectedQuery === query.id ? styles.selectedItem : {}}
                  justify="space-between"
                  align="center"
                  className={"gap-4"}
                >
                  <div>
                    <Text size="sm" b>{query.summary}</Text>
                    <Spacer y={0.2} />
                    <Text size="sm">{`created by ${query.User.name}`}</Text>
                  </div>
                  <div className="flex flex-row justify-end gap-2">
                    <Tooltip content="Use this query">
                      <Button
                        isIconOnly
                        onClick={() => onSelectQuery(query)}
                        size="sm"
                        variant="faded"
                      >
                        <LuCheck />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Edit the summary">
                      <Button
                        isIconOnly
                        isDisabled={editQuery && editQuery.id === query.id}
                        onClick={() => _onEditQueryConfirmation(query)}
                        size="sm"
                        isLoading={editLoading}
                        variant="faded"
                      >
                        <LuPencilLine />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Remove the saved query">
                      <Button
                        isIconOnly
                        onClick={() => _onRemoveQueryConfirmation(query.id)}
                        size="sm"
                        variant="faded"
                      >
                        <LuX />
                      </Button>
                    </Tooltip>
                  </div>
                </Row>
                <Spacer y={1} />
                <Divider />
                <Spacer y={1} />
              </Fragment>
            );
          })}
        </div>
      )}
      {savedQueries.length < 1 && !loading
        && <p><i>{"The project doesn't have any saved queries yet"}</i></p>}

      {/* Update query modal */}
      <Modal isOpen={!!editQuery} onClose={() => setEditQuery(null)}>
        <ModalContent>
          <ModalHeader>
            <Text b>Edit the query</Text>
          </ModalHeader>
          <ModalBody>
            <Input
              label="Edit the description of the query"
              placeholder="Type a summary here"
              value={savedQuerySummary ? savedQuerySummary
                : editQuery ? editQuery.summary : ""}
              onChange={(e) => setSavedQuerySummary(e.target.value)}
              variant="bordered"
              fullWidth
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setEditQuery(null)}
            >
              Close
            </Button>
            <Button
              isDisabled={!savedQuerySummary}
              onClick={_onEditQuery}
              color="primary"
              isLoading={editLoading}
            >
              Save the query
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Update query modal */}
      <Modal isOpen={!!removeQuery} onClose={() => setRemoveQuery(null)}>
        <ModalContent>
          <ModalHeader>
            <Text b>Are you sure you want to remove the query?</Text>
          </ModalHeader>
          <ModalBody>
            <Text>{"This action will be permanent."}</Text>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setRemoveQuery(null)}
            >
              Close
            </Button>
            <Button
              color="danger"
              onClick={_onRemoveQuery}
              isLoading={removeLoading}
            >
              Remove the query
            </Button>
          </ModalFooter>
        </ModalContent>
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
  onSelectQuery: PropTypes.func,
  selectedQuery: PropTypes.number,
  type: PropTypes.string,
  style: PropTypes.object,
};

export default SavedQueries;
