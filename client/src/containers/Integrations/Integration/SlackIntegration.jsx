import React, { useState, useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
  Button,
  Chip,
  Input,
  Select,
  SelectItem,
  Spacer,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Switch,
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
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-semibold font-tw">
            {integration?.name}
          </div>
          <div className="text-sm text-foreground-500">
            {"Configure your Slack integration"}
          </div>
        </div>
        <Button
          variant="flat"
          color="danger"
          onPress={() => setDeleteModalOpen(true)}
          size="sm"
          startContent={<LuTrash size={18} />}
        >
          Delete Integration
        </Button>
      </div>

      <Spacer y={4} />

      <div className="flex flex-col bg-content1 p-4 rounded-lg border border-divider gap-4">
        <div className="flex flex-col gap-2">
          <div className="font-semibold">Slack Workspace</div>
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium">
                {integration?.config?.slack_team_name || "No Slack workspace"}
              </div>
              <div className="text-xs text-foreground-500">
                {"Reconnect to change the Slack workspace"}
              </div>
            </div>
          </div>
        </div>

        <Divider />

        <div className="flex flex-col gap-2">
          <div className="font-semibold">Integration Name</div>
          <Input
            label="A name to recognize this integration"
            placeholder="Slack integration name"
            fullWidth
            value={name}
            onChange={(e) => {
              setName(e.target.value.slice(0, 20))
            }}
            variant="bordered"
            required
            description={`${name?.length || 0}/20 characters`}
          />
        </div>

        <Divider />

        <div className="flex flex-col gap-2">
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="font-semibold">Allow All Channels</div>
              <div className="text-sm text-foreground-500">
                When enabled, Chartbrew can be used in all channels. When disabled, only selected channels are allowed.
              </div>
            </div>
            <Switch
              isSelected={allowAllChannels}
              onValueChange={setAllowAllChannels}
              size="sm"
            />
          </div>
        </div>

        {!allowAllChannels && (
          <div className="flex flex-col gap-2">
            <div className="font-semibold">Allowed Channels</div>
            <Select
              label="Select allowed channels"
              placeholder="Select allowed channels"
              selectionMode="multiple"
              selectedKeys={selectedChannels}
              onSelectionChange={(keys) => {
                // Convert Set to array if needed
                const selectedArray = keys instanceof Set ? Array.from(keys) : keys
                setSelectedChannels(selectedArray)
              }}
              variant="bordered"
              description="Chartbrew can only be used in these channels. To see private channels in the list, add the app to the channel in Slack first."
              isLoading={channelsLoading}
            >
              {channels.map((c) => (
                <SelectItem
                  key={c.id}
                  textValue={c.name}
                  startContent={<LuHash />}
                  endContent={c.is_private ? <Chip size="sm" color="primary" variant="flat">Private</Chip> : null}
                >
                  {c.name}
                </SelectItem>
              ))}
            </Select>
          </div>
        )}

        <Spacer y={2} />

        <div className="flex flex-row justify-end">
          <Button
            color="primary"
            onPress={handleSave}
            isLoading={loading}
            size="sm"
          >
            Save Changes
          </Button>
        </div>
      </div>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} size="xl">
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">Are you sure you want to delete this integration?</div>
          </ModalHeader>
          <ModalBody>
            <div>
              All alerts that are configured to use this integration will be disabled.
            </div>
            {deleteError && (
              <>
                <Spacer y={2} />
                <div className="text-danger text-sm">There was an error deleting the integration. Please try again.</div>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              onPress={() => setDeleteModalOpen(false)}
              variant="bordered"
              size="sm"
            >
              Close
            </Button>
            <Button
              onPress={handleDelete}
              color="danger"
              isLoading={deleteLoading}
              size="sm"
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

SlackIntegration.propTypes = {
  integration: PropTypes.object.isRequired,
}

export default SlackIntegration
