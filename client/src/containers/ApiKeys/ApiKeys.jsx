import React, { useEffect, useRef, useState } from "react";
import {
  Alert, Checkbox,
  Button, Chip, EmptyState, InputGroup, Label, Modal, ProgressCircle, Radio, RadioGroup, Table, TextField, Tooltip,
} from "@heroui/react";
import { formatRelative } from "date-fns";
import {
  LuCheck, LuCopy, LuKeyRound, LuPlus, LuTrash, LuTriangleAlert,
} from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";

import { getApiKeys, createApiKey, deleteApiKey, selectTeam } from "../../slices/team";
import canAccess from "../../config/canAccess";
import { selectUser } from "../../slices/user";
import {
  getPermissionLabels,
  getProjectAccessLabel,
  isLegacyApiKey,
} from "./apiKeyPresentation";

function ApiKeys() {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [createdKey, setCreatedKey] = useState({});
  const [tokenCopied, setTokenCopied] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [allProjects, setAllProjects] = useState(true);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [allowRefresh, setAllowRefresh] = useState(false);
  const [createError, setCreateError] = useState("");

  const dispatch = useDispatch();
  const initRef = useRef(false);

  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);

  useEffect(() => {
    if (team?.id && initRef.current !== team.id) {
      initRef.current = team.id;
      _fetchApiKeys();
    }
  }, [team]);

  const _fetchApiKeys = () => {
    setLoading(true);
    dispatch(getApiKeys({ team_id: team.id }))
      .then((keys) => {
        if (keys?.error) {
          setLoading(false);
          return;
        }
        setApiKeys(keys.payload);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const projects = (team?.Projects || []).filter((project) => !project.ghost);

  const _onCreateRequested = () => {
    setNewKey("");
    setAllProjects(true);
    setSelectedProjects([]);
    setAllowRefresh(false);
    setCreateError("");
    setCreateMode(true);
  };

  const _onCreateModeChange = (nextOpen) => {
    setCreateMode(nextOpen);
    if (!nextOpen) {
      setCreateError("");
    }
  };

  const _onProjectChange = (projectId, selected) => {
    setSelectedProjects((currentProjects) => {
      if (selected) return [...new Set([...currentProjects, projectId])];
      return currentProjects.filter((id) => id !== projectId);
    });
  };

  const _onCreateKey = () => {
    setCreateLoading(true);
    setCreateError("");
    dispatch(createApiKey({
      team_id: team.id,
      key: {
        name: newKey,
        scopes: allowRefresh ? ["data:read", "data:refresh"] : ["data:read"],
        allProjects,
        projectIds: allProjects ? [] : selectedProjects,
      },
    })).unwrap()
      .then((createdKey) => {
        setCreateLoading(false);
        setCreateMode(false);
        setNewKey("");
        setTokenCopied(false);
        _fetchApiKeys();

        setTimeout(() => {
          setCreatedKey(createdKey);
        }, 500);
      })
      .catch((error) => {
        setCreateError(error.message || "The API key could not be created.");
        setCreateLoading(false);
      });
  };

  const _onRemoveConfirmation = (key) => {
    setConfirmDelete(key.id);
  };

  const _onRemoveKey = () => {
    setCreateLoading(true);
    dispatch(deleteApiKey({ team_id: team.id, keyId: confirmDelete }))
      .then(() => {
        setConfirmDelete(false);
        setCreateLoading(false);
        _fetchApiKeys();
      })
      .catch(() => setCreateLoading(false));
  };

  const _onCopyToken = () => {
    setTokenCopied(true);
    navigator.clipboard.writeText(createdKey.token);
  };

  if (!canAccess("teamAdmin", user.id, team.TeamRoles)) {
    return (
      <div className="container mx-auto">
        <Alert status="default">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>You don&apos;t have access to this page</Alert.Title>
            <Alert.Description>Please contact your team admin or change the team from the sidebar</Alert.Description>
          </Alert.Content>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-surface p-4 rounded-3xl border border-divider">
      <div className="text-lg font-semibold font-tw">Developer settings</div>
      <div className="text-sm text-gray-500">Manage your API keys and create new ones.</div>
      <div className="h-4" />
      {loading && (
        <div className="flex justify-center">
          <ProgressCircle aria-label="Loading keys">Loading keys...</ProgressCircle>
        </div>
      )}
      <div>
        <Button
          onPress={_onCreateRequested}
        >
          Create a new API Key
          <LuPlus />
        </Button>
      </div>
      <div className="h-4" />

      <Table className="shadow-none min-h-[200px]">
        <Table.ScrollContainer>
          <Table.Content
            aria-label="API keys"
            className="min-w-full even:[&_tbody>tr]:bg-content2/30"
          >
            <Table.Header>
              <Table.Column id="token" isRowHeader>
                API Tokens list
              </Table.Column>
              <Table.Column id="created" className="text-end">
                Date created
              </Table.Column>
              <Table.Column id="access">
                Access
              </Table.Column>
              <Table.Column id="permissions">
                Permissions
              </Table.Column>
              <Table.Column id="actions" className="text-end">
                <span className="sr-only">Actions</span>
              </Table.Column>
            </Table.Header>

            <Table.Body
              renderEmptyState={() => (
                <EmptyState className="flex h-full w-full min-h-[160px] flex-col items-center justify-center gap-2 text-center">
                  <LuKeyRound className="size-6 text-muted" aria-hidden />
                  <span className="text-sm text-muted">You don&apos;t have any API Keys yet</span>
                </EmptyState>
              )}
            >
              {apiKeys.map((key) => {
                const isLegacy = isLegacyApiKey(key);
                const permissionLabels = getPermissionLabels(key);

                return (
                  <Table.Row key={key.id} id={String(key.id)}>
                    <Table.Cell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{key.name}</span>
                        {isLegacy && (
                          <Tooltip delay={0}>
                            <Tooltip.Trigger>
                              <Chip color="warning" size="sm" variant="soft">
                                <LuTriangleAlert size={14} aria-hidden />
                                Legacy key
                              </Chip>
                            </Tooltip.Trigger>
                            <Tooltip.Content>
                              This key still works with existing integrations. Create a new key to use the Data API.
                            </Tooltip.Content>
                          </Tooltip>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-end">
                      {formatRelative(new Date(key.createdAt), new Date())}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="secondary">
                        {getProjectAccessLabel(key, projects)}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap gap-1">
                        {permissionLabels.length > 0 ? permissionLabels.map((label) => (
                          <Chip key={label} size="sm" variant="secondary">
                            {label}
                          </Chip>
                        )) : (
                          <Chip size="sm" variant="secondary">
                            Not available
                          </Chip>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-end">
                      <div className="flex items-center justify-end">
                        <Button
                          isIconOnly
                          variant="danger-soft"
                          onPress={() => _onRemoveConfirmation(key)}
                          size="sm"
                          aria-label={`Delete API key ${key.name}`}
                        >
                          <LuTrash />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <Modal>
        <Modal.Backdrop isOpen={!!createdKey.id} onOpenChange={(nextOpen) => { if (!nextOpen) setCreatedKey({}); }}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-xl">
              <Modal.CloseTrigger />
              <Modal.Header className="flex flex-col items-start gap-1 pr-12">
                <Modal.Heading>Your new API Key</Modal.Heading>
                <p className="text-sm font-normal text-foreground-500">
                  Copy it now. This is the only time Chartbrew shows the key.
                </p>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-5">
                <TextField className="w-full" name="created-api-key">
                  <Label>API key</Label>
                  <InputGroup variant="secondary" fullWidth>
                    <InputGroup.Input readOnly value={createdKey.token || ""} />
                    <InputGroup.Suffix className="pr-0">
                      <Button
                        aria-label={tokenCopied ? "API key copied" : "Copy API key"}
                        isIconOnly
                        onPress={_onCopyToken}
                        size="sm"
                        variant={tokenCopied ? "primary" : "tertiary"}
                      >
                        {tokenCopied ? <LuCheck /> : <LuCopy />}
                      </Button>
                    </InputGroup.Suffix>
                  </InputGroup>
                </TextField>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Close
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal>
        <Modal.Backdrop isOpen={createMode} onOpenChange={_onCreateModeChange}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-xl">
              <Modal.CloseTrigger />
              <Modal.Header className="flex flex-col items-start gap-1 pr-12">
                <Modal.Heading>Create a new API Key</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-5">
                {createError && (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{createError}</Alert.Title>
                    </Alert.Content>
                  </Alert>
                )}
                <TextField className="w-full" name="api-key-name">
                  <Label>Key name</Label>
                  <InputGroup variant="secondary" fullWidth>
                    <InputGroup.Input
                      autoFocus
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="Enter a descriptive name for your key"
                      value={newKey}
                    />
                  </InputGroup>
                </TextField>
                <RadioGroup
                  name="api-key-project-access"
                  onChange={(value) => {
                    const nextAll = value === "all";
                    setAllProjects(nextAll);
                    if (nextAll) setSelectedProjects([]);
                  }}
                  value={allProjects ? "all" : "selected"}
                >
                  <Label>Project access</Label>
                  <Radio value="all">
                    <Radio.Content>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      All projects in this team
                    </Radio.Content>
                  </Radio>
                  <Radio value="selected">
                    <Radio.Content>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      Selected projects
                    </Radio.Content>
                  </Radio>
                </RadioGroup>
                {!allProjects && (
                  <div className="flex flex-row flex-wrap items-center gap-2">
                    {projects.map((project) => (
                      <Chip
                        className="cursor-pointer rounded-sm"
                        key={project.id}
                        onClick={() => _onProjectChange(project.id, !selectedProjects.includes(project.id))}
                        variant={selectedProjects.includes(project.id) ? "primary" : "soft"}
                        color={selectedProjects.includes(project.id) ? "accent" : "default"}
                      >
                        {project.name}
                      </Chip>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  <Label>Permissions</Label>
                  <Checkbox id="api-key-read-data" isDisabled isSelected variant="secondary">
                    <Checkbox.Content>
                      <Checkbox.Control className="size-4 shrink-0">
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      Read chart and dataset data
                    </Checkbox.Content>
                  </Checkbox>
                  <Checkbox
                    id="api-key-refresh-data"
                    isSelected={allowRefresh}
                    onChange={setAllowRefresh}
                    variant="secondary"
                  >
                    <Checkbox.Content>
                      <Checkbox.Control className="size-4 shrink-0">
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      Refresh data from sources
                    </Checkbox.Content>
                  </Checkbox>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Cancel
                </Button>
                <Button
                  isDisabled={!newKey.trim() || (!allProjects && selectedProjects.length === 0)}
                  isPending={createLoading}
                  onPress={_onCreateKey}
                  variant="primary"
                >
                  Create the key
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal>
        <Modal.Backdrop isOpen={!!confirmDelete} onOpenChange={(nextOpen) => { if (!nextOpen) setConfirmDelete(false); }} variant="blur">
          <Modal.Container>
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header className="pr-12">
                <Modal.Heading>
                  Are you sure you want to delete the key?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-foreground-500">This key will lose access to Chartbrew. This action cannot be undone.</p>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Cancel
                </Button>
                <Button
                  isPending={createLoading}
                  onPress={_onRemoveKey}
                  variant="danger"
                >
                  Remove key permanently
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

export default ApiKeys;
