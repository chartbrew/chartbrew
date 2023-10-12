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
import TeamMembers from "./TeamMembers/TeamMembers";
import TeamSettings from "./TeamSettings";
import ApiKeys from "./ApiKeys/ApiKeys";

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
    relog, getTeams, cleanErrors, team,
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
                <Route exact path="/b/:brewName" element={<PublicDashboard />} />
                <Route
                  exact
                  path="/feedback"
                  element={(
                    <Container justify="center" className={"pt-96 pb-48"} size="sm">
                      <FeedbackForm />
                    </Container>
                  )}
                />
                <Route exact path="/signup" element={<Signup />} />
                <Route exact path="/google-auth" element={<GoogleAuth />} />
                <Route exact path="/login" element={<Login />} />
                <Route exact path="/user" element={<UserDashboard />} />
                <Route exact path="/user/profile" element={<ManageUser />} />
                <Route exact path="/edit" element={<ManageUser />} />
                <Route exact path="/passwordReset" element={<PasswordReset />} />
                <Route path="/manage/:teamId" element={<ManageTeam />}>
                  <Route
                    path="/manage/:teamId/members"
                    element={<TeamMembers />}
                  />
                  <Route
                    path="/manage/:teamId/settings"
                    element={<TeamSettings />}
                  />
                  <Route
                    path="/manage/:teamId/api-keys"
                    element={<ApiKeys teamId={team?.id} />}
                  />
                </Route>
                <Route
                  exact
                  path="/project/:projectId"
                  element={<ProjectRedirect />}
                />

                {/* Add all the routes for the project board here */}
                <Route exact path="/:teamId/:projectId" element={<ProjectBoard />} />
                <Route
                  exact
                  path="/:teamId/:projectId/connections"
                  element={<ProjectBoard />}
                />
                <Route
                  exact
                  path="/:teamId/:projectId/dashboard"
                  element={<ProjectBoard />}
                />
                <Route
                  exact
                  path="/:teamId/:projectId/chart"
                  element={<ProjectBoard />}
                />
                <Route
                  exact
                  path="/:teamId/:projectId/chart/:chartId/edit"
                  element={<ProjectBoard />}
                />
                <Route exact path="/invite" element={<UserInvite />} />
                <Route
                  exact
                  path="/:teamId/:projectId/projectSettings"
                  element={<ProjectBoard />}
                />
                <Route
                  exact
                  path="/:teamId/:projectId/members"
                  element={<ProjectBoard />}
                />
                <Route
                  exact
                  path="/:teamId/:projectId/settings"
                  element={<ProjectBoard />}
                />
                <Route
                  exact
                  path="/:teamId/:projectId/public"
                  element={<ProjectBoard />}
                />
                <Route
                  exact
                  path="/:teamId/:projectId/integrations"
                  element={<ProjectBoard />}
                />

                <Route
                  exact
                  path="/chart/:chartId/embedded"
                  element={<EmbeddedChart />}
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
  team: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user,
    team: state.team.active,
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
