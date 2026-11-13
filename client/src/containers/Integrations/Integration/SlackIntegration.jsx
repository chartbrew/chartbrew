import React, { useState, useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
  Button,
  Chip,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  Separator,
  Modal,
  Switch,
  TextField,
} from "@heroui/react"
import { LuHash, LuTrash } from "react-icons/lu"
import toast from "react-hot-toast"
import PropTypes from "prop-types"
import { useNavigate } from "react-router"

import {
  updateIntegration,
  getTeamIntegrations,
  getIntegrationChannels,
  deleteIntegration,
} from "../../../slices/integration"
import { ButtonSpinner } from "../../../components/ButtonSpinner"
import { API_HOST } from "../../../config/settings"
import { getAuthToken } from "../../../modules/auth"
import SlackConversations from "./SlackConversations"
import { selectTeam } from "../../../slices/team"

function SlackIntegration({ integration }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const team = useSelector(selectTeam)
  const [name, setName] = useState(integration?.name || "")
  const [selectedChannels, setSelectedChannels] = useState([])
  const [allowAllChannels, setAllowAllChannels] = useState(
    integration?.config?.allowAllChannels ?? false
  )
  const [accessMode, setAccessMode] = useState(integration.config?.accessMode || "admins-only")
  const [allowAllDashboards, setAllowAllDashboards] = useState(integration.config?.allowAllDashboards ?? false)
  const [dashboardIds, setDashboardIds] = useState(integration.config?.dashboardIds || [])
  const [dashboards, setDashboards] = useState([])
  const [dashboardError, setDashboardError] = useState(false)
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(false)
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState(false)

  useEffect(() => {
    if (integration?.config?.allowedChannels) {
      setSelectedChannels(integration.config.allowedChannels)
    }
    if (integration?.config?.allowAllChannels !== undefined) {
      setAllowAllChannels(integration.config.allowAllChannels)
    }
  }, [integration])

  useEffect(() => {
    if (integration?.id && team?.id) {
      setChannelsLoading(true)
      dispatch(getIntegrationChannels({ integration_id: integration.id, team_id: team.id }))
        .then((data) => {
          setChannelsLoading(false)
          if (data?.error) {
            toast.error("There was an error getting the channels. Please try again.")
            return
          }

          if (data?.payload) {
            setChannels(data?.payload)
          }
        })
        .catch(() => {
          setChannelsLoading(false)
          toast.error("There was an error getting the channels. Please try again.")
        })
    }
  }, [integration?.id, team?.id, dispatch])

  useEffect(() => {
    const controller = new AbortController()
    setDashboardError(false)
    fetch(`${API_HOST}/apps/slack/${integration.id}/dashboards`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` }, signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error()
      const result = await response.json()
      if (!controller.signal.aborted) setDashboards(result)
    }).catch(() => { if (!controller.signal.aborted) setDashboardError(true) })
    return () => controller.abort()
  }, [integration.id])

  const updateSlackAccess = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_HOST}/apps/slack/${integration.id}/upgrade`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
      if (!response.ok) throw new Error("Slack access could not be updated. Try again.")
      const result = await response.json()
      window.location.assign(result.url)
    } catch (error) {
      toast.error(error.message)
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (name === "") {
      toast.error("Name cannot be empty")
      return
    }

    const updateData = {
      name: name,
    }

    // Update config with allowedChannels and allowAllChannels
    const currentConfig = integration?.config || {}
    const newConfig = { ...currentConfig }
    
    newConfig.allowAllChannels = allowAllChannels
    newConfig.accessMode = accessMode
    newConfig.dashboardIds = dashboardIds
    newConfig.allowAllDashboards = allowAllDashboards
    
    if (selectedChannels.length > 0) {
      newConfig.allowedChannels = selectedChannels
    } else {
      // If no channels selected, remove allowedChannels from config
      delete newConfig.allowedChannels
    }
    
    updateData.config = newConfig

    setLoading(true)
    dispatch(updateIntegration({
      team_id: team?.id,
      integration_id: integration?.id,
      data: updateData,
    }))
      .then((data) => {
        setLoading(false)
        if (data?.error) {
          toast.error("There was an error updating the integration. Please try again.")
        } else {
          toast.success("Integration updated successfully")
          dispatch(getTeamIntegrations({ team_id: team?.id }))
        }
      })
      .catch(() => {
        setLoading(false)
        toast.error("There was an error updating the integration. Please try again.")
      })
  }

  const handleDelete = () => {
    setDeleteLoading(true)
    setDeleteError(false)
    dispatch(deleteIntegration({
      team_id: team?.id,
      integration_id: integration?.id,
    }))
      .then((data) => {
        setDeleteLoading(false)
        if (data?.error) {
          setDeleteError(true)
        } else {
          toast.success("Integration deleted successfully")
          dispatch(getTeamIntegrations({ team_id: team?.id }))
          navigate("/integrations")
        }
      })
      .catch(() => {
        setDeleteLoading(false)
        setDeleteError(true)
      })
  }

  return (
    <div className="flex flex-col">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold font-tight">{integration?.name}</h1>
        <Button variant="tertiary" color="danger" onPress={() => setDeleteModalOpen(true)} size="sm">
          <LuTrash size={18} />
          Delete integration
        </Button>
      </div>

      <div className="flex flex-col gap-6 rounded-3xl border border-divider bg-surface p-6">
        <section aria-labelledby="slack-connection-heading" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="slack-connection-heading" className="text-lg font-semibold">Connection</h2>
              <p className="text-sm text-muted">{integration?.config?.slack_team_name || "No Slack workspace"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onPress={() => navigate("/integrations/slack/account")}>
                Your Slack account
              </Button>
              <Button variant="secondary" size="sm" onPress={updateSlackAccess} isPending={loading}>
                Update Slack access
              </Button>
            </div>
          </div>
          <TextField value={name} onChange={(value) => setName(value.slice(0, 20))} isRequired className="max-w-lg">
            <Label>Integration name</Label>
            <Input variant="secondary" placeholder="Slack integration name" maxLength={20} />
          </TextField>
        </section>

        <Separator />

        <section aria-labelledby="slack-access-heading" className="flex flex-col gap-5">
          <h2 id="slack-access-heading" className="text-lg font-semibold">Access</h2>
          <div className="flex flex-col gap-2">
            <Select value={accessMode} onChange={setAccessMode} variant="secondary" className="max-w-lg">
              <Label>Who can ask questions</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {[
                    ["admins-only", "Owners and admins"], ["team", "Team members"],
                    ["team-and-clients", "Team members and clients"], ["everyone", "Everyone in allowed channels"],
                  ].map(([id, label]) => (
                    <ListBox.Item key={id} id={id} textValue={label}>
                      {label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <p className="text-sm text-muted">
              {accessMode === "everyone"
                ? "No account link is required. Anyone in allowed channels can read the available dashboards."
                : "A linked Chartbrew account is required."}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            <section aria-labelledby="slack-channels-heading" className="flex min-w-0 flex-col gap-3">
              <h3 id="slack-channels-heading" className="font-semibold">Channels</h3>
              <Switch isSelected={allowAllChannels} onChange={setAllowAllChannels} size="md" className="self-start">
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Label>Allow all channels</Label>
                </Switch.Content>
              </Switch>
              {!allowAllChannels && (
                <div className="flex flex-col gap-2">
                  <Select
                    placeholder="Select allowed channels"
                    selectionMode="multiple"
                    value={selectedChannels}
                    onChange={(value) => {
                      setSelectedChannels(value || [])
                    }}
                    variant="secondary"
                    isPending={channelsLoading}
                  >
                    <Label>Selected channels</Label>
                    <Select.Trigger className="h-auto min-h-10 py-2">
                      <Select.Value className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                        {({ defaultChildren, isPlaceholder, state }) => isPlaceholder ? defaultChildren : (
                          state.selectedItems.map((item) => (
                            <Chip key={item.key} color="accent" variant="soft" size="sm" className="max-w-full">
                              <LuHash className="size-3 shrink-0" aria-hidden="true" />
                              <span className="truncate">{item.textValue}</span>
                            </Chip>
                          ))
                        )}
                      </Select.Value>
                      <Select.Indicator className="shrink-0" />
                    </Select.Trigger>
                    <Description>For private channels, add Chartbrew to the channel in Slack first.</Description>
                    <Select.Popover>
                      <ListBox selectionMode="multiple">
                        {channels.map((c) => (
                          <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                            <div className="flex flex-row items-center gap-2">
                              <LuHash className="size-3 shrink-0" aria-hidden="true" />
                              <span>{c.name}</span>
                              {c.is_private ? <Chip size="sm" variant="primary">Private</Chip> : null}
                            </div>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              )}

              <p className="text-sm text-muted">Replies are visible to everyone who can read the channel.</p>
            </section>
            <section aria-labelledby="slack-dashboards-heading" className="flex min-w-0 flex-col gap-3">
              <h3 id="slack-dashboards-heading" className="font-semibold">Dashboards</h3>
              <Switch isSelected={allowAllDashboards} onChange={setAllowAllDashboards} size="md" className="self-start" aria-describedby="allow-all-dashboards-description">
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Label>Allow all dashboards</Label>
                </Switch.Content>
              </Switch>
              {!allowAllDashboards && (
                <>
                  <Select selectionMode="multiple" value={dashboardIds} onChange={setDashboardIds} variant="secondary" placeholder="Select dashboards">
                    <Label>Selected dashboards</Label>
                    <Select.Trigger className="h-auto min-h-10 py-2">
                      <Select.Value className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                        {({ defaultChildren, isPlaceholder, state }) => isPlaceholder ? defaultChildren : state.selectedItems.map((item) => (
                          <Chip key={item.key} color="accent" variant="soft" size="sm">{item.textValue}</Chip>
                        ))}
                      </Select.Value>
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {dashboards.map((dashboard) => (
                          <ListBox.Item key={dashboard.id} id={dashboard.id} textValue={dashboard.name}>
                            {dashboard.name}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  {dashboardError && <p role="alert" className="text-sm text-danger">Dashboards could not load. Reload this page to try again.</p>}
                  {dashboardIds.length === 0 && <p className="text-sm">Select at least one dashboard to allow data access.</p>}
                </>
              )}

              <p id="allow-all-dashboards-description" className="text-sm text-muted">Includes new dashboards automatically when enabled.</p>
              <p className="text-sm text-muted">Linked users can only access dashboards permitted by their Chartbrew account.</p>
            </section>
          </div>
        </section>

        <Separator />
        <div className="flex flex-row justify-end">
          <Button
            color="primary"
            onPress={handleSave}
            isPending={loading}
            size="sm"
          >
            {loading ? <ButtonSpinner /> : null}
            Save Changes
          </Button>
        </div>
      </div>

      <SlackConversations key={integration.id} integrationId={integration.id} channels={channels} />

      <Modal.Backdrop isOpen={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <Modal.Container size="xl">
          <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>Are you sure you want to delete this integration?</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div>
              All alerts that are configured to use this integration will be disabled.
            </div>
            {deleteError && (
              <>
                <div className="h-2" />
                <div className="text-danger text-sm">There was an error deleting the integration. Please try again.</div>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              onPress={() => setDeleteModalOpen(false)}
              variant="secondary"
              size="sm"
            >
              Close
            </Button>
            <Button
              onPress={handleDelete}
              color="danger"
              isPending={deleteLoading}
              size="sm"
            >
              Delete
            </Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  )
}

SlackIntegration.propTypes = {
  integration: PropTypes.object.isRequired,
}

export default SlackIntegration
