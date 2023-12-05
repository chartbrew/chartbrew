import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch } from "react-redux";
import {
  Input, Checkbox, Spacer, Button, CircularProgress,
} from "@nextui-org/react";

import { getTeam, updateTeam } from "../slices/team";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import Container from "../components/Container";
import Row from "../components/Row";
import Text from "../components/Text";
import { useParams } from "react-router";
import Segment from "../components/Segment";

/*
  Contains team update functionality
*/
function TeamSettings(props) {
  const {
    team, cleanErrors, style,
  } = props;

  const [loading, setLoading] = useState(false);
  const [teamState, setTeamState] = useState({ name: "" });
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const params = useParams();
  const dispatch = useDispatch();

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
      <Segment className={"bg-content1"}>
        <Row>
          <Text size="h4">Team settings</Text>
        </Row>
        <Spacer y={4} />
        <Row align="center">
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

          <Spacer x={2} />

          <Button
            color={success ? "success" : "primary"}
            isLoading={loading}
            onClick={_onTeamUpdate}
            variant={success ? "flat" : "solid"}
          >
            {success ? "Saved" : "Save"}
          </Button>
        </Row>

        <Spacer y={4} />
        <Row>
          <Checkbox
            isSelected={team.showBranding}
            onChange={_onToggleBranding}
          >
            Show Chartbrew branding
          </Checkbox>
        </Row>
      </Segment>
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
