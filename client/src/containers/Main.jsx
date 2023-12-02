import React, { useEffect, lazy, Suspense } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
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
import { getTeams, selectTeam } from "../slices/team";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import useThemeDetector from "../modules/useThemeDetector";
import Container from "../components/Container";
import { IconContext } from "react-icons";
import TeamMembers from "./TeamMembers/TeamMembers";
import TeamSettings from "./TeamSettings";
import ApiKeys from "./ApiKeys/ApiKeys";
import ProjectDashboard from "./ProjectDashboard/ProjectDashboard";
import Connections from "./Connections/Connections";
import AddChart from "./AddChart/AddChart";
import ProjectSettings from "./ProjectSettings";
import Integrations from "./Integrations/Integrations";
import Dataset from "./Dataset/Dataset";
import { getProjects } from "../slices/project";
import ConnectionWizard from "./Connections/ConnectionWizard";

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
  const { relog, cleanErrors } = props;

  const team = useSelector(selectTeam);

  const isDark = useThemeDetector();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    cleanErrors();
    if (!location.pathname.match(/\/chart\/\d+\/embedded/g)) {
      relog()
        .then((data) => {
          return dispatch(getTeams(data.id));
        })
        .then((data) => {
          return dispatch(getProjects({ team_id: data.payload?.[0]?.id }));
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
                <Route path="manage/:teamId" element={<ManageTeam />}>
                  <Route
                    path="members"
                    element={<TeamMembers />}
                  />
                  <Route
                    path="settings"
                    element={<TeamSettings />}
                  />
                  <Route
                    path="api-keys"
                    element={<ApiKeys teamId={team?.id} />}
                  />
                </Route>
                <Route
                  exact
                  path="/project/:projectId"
                  element={<ProjectRedirect />}
                />

                {/* Add all the routes for the project board here */}
                <Route path="/:teamId/:projectId" element={<ProjectBoard />}>
                  <Route
                    exact
                    path="dashboard"
                    element={<ProjectDashboard showDrafts={window.localStorage.getItem("_cb_drafts")} />}
                  />
                  <Route
                    exact
                    path="connections"
                    element={<Connections />}
                  />
                  <Route
                    exact
                    path="chart"
                    element={<AddChart />}
                  />
                  <Route
                    exact
                    path="chart/:chartId/edit"
                    element={<AddChart />}
                  />
                  <Route
                    exact
                    path="projectSettings"
                    element={<ProjectSettings />}
                  />
                  <Route
                    exact
                    path="members"
                    element={<TeamMembers />}
                  />
                  <Route
                    exact
                    path="settings"
                    element={<TeamSettings />}
                  />
                  <Route
                    exact
                    path="integrations"
                    element={<Integrations />}
                  />
                </Route>

                <Route
                  exact
                  path="/chart/:chartId/embedded"
                  element={<EmbeddedChart />}
                />
                <Route exact path="/invite" element={<UserInvite />} />

                <Route
                  exact
                  path="/:teamId/dataset/:datasetId"
                  element={<Dataset />}
                />
                <Route
                  exact
                  path="/:teamId/connection/:connectionId"
                  element={<ConnectionWizard />}
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
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = () => {
  return {
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    relog: () => dispatch(relogAction()),
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Main);
