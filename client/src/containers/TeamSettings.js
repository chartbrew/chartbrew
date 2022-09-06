import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Container, Input, Checkbox, Loading, Row, Text, Spacer, Button, Divider,
} from "@nextui-org/react";

import { getTeam, updateTeam } from "../actions/team";
import { cleanErrors as cleanErrorsAction } from "../actions/error";

/*
  Contains team update functionality
*/
function TeamSettings(props) {
  const {
    team, getTeam, match, cleanErrors, style, updateTeam,
  } = props;

  const [loading, setLoading] = useState(false);
  const [teamState, setTeamState] = useState({ name: "" });
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  useEffect(() => {
    cleanErrors();
    getTeam(match.params.teamId)
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
      <Container css={{ pt: 50 }} justify="center">
        <Row justify="center" align="center">
          <Loading type="spinner" size="lg" />
        </Row>
      </Container>
    );
  }

  return (
    <div style={style}>
      <Container>
        <Row>
          <Text h3>Team settings</Text>
        </Row>
        <Spacer y={0.5} />
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
            bordered
            helperColor="error"
            helperText={submitError ? "Error updating team" : ""}
            action={{
              color: success ? "green" : "violet",
              labelPosition: "right",
              icon: "checkmark",
              content: success ? "Done" : "Save",
              loading,
              onClick: () => _onTeamUpdate(),
            }}
          />
        </Row>
        <Spacer y={0.5} />
        <Row>
          <Button
            color={success ? "success" : "primary"}
            disabled={loading}
            onClick={_onTeamUpdate}
            auto
          >
            {success ? "Saved" : "Save"}
          </Button>
        </Row>
        <Spacer y={1} />
        <Divider />
        <Spacer y={1} />
        <Row>
          <Checkbox
            label={team.showBranding ? "Chartbrew branding is shown on shared charts and reports" : "Chartbrew branding is disabled"}
            isSelected={team.showBranding}
            onChange={_onToggleBranding}
            size="sm"
          />
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
  match: PropTypes.object.isRequired,
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

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(TeamSettings));
