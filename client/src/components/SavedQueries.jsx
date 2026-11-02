import React, { useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import { Button, Input, Label, Modal, Popover, TextField } from "@heroui/react";
import { LuBookmark, LuCheck, LuChevronDown, LuPencilLine, LuPlus, LuTrash } from "react-icons/lu";
import toast from "react-hot-toast";

import {
  createSavedQuery, getSavedQueries, updateSavedQuery, deleteSavedQuery, selectSavedQueries,
} from "../slices/savedQuery";
import { selectTeam } from "../slices/team";

function SavedQueries({ type, query, onSelectQuery }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [summary, setSummary] = useState("");
  const [removing, setRemoving] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const savedQueries = useSelector(selectSavedQueries).filter((item) => item.type === type);
  const team = useSelector(selectTeam);
  const dispatch = useDispatch();
  const selected = savedQueries.find((item) => item.id === selectedQuery);
  const matches = savedQueries.filter((item) => item.summary.toLowerCase().includes(search.toLowerCase()));

  const loadQueries = async () => {
    setLoading(true);
    setError("");
    try {
      await dispatch(getSavedQueries({ team_id: team.id, type })).unwrap();
    } catch (_error) {
      setError("Could not load saved queries. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const editSummary = (item = {}) => {
    setEditing(item);
    setSummary(item.summary || "");
    setSaveError("");
    setOpen(false);
  };

  const saveQuery = async () => {
    if (!summary.trim() || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const data = editing.id
        ? { id: editing.id, summary: summary.trim() }
        : { query, summary: summary.trim(), type };
      const action = editing.id ? updateSavedQuery : createSavedQuery;
      const saved = await dispatch(action({ team_id: team.id, data })).unwrap();
      if (!editing.id) setSelectedQuery(saved.id);
      setEditing(null);
      toast.success("Query saved");
    } catch (_error) {
      setSaveError("Could not save the query. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const updateQuery = async () => {
    setSaving(true);
    setError("");
    try {
      await dispatch(updateSavedQuery({ team_id: team.id, data: { id: selectedQuery, query } })).unwrap();
      toast.success("Saved query updated");
    } catch (_error) {
      setError("Could not update the saved query. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const removeQuery = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await dispatch(deleteSavedQuery({ team_id: team.id, id: removing.id })).unwrap();
      if (selectedQuery === removing.id) setSelectedQuery(null);
      setRemoving(null);
    } catch (_error) {
      setSaveError("Could not delete the saved query. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Popover
        isOpen={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (isOpen) {
            setSearch("");
            loadQueries();
          }
        }}
      >
        <Button size="sm" variant="ghost">
          <LuBookmark aria-hidden size={16} />
          Saved queries
          <LuChevronDown aria-hidden size={16} className={open ? "rotate-180" : ""} />
        </Button>
        <Popover.Content className="w-96 max-w-[calc(100vw-2rem)]" placement="bottom start">
          <Popover.Dialog aria-label="Saved queries" className="flex flex-col gap-3 p-3">
            {savedQueries.length > 7 && (
              <TextField aria-label="Search saved queries">
                <Input
                  placeholder="Search queries"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  variant="secondary"
                />
              </TextField>
            )}
            <div className="max-h-64 overflow-y-auto" aria-busy={loading}>
              {loading ? (
                <p className="py-2 text-sm text-muted" role="status">Loading saved queries…</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {matches.map((item) => (
                    <div key={item.id} className="flex items-center gap-1">
                      <Button
                        className="min-w-0 flex-1 justify-start"
                        variant={selectedQuery === item.id ? "secondary" : "ghost"}
                        size="sm"
                        onPress={() => {
                          setSelectedQuery(item.id);
                          onSelectQuery(item);
                          setOpen(false);
                        }}
                      >
                        <span className="truncate">{item.summary}</span>
                      </Button>
                      <Button
                        aria-label={`Rename ${item.summary}`}
                        title="Rename query"
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        onPress={() => editSummary(item)}
                      >
                        <LuPencilLine aria-hidden size={16} />
                      </Button>
                      <Button
                        aria-label={`Delete ${item.summary}`}
                        title="Delete saved query"
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        onPress={() => {
                          setRemoving(item);
                          setSaveError("");
                          setOpen(false);
                        }}
                      >
                        <LuTrash aria-hidden size={16} />
                      </Button>
                    </div>
                  ))}
                  {!matches.length && !error && (
                    <p className="py-2 text-sm text-muted">
                      {search ? "No matching queries. Try another name." : "No saved queries yet."}
                    </p>
                  )}
                </div>
              )}
            </div>
            {error && (
              <div className="flex flex-col items-start gap-1">
                <p className="text-sm text-danger" role="alert">{error}</p>
                <Button size="sm" variant="ghost" onPress={loadQueries}>Reload queries</Button>
              </div>
            )}
            <div className="flex items-center gap-2 border-t border-divider pt-3">
              <Button size="sm" variant="secondary" isDisabled={!query?.trim()} onPress={() => editSummary()}>
                <LuPlus aria-hidden size={16} />
                Save as new
              </Button>
              {selected && (
                <Button size="sm" variant="ghost" isDisabled={!query?.trim()} isPending={saving} onPress={updateQuery}>
                  <LuCheck aria-hidden size={16} />
                  Update query
                </Button>
              )}
            </div>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>

      <Modal.Backdrop isOpen={!!editing} onOpenChange={(isOpen) => { if (!isOpen && !saving) setEditing(null); }}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.Header>
              <Modal.Heading>{editing?.id ? "Rename saved query" : "Add to saved queries"}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <TextField>
                <Label>Query name</Label>
                <Input
                  autoFocus
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="For example, Orders this month"
                  variant="secondary"
                />
              </TextField>
              {saveError && <p className="text-sm text-danger" role="alert">{saveError}</p>}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" isDisabled={saving} onPress={() => setEditing(null)}>Cancel</Button>
              <Button isDisabled={!summary.trim()} isPending={saving} onPress={saveQuery}>Save query</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop isOpen={!!removing} onOpenChange={(isOpen) => { if (!isOpen && !saving) setRemoving(null); }}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.Header>
              <Modal.Heading>Delete saved query?</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <p>{`“${removing?.summary || ""}” will be deleted. This cannot be undone.`}</p>
              {saveError && <p className="text-sm text-danger" role="alert">{saveError}</p>}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" isDisabled={saving} onPress={() => setRemoving(null)}>Cancel</Button>
              <Button variant="danger" isPending={saving} onPress={removeQuery}>Delete saved query</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}

SavedQueries.propTypes = {
  type: PropTypes.string.isRequired,
  query: PropTypes.string,
  onSelectQuery: PropTypes.func.isRequired,
};

export default SavedQueries;
