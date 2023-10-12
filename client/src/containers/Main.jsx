import React, { useEffect, lazy, Suspense } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Route, Routes, useLocation, useNavigate } from "react-router";
import { semanticColors } from "@nextui-org/theme";
import { createMedia } from "@artsy/fresnel";
import { Helmet } from "react-helmet";

import SuspenseLoader from "../components/SuspenseLoader";
import UserDashboard from "./UserDashboard";

import {
  relog as relogAction,
  areThereAnyUsers,
} from "../actions/user";
import { getTeams } from "../actions/team";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import useThemeDetector from "../modules/useThemeDetector";
import Container from "../components/Container";
import { IconContext } from "react-icons";

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
const ProjectRedirect = lazy(() => import("./ProjectRedirect"));

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
    relog, getTeams, cleanErrors,
  } = props;

  const isDark = useThemeDetector();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    cleanErrors();
    if (!location.pathname.match(/\/chart\/\d+\/embedded/g)) {
      relog().then((data) => {
        getTeams(data.id);
      });

      areThereAnyUsers()
        .then((anyUsers) => {
          if (!anyUsers) navigate("/signup");
        });
    }
  }, []);

  return (
    <IconContext.Provider value={{ className: "react-icons", size: 20, style: { opacity: 0.8 } }}>
      <div style={styles.container}>
        <Helmet>
          {isDark && (
            <style type="text/css">
              {`
                .rdrDateRangePickerWrapper, .rdrDefinedRangesWrapper, .rdrStaticRanges .rdrStaticRange,
                .rdrDateDisplayWrapper, .rdrMonthAndYearWrapper, .rdrMonths, .rdrDefinedRangesWrapper
                {
                  background-color: ${semanticColors.dark.content1.DEFAULT};
                  background: ${semanticColors.dark.content1.DEFAULT};
                }

                .rdrStaticRange:hover, .rdrStaticRangeLabel:hover {
                  background: ${semanticColors.dark.content2.DEFAULT};
                }

                .rdrInputRange span {
                  color: ${semanticColors.dark.default[800]};
                }

                .rdrDay span {
                  color: ${semanticColors.dark.default[800]};
                }

                .rdrMonthPicker select, .rdrYearPicker select {
                  color: ${semanticColors.dark.default[800]};
                }

                .rdrDateInput, .rdrInputRangeInput {
                  background-color: ${semanticColors.dark.content3.DEFAULT};
                  color: ${semanticColors.dark.default[800]};
                }
              `}
            </style>
          )}
        </Helmet>
        <style>{mediaStyles}</style>
        <MediaContextProvider>
          <div>
            <Suspense fallback={<SuspenseLoader />}>
              <Routes>
                <Route exact path="/" element={<UserDashboard />} />
                <Route exact path="/b/:brewName" component={PublicDashboard} />
                <Route
                  exact
                  path="/feedback"
                  render={() => (
                    <Container justify="center" className={"pt-96 pb-48"} size="sm">
                      <FeedbackForm />
                    </Container>
                  )}
                />
                <Route exact path="/manage/:teamId" component={ManageTeam} />
                <Route exact path="/signup" component={Signup} />
                <Route exact path="/google-auth" component={GoogleAuth} />
                <Route exact path="/login" component={Login} />
                <Route exact path="/user" element={<UserDashboard />} />
                <Route exact path="/profile" component={ManageUser} />
                <Route exact path="/edit" component={ManageUser} />
                <Route exact path="/passwordReset" component={PasswordReset} />
                <Route
                  exact
                  path="/project/:projectId"
                  component={ProjectRedirect}
                />
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

                {/* Add all the routes for the project board here */}
                <Route exact path="/:teamId/:projectId" component={ProjectBoard} />
                <Route
                  exact
                  path="/:teamId/:projectId/connections"
                  component={ProjectBoard}
                />
                <Route
                  exact
                  path="/:teamId/:projectId/dashboard"
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
                  path="/:teamId/:projectId/integrations"
                  component={ProjectBoard}
                />

                <Route
                  exact
                  path="/chart/:chartId/embedded"
                  component={EmbeddedChart}
                />
              </Routes>
            </Suspense>
          </div>
        </MediaContextProvider>
      </div>
    </IconContext.Provider>
  );
}

const styles = {
  container: {
    flex: 1,
  },
};

Main.propTypes = {
  relog: PropTypes.func.isRequired,
  getTeams: PropTypes.func.isRequired,
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    relog: () => dispatch(relogAction()),
    getTeams: (id) => dispatch(getTeams(id)),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Main);
