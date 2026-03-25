import React, { Fragment, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Button, Input, ProgressCircle, Modal, Tooltip, Separator,
} from "@heroui/react";
import { LuCheck, LuPencilLine, LuX } from "react-icons/lu";

import { getSavedQueries, updateSavedQuery, deleteSavedQuery, selectSavedQueries } from "../slices/savedQuery";
import { secondaryTransparent } from "../config/colors";
import Row from "./Row";
import Text from "./Text";
import { selectTeam } from "../slices/team";

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
  const team = useSelector(selectTeam);
  const initRef = useRef(false);

  useEffect(() => {
    if (team?.id && !initRef.current) {
      initRef.current = true;
      _getSavedQueries();
    }
  }, [team]);

  const _getSavedQueries = () => {
    setLoading(true);
    dispatch(getSavedQueries({ team_id: team.id, type}))
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
    dispatch(updateSavedQuery({ team_id: team.id, data: {
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
    dispatch(deleteSavedQuery({ team_id: team.id, id: removeQuery }))
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
        <ProgressCircle aria-label="loading">
          Loading queries
        </ProgressCircle>
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
                    <div className="h-0.5" />
                    <Text size="sm">{`created by ${query.User.name}`}</Text>
                  </div>
                  <div className="flex flex-row justify-end gap-2">
                    <Tooltip>
                      <Tooltip.Trigger>
                        <Button
                          isIconOnly
                          onPress={() => onSelectQuery(query)}
                          size="sm"
                          variant="secondary"
                        >
                          <LuCheck />
                        </Button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>Use this query</Tooltip.Content>
                    </Tooltip>
                    <Tooltip>
                      <Tooltip.Trigger>
                        <Button
                          isIconOnly
                          isDisabled={editQuery && editQuery.id === query.id}
                          onPress={() => _onEditQueryConfirmation(query)}
                          size="sm"
                          isPending={editLoading}
                          variant="secondary"
                        >
                          <LuPencilLine />
                        </Button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>Edit the summary</Tooltip.Content>
                    </Tooltip>
                    <Tooltip>
                      <Tooltip.Trigger>
                        <Button
                          isIconOnly
                          onPress={() => _onRemoveQueryConfirmation(query.id)}
                          size="sm"
                          variant="secondary"
                        >
                          <LuX />
                        </Button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>Remove the saved query</Tooltip.Content>
                    </Tooltip>
                  </div>
                </Row>
                <div className="h-1" />
                <Separator />
                <div className="h-1" />
              </Fragment>
            );
          })}
        </div>
      )}
      {savedQueries.length < 1 && !loading
        && <p><i>{"The project doesn't have any saved queries yet"}</i></p>}

      {/* Update query modal */}
      <Modal.Backdrop
        isOpen={!!editQuery}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditQuery(null);
        }}
      >
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Edit the query</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <Input
                label="Edit the description of the query"
                placeholder="Type a summary here"
                value={savedQuerySummary ? savedQuerySummary
                  : editQuery ? editQuery.summary : ""}
                onChange={(e) => setSavedQuerySummary(e.target.value)}
                variant="secondary"
                fullWidth
              />
            </Modal.Body>
            <Modal.Footer>
              <Button
                onPress={() => setEditQuery(null)}
                variant="secondary"
              >
                Close
              </Button>
              <Button
                isDisabled={!savedQuerySummary}
                isPending={editLoading}
                onPress={_onEditQuery}
                variant="primary"
              >
                Save the query
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Update query modal */}
      <Modal.Backdrop
        isOpen={!!removeQuery}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRemoveQuery(null);
        }}
      >
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Are you sure you want to remove the query?</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <Text>{"This action will be permanent."}</Text>
            </Modal.Body>
            <Modal.Footer>
              <Button
                onPress={() => setRemoveQuery(null)}
                variant="secondary"
              >
                Close
              </Button>
              <Button
                isPending={removeLoading}
                onPress={_onRemoveQuery}
                variant="danger"
              >
                Remove the query
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
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
