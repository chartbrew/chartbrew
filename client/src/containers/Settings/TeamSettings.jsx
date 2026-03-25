import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Input, Button, ProgressCircle,
  Separator, Switch, Tooltip,
  Modal,
} from "@heroui/react";
import toast from "react-hot-toast";
import { LuCircleCheck, LuInfo, LuTrash } from "react-icons/lu";

import { ButtonSpinner } from "../../components/ButtonSpinner";
import { deleteTeam, selectTeam, selectTeams, updateTeam } from "../../slices/team";
import canAccess from "../../config/canAccess";
import { selectUser } from "../../slices/user";

/*
  Contains team update functionality
*/
function TeamSettings() {
  const [loading, setLoading] = useState(false);
  const [teamState, setTeamState] = useState({ name: "" });
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState("");

  const dispatch = useDispatch();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const teams = useSelector(selectTeams);

  const _onTeamUpdate = () => {
    setSubmitError(false);
    setLoading(true);
    setSuccess(false);

    dispatch(updateTeam({ team_id: team.id, data: teamState }))
      .then(() => {
        setSuccess(true);
        setLoading(false);
      })
      .catch(() => {
        setSubmitError(true);
        setLoading(false);
      });
  };

  const _onToggleBranding = async (selected) => {
    const response = await dispatch(updateTeam({ team_id: team.id, data: { showBranding: selected } }));
    if (response?.error) {
      toast.error("Error updating branding settings");
    } else {
      toast.success("Branding settings updated");
    }
  };

  const _onToggleReportExport = async (selected) => {
    const response = await dispatch(updateTeam({ team_id: team.id, data: { allowReportExport: selected } }));
    if (response?.error) {
      toast.error("Error updating report export settings");
    } else {
      toast.success("Report export settings updated");
    }
  };

  const _onToggleReportRefresh = async (selected) => {
    const response = await dispatch(updateTeam({ team_id: team.id, data: { allowReportRefresh: selected } }));
    if (response?.error) {
      toast.error("Error updating report refresh settings");
    } else {
      toast.success("Report refresh settings updated");
    }
  };

  const _teamsOwned = () => {
    // go through all the teams and get all the teams that the user is a teamOwner of
    const teamsOwned = teams.filter((t) => t.TeamRoles.some((tr) => tr.user_id === user.id && tr.role === "teamOwner"));
    return teamsOwned;
  };

  const _onDeleteTeam = async () => {
    setDeleting(true);
    const response = await dispatch(deleteTeam(team.id));
    if (response?.error) {
      toast.error("Error deleting team. Please try again.");
    } else {
      toast.success("Team deleted. Redirecting to home...");
      window.location.href = "/";
    }

    setDeleting(false);
  };

  if (!team) {
    return (
      <div className="pt-60 flex justify-center items-center">
        <ProgressCircle aria-label="Loading" size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-content1 p-4 rounded-lg border border-divider">
      <div className="text-lg font-semibold font-tw">Team settings</div>
      <div className="text-sm text-gray-500">Manage your team settings and controls</div>
      <div className="h-8" />
      <div className="flex flex-col gap-2">
        <Input
          label="Team name"
          placeholder={team.name}
          name="name"
          value={teamState.name}
          onChange={(e) => {
            setTeamState({ ...teamState, name: e.target.value });
          }}
          variant="secondary"
          isInvalid={!!submitError}
          errorMessage={submitError ? "Error updating team" : undefined}
          className="max-w-md"
        />

        <div>
          <Button
            isPending={loading}
            startContent={loading ? <ButtonSpinner /> : undefined}
            onPress={_onTeamUpdate}
            variant={success ? "secondary" : "primary"}
            size="sm"
          >
            {success ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      <div className="h-8" />
      <Separator />
      <div className="h-8" />

      <div className="flex flex-col gap-4">
        <div className="flex flex-row items-center gap-2">
          <Switch
            isSelected={team.allowReportExport}
            onValueChange={(selected) => _onToggleReportExport(selected)}
            size="sm"
          >
            Allow public exports
          </Switch>
          <Tooltip>
            <Tooltip.Trigger>
              <div><LuInfo size={18} className="text-foreground" /></div>
            </Tooltip.Trigger>
            <Tooltip.Content>Allow users to export embedded charts and reports to excel</Tooltip.Content>
          </Tooltip>
        </div>

        <div className="flex flex-row items-center gap-2">
          <Switch
            isSelected={team.allowReportRefresh}
            onValueChange={(selected) => _onToggleReportRefresh(selected)}
            size="sm"
          >
            Allow report refresh
          </Switch>
          <Tooltip>
            <Tooltip.Trigger>
              <div><LuInfo size={18} className="text-foreground" /></div>
            </Tooltip.Trigger>
            <Tooltip.Content className="max-w-sm">
              Allow report viewers to refresh data - these refreshes will query your data sources. This can greatly increase your read usage.
            </Tooltip.Content>
          </Tooltip>
        </div>

        <div className="flex flex-row items-center gap-2">
          <Switch
            isSelected={team.showBranding}
            onValueChange={(selected) => _onToggleBranding(selected)}
            size="sm"
          >
            Show Chartbrew branding
          </Switch>
          <Tooltip>
            <Tooltip.Trigger>
              <div><LuInfo size={18} className="text-foreground" /></div>
            </Tooltip.Trigger>
            <Tooltip.Content>Chartbrew branding is shown in the footer of the dashboard reports</Tooltip.Content>
          </Tooltip>
        </div>
      </div>

      {canAccess("teamOwner", user.id, team.TeamRoles) && (
        <>
          <div className="h-8" />
          <Separator />
          <div className="h-8" />
          <div className="flex flex-row items-center gap-2">
            <Button
              color="danger"
              onPress={() => setDeleteConfirm(true)}
              startContent={<LuTrash size={18} />}
              size="sm"
              isDisabled={_teamsOwned()?.length < 2}
            >
              Delete team
            </Button>
            {_teamsOwned()?.length < 2 && (
              <Tooltip>
                <Tooltip.Trigger>
                  <div><LuInfo size={18} className="text-foreground" /></div>
                </Tooltip.Trigger>
                <Tooltip.Content>You cannot delete your last owned team</Tooltip.Content>
              </Tooltip>
            )}
          </div>
        </>
      )}

      <Modal>
        <Modal.Backdrop isOpen={deleteConfirm} onOpenChange={setDeleteConfirm}>
          <Modal.Container size="lg">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading className="font-bold">
                  Are you sure you want to delete this team?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div>
                  This action is irreversible. All data associated with this team will be deleted and we will not be able to restore it.
                </div>
                <div>
                  <Input
                    label="Type the team name to confirm"
                    placeholder={team.name}
                    name="deleteConfirmChecked"
                    value={deleteConfirmChecked}
                    onChange={(e) => setDeleteConfirmChecked(e.target.value)}
                    variant="secondary"
                    description={`Type "${team.name}" to confirm`}
                    endContent={deleteConfirmChecked === team.name && <LuCircleCheck size={18} className="text-success" />}
                  />
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" slot="close" size="sm">
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onPress={_onDeleteTeam}
                  isPending={deleting}
                  size="sm"
                  isDisabled={deleteConfirmChecked !== team.name}
                >
                  Delete team
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

export default TeamSettings;
