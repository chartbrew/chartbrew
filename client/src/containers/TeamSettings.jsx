import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import {
  Input, Spacer, Button, CircularProgress,
  Divider, Switch, Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";

import { deleteTeam, getTeam, selectTeam, selectTeams, updateTeam } from "../slices/team";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import Container from "../components/Container";
import Row from "../components/Row";
import Text from "../components/Text";
import { useParams } from "react-router";
import Segment from "../components/Segment";
import toast from "react-hot-toast";
import canAccess from "../config/canAccess";
import { selectUser } from "../slices/user";
import { LuCircleCheck, LuInfo, LuTrash } from "react-icons/lu";

/*
  Contains team update functionality
*/
function TeamSettings(props) {
  const {
    cleanErrors, style,
  } = props;

  const [loading, setLoading] = useState(false);
  const [teamState, setTeamState] = useState({ name: "" });
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState("");

  const params = useParams();
  const dispatch = useDispatch();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const teams = useSelector(selectTeams);

  useEffect(() => {
    cleanErrors();
    dispatch(getTeam(params.teamId))
      .then((teamData) => {
        setTeamState({ name: teamData.name });
      });
  }, []);

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
      <Container className={"pt-60"} justify="center">
        <Row justify="center" align="center">
          <CircularProgress aria-label="Loading" size="lg" />
        </Row>
      </Container>
    );
  }

  return (
    <div style={style}>
      <Segment className={"bg-content1"}>
        <Row>
          <Text size="h4">Team settings</Text>
        </Row>
        <Spacer y={4} />
        <div className="flex flex-col gap-2">
          <Input
            label="Team name"
            placeholder={team.name}
            name="name"
            value={teamState.name}
            onChange={(e) => {
              setTeamState({ ...teamState, name: e.target.value });
            }}
            variant="bordered"
            color={submitError ? "error" : "default"}
            description={submitError ? "Error updating team" : ""}
          />

          <div>
            <Button
              color={success ? "success" : "primary"}
              isLoading={loading}
              onPress={_onTeamUpdate}
              variant={success ? "flat" : "solid"}
              size="sm"
            >
              {success ? "Saved" : "Save"}
            </Button>
          </div>
        </div>

        <Spacer y={4} />
        <Divider />
        <Spacer y={4} />
        <div className="flex flex-row items-center gap-2">
          <Switch
            isSelected={team.showBranding}
            onValueChange={(selected) => _onToggleBranding(selected)}
          >
            Show Chartbrew branding
          </Switch>
          <Tooltip content="Chartbrew branding is shown in the footer of the dashboard reports">
            <div><LuInfo size={18} className="text-foreground" /></div>
          </Tooltip>
        </div>

        {canAccess("teamOwner", user.id, team.TeamRoles) && (
          <>
            <Spacer y={4} />
            <Divider />
            <Spacer y={4} />
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
                <Tooltip content="You cannot delete your last owned team">
                  <div><LuInfo size={18} className="text-foreground" /></div>
                </Tooltip>
              )}
            </div>
          </>
        )}
      </Segment>

      <Modal isOpen={deleteConfirm} onClose={() => setDeleteConfirm(false)} size="lg">
        <ModalContent>
          <ModalHeader className="font-bold">
            Are you sure you want to delete this team?
          </ModalHeader>
          <ModalBody>
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
                variant="bordered"
                color={deleteConfirmChecked === team.name ? "success" : "default"}
                description={`Type "${team.name}" to confirm`}
                endContent={deleteConfirmChecked === team.name && <LuCircleCheck size={18} className="text-success" />}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={() => setDeleteConfirm(false)} size="sm">
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={_onDeleteTeam}
              isLoading={deleting}
              size="sm"
              isDisabled={deleteConfirmChecked !== team.name}
            >
              Delete team
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

TeamSettings.defaultProps = {
  style: {},
};

TeamSettings.propTypes = {
  team: PropTypes.object.isRequired,
  style: PropTypes.object,
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    team: state.team.active,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(TeamSettings);
