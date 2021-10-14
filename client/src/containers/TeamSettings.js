import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Dimmer, Segment, Loader, Message, Form, Container, Header, Input, Checkbox, Divider
} from "semantic-ui-react";
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
      <Container text style={styles.container}>
        <Dimmer active>
          <Loader />
        </Dimmer>
      </Container>
    );
  }

  return (
    <div style={style}>
      <Header attached="top" as="h3">Team settings</Header>
      <Segment attached padded style={{ paddingBottom: 40 }}>
        <Form>
          <Form.Field>
            <label>Team name</label>
            <Input
              placeholder={team.name}
              name="name"
              value={teamState.name}
              onChange={(e, data) => {
                setTeamState({ ...teamState, name: data.value });
              }}
              action={{
                color: success ? "green" : "violet",
                labelPosition: "right",
                icon: "checkmark",
                content: success ? "Done" : "Save",
                loading,
                onClick: () => _onTeamUpdate(),
              }}
              />
            {submitError && (<Message negative> There was an error updating your team </Message>)}
          </Form.Field>
          <Form.Field>
            <Divider section />
            <Checkbox
              label={team.showBranding ? "Chartbrew branding is shown on shared charts and reports" : "Chartbrew branding is disabled"}
              toggle
              checked={team.showBranding}
              onChange={_onToggleBranding}
            />
          </Form.Field>
        </Form>
      </Segment>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
};

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
