import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Input, Checkbox, Spacer, Button, Divider, CircularProgress,
} from "@nextui-org/react";

import { getTeam, updateTeam } from "../actions/team";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import Container from "../components/Container";
import Row from "../components/Row";
import Text from "../components/Text";
import { useParams } from "react-router";

/*
  Contains team update functionality
*/
function TeamSettings(props) {
  const {
    team, getTeam, cleanErrors, style, updateTeam,
  } = props;

  const [loading, setLoading] = useState(false);
  const [teamState, setTeamState] = useState({ name: "" });
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const params = useParams();

  useEffect(() => {
    cleanErrors();
    getTeam(params.teamId)
      .then((teamData) => {
        setTeamState({ name: teamData.name });
      });
  }, []);

  const _onTeamUpdate = () => {
    setSubmitError(false);
    setLoading(true);
    setSuccess(false);

    updateTeam(team.id, teamState)
      .then(() => {
        setSuccess(true);
        setLoading(false);
      })
      .catch(() => {
        setSubmitError(true);
        setLoading(false);
      });
  };

  const _onToggleBranding = () => {
    updateTeam(team.id, { showBranding: !team.showBranding });
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
      <Container>
        <Row>
          <Text size="h3">Team settings</Text>
        </Row>
        <Spacer y={4} />
        <Row>
          <Input
            label="Team name"
            placeholder={team.name}
            name="name"
            value={teamState.name}
            onChange={(e) => {
              setTeamState({ ...teamState, name: e.target.value });
            }}
            fullWidth
            variant="bordered"
            color={submitError ? "error" : "default"}
            description={submitError ? "Error updating team" : ""}
          />
        </Row>
        <Spacer y={1} />
        <Row>
          <Button
            color={success ? "success" : "primary"}
            isLoading={loading}
            onClick={_onTeamUpdate}
            variant={success ? "flat" : "solid"}
          >
            {success ? "Saved" : "Save"}
          </Button>
        </Row>
        <Spacer y={2} />
        <Divider />
        <Spacer y={2} />
        <Row>
          <Checkbox
            isSelected={team.showBranding}
            onChange={_onToggleBranding}
            size="sm"
          >
            Show Chartbrew branding
          </Checkbox>
        </Row>
      </Container>
    </div>
  );
}

TeamSettings.defaultProps = {
  style: {},
};

TeamSettings.propTypes = {
  getTeam: PropTypes.func.isRequired,
  team: PropTypes.object.isRequired,
  updateTeam: PropTypes.func.isRequired,
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
    getTeam: id => dispatch(getTeam(id)),
    updateTeam: (teamId, data) => dispatch(updateTeam(teamId, data)),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(TeamSettings);
