import React, { useEffect, lazy, Suspense } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Route, Switch, withRouter } from "react-router";
import { Container, useTheme } from "@nextui-org/react";
import { createMedia } from "@artsy/fresnel";
import { Helmet } from "react-helmet";

import SuspenseLoader from "../components/SuspenseLoader";
import UserDashboard from "./UserDashboard";

import { relog, getUser, areThereAnyUsers } from "../actions/user";
import { getTeams } from "../actions/team";
import { cleanErrors as cleanErrorsAction } from "../actions/error";

const ProjectBoard = lazy(() => import("./ProjectBoard/ProjectBoard"));
const Signup = lazy(() => import("./Signup"));
const Login = lazy(() => import("./Login"));
const ManageTeam = lazy(() => import("./ManageTeam"));
const UserInvite = lazy(() => import("./UserInvite"));
const ManageUser = lazy(() => import("./ManageUser"));
const FeedbackForm = lazy(() => import("../components/FeedbackForm"));
const PublicDashboard = lazy(() => import("./PublicDashboard/PublicDashboard"));
const PasswordReset = lazy(() => import("./PasswordReset"));
const EmbeddedChart = lazy(() => import("./EmbeddedChart"));
const GoogleAuth = lazy(() => import("./GoogleAuth"));
const Start = lazy(() => import("./Start/Start"));

const AppMedia = createMedia({
  breakpoints: {
    mobile: 0,
    tablet: 768,
    computer: 1024,
  },
});
const mediaStyles = AppMedia.createMediaStyle();
const { MediaContextProvider } = AppMedia;

/*
  The main component where the entire app routing resides
*/
function Main(props) {
  const {
    relog, getUser, getTeams, location, cleanErrors, history,
  } = props;

  const { isDark, theme } = useTheme();

  useEffect(() => {
    cleanErrors();
    if (!location.pathname.match(/\/chart\/\d+\/embedded/g)) {
      relog().then((data) => {
        getUser(data.id);
        getTeams(data.id);
      });

      areThereAnyUsers()
        .then((anyUsers) => {
          if (!anyUsers) history.push("/signup");
        });
    }
  }, []);

  return (
    <div style={styles.container}>
      <Helmet>
        {isDark && (
          <style type="text/css">
            {`
              .rdrDateRangePickerWrapper, .rdrDefinedRangesWrapper, .rdrStaticRanges .rdrStaticRange,
              .rdrDateDisplayWrapper, .rdrMonthAndYearWrapper, .rdrMonths, .rdrDefinedRangesWrapper
              {
                background-color: ${theme.colors.backgroundContrast.value};
                background: ${theme.colors.backgroundContrast.value};
              }

              .rdrStaticRange:hover, .rdrStaticRangeLabel:hover {
                background: ${theme.colors.background.value};
              }

              .rdrInputRange span {
                color: ${theme.colors.text.value};
              }

              .rdrDay span {
                color: ${theme.colors.text.value};
              }

              .rdrMonthPicker select, .rdrYearPicker select {
                color: ${theme.colors.text.value};
              }

              .rdrDateInput, .rdrInputRangeInput {
                background-color: ${theme.colors.accents0.value};
                color: ${theme.colors.text.value};
              }
            `}
          </style>
        )}
      </Helmet>
      <style>{mediaStyles}</style>
      <MediaContextProvider>
        <div>
          <Suspense fallback={<SuspenseLoader />}>
            <Switch>
              <Route exact path="/" component={UserDashboard} />
              <Route exact path="/b/:brewName" component={PublicDashboard} />
              <Route
                exact
                path="/feedback"
                render={() => (
                  <Container justify="center" css={{ pt: 100, pb: 50 }} sm>
                    <FeedbackForm />
                  </Container>
                )}
              />
              <Route exact path="/manage/:teamId" component={ManageTeam} />
              <Route exact path="/:teamId/:projectId" component={ProjectBoard} />
              <Route exact path="/signup" component={Signup} />
              <Route exact path="/google-auth" component={GoogleAuth} />
              <Route exact path="/login" component={Login} />
              <Route exact path="/user" component={UserDashboard} />
              <Route exact path="/profile" component={ManageUser} />
              <Route exact path="/edit" component={ManageUser} />
              <Route exact path="/passwordReset" component={PasswordReset} />
              <Route
                exact
                path="/manage/:teamId/members"
                component={ManageTeam}
              />
              <Route
                exact
                path="/manage/:teamId/settings"
                component={ManageTeam}
              />
              <Route
                exact
                path="/manage/:teamId/api-keys"
                component={ManageTeam}
              />
              <Route
                exact
                path="/:teamId/:projectId/dashboard"
                component={ProjectBoard}
              />
              <Route
                exact
                path="/:teamId/:projectId/connections"
                component={ProjectBoard}
              />
              <Route
                exact
                path="/:teamId/:projectId/chart"
                component={ProjectBoard}
              />
              <Route
                exact
                path="/:teamId/:projectId/chart/:chartId/edit"
                component={ProjectBoard}
              />
              <Route exact path="/invite" component={UserInvite} />
              <Route
                exact
                path="/:teamId/:projectId/projectSettings"
                component={ProjectBoard}
              />
              <Route
                exact
                path="/:teamId/:projectId/members"
                component={ProjectBoard}
              />
              <Route
                exact
                path="/:teamId/:projectId/settings"
                component={ProjectBoard}
              />
              <Route
                exact
                path="/:teamId/:projectId/public"
                component={ProjectBoard}
              />
              <Route
                exact
                path="/chart/:chartId/embedded"
                component={EmbeddedChart}
              />
              <Route
                exact
                path="/start"
                component={Start}
              />
            </Switch>
          </Suspense>
        </div>
      </MediaContextProvider>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
};

Main.propTypes = {
  relog: PropTypes.func.isRequired,
  getUser: PropTypes.func.isRequired,
  getTeams: PropTypes.func.isRequired,
  location: PropTypes.object.isRequired,
  cleanErrors: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    relog: () => dispatch(relog()),
    getUser: (id) => dispatch(getUser(id)),
    getTeams: (id) => dispatch(getTeams(id)),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Main));
