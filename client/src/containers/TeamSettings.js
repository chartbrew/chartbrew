import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Dimmer, Segment, Loader, Divider, Message, Icon, Form, Container, Header
} from "semantic-ui-react";
import { getTeam, updateTeam } from "../actions/team";
import { cleanErrors as cleanErrorsAction } from "../actions/error";

/*
  Contains team update functionality
*/
class TeamSettings extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      teamState: {
        name: ""
      },
      success: false,
      btnIcon: "arrow right",
    };
  }

  componentDidMount() {
    const { getTeam, match, cleanErrors } = this.props;
    cleanErrors();
    getTeam(match.params.teamId)
      .then((team) => {
        this.setState({ teamState: { name: team.name } });
      });
  }

  _onTeamUpdate = () => {
    const { updateTeam, team } = this.props;
    const { teamState } = this.state;
    this.setState({
      submitError: false, loading: true, success: false, btnIcon: "arrow right"
    });
    updateTeam(team.id, teamState)
      .then(() => {
        this.setState({ success: true, loading: false, btnIcon: "check" });
      })
      .catch(() => {
        this.setState({ submitError: true, loading: false });
      });
  }

  render() {
    const { team, style } = this.props;
    const {
      teamState, submitError, btnIcon, loading, success,
    } = this.state;

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
        <Segment raised attached>
          <Container>
            <Form onSubmit={this._onTeamUpdate}>
              <Form.Input
                label="Team name"
                placeholder={team.name}
                name="name"
                value={teamState.name}
                onChange={(e, data) => this.setState({
                  teamState: { ...teamState, name: data.value }
                })} />
              {submitError
              && (
              <Container textAlign="center" style={{ margin: "1em" }}>
                <Message negative> There was an error updating your team </Message>
              </Container>
              )}
              <Form.Button
                loading={loading}
                icon
                disabled={!teamState.name}
                type="submit"
                floated="right"
                compact
                size="large"
                color={success ? "green" : "primary"}
                labelPosition="right">
                {success ? "Saved" : "Save" }
                <Icon name={btnIcon} />
              </Form.Button>
              <Divider hidden section />
            </Form>
          </Container>
        </Segment>
      </div>
    );
  }
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
