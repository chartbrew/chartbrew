import React, { useEffect, lazy, Suspense, useRef } from "react";
import PropTypes from "prop-types";
import { connect, useDispatch, useSelector } from "react-redux";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { semanticColors } from "../lib/themeTokens";
import { Helmet } from "react-helmet-async";

import SuspenseLoader from "../components/SuspenseLoader";
import UserDashboard from "./UserDashboard/UserDashboard";

import {
  relog, areThereAnyUsers,
  selectUser,
} from "../slices/user";
import { getTeams, saveActiveTeam, selectTeam, selectTeams } from "../slices/team";
import { selectFeedbackModalOpen, hideFeedbackModal, selectAiModalOpen, hideAiModal, toggleAiModal, setActiveAiConversation } from "../slices/ui";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import { useTheme } from "../modules/ThemeContext";
import { IconContext } from "react-icons";
import ProjectDashboard from "./ProjectDashboard/ProjectDashboard";
import AddChart from "./AddChart/AddChart";
import ProjectSettings from "./ProjectSettings";
import Integrations from "./Integrations/Integrations";
import Dataset from "./Dataset/Dataset";
// import { getProjects } from "../slices/project";
import ConnectionWizard from "./Connections/ConnectionWizard";
import ConnectionTemplates from "./Connections/ConnectionTemplates";
import { Toaster } from "react-hot-toast";
import ConnectionList from "./UserDashboard/ConnectionList";
import DatasetList from "./UserDashboard/DatasetList";
import DashboardList from "./UserDashboard/DashboardList";
import Home from "./Home/Home";
import Activity from "./Activity/Activity";
import ObservationDetail from "./Observation/ObservationDetail";
import { getDatasets } from "../slices/dataset";
import { getTeamConnections } from "../slices/connection";
import SharedChart from "./SharedChart";
import Report from "./PublicDashboard/Report";
import { Button, Modal } from "@heroui/react";

const ProjectBoard = lazy(() => import("./ProjectBoard/ProjectBoard"));
const Signup = lazy(() => import("./Signup"));
const Login = lazy(() => import("./Login"));
const McpConsent = lazy(() => import("./McpConsent"));
const ChartPreviewPage = lazy(() => import("./Ai/ChartPreviewPage"));
const ManageTeam = lazy(() => import("./Settings/ManageTeam"));
const UserInvite = lazy(() => import("./UserInvite"));
const PublicDashboard = lazy(() => import("./PublicDashboard/PublicDashboard"));
const PasswordReset = lazy(() => import("./PasswordReset"));
const EmbeddedChart = lazy(() => import("./EmbeddedChart"));
const GoogleAuth = lazy(() => import("./GoogleAuth"));
const ProjectRedirect = lazy(() => import("./ProjectRedirect"));
const Onboarding = lazy(() => import("./Onboarding/Onboarding"));
import FeedbackForm from "../components/FeedbackForm";
import canAccess from "../config/canAccess";
import AiModal from "./Ai/AiModal";
import ActiveConversationBar from "./Ai/ActiveConversationBar";
import Auth from "./Integrations/Auth/Auth";
import SlackCallback from "./Integrations/Auth/SlackCallback";
import Integration from "./Integrations/Integration/Integration";
import NoAccessPage from "../components/NoAccessPage";
import { shouldResumeOnboarding } from "./Onboarding/onboardingState";

function authenticatePage() {
  const preview = window.location.pathname.match(/^\/previews\/([1-9]\d*)$/);
  if (preview) {
    window.location.href = `/login?preview=${preview[1]}`;
    return false;
  }
  if (window.location.pathname === "/oauth/consent") return false;
  if (window.location.pathname === "/login") {
    return false;
  } else if (window.location.pathname === "/signup") {
    return false;
  } else if (window.location.pathname.indexOf("/b/") > -1) {
    return false;
  } else if (window.location.pathname.indexOf("/report/") > -1) {
    return false;
  } else if (window.location.pathname === "/passwordReset") {
    return false;
  } else if (window.location.pathname === "/invite") {
    return false;
  } else if (window.location.pathname === "/feedback") {
    return false;
  } else if (window.location.pathname.indexOf("embedded") > -1) {
    return false;
  } else if (window.location.pathname.indexOf("/share") > -1) {
    return false;
  }

  window.location.pathname = "/login";
  return true;
}

/*
  The main component where the entire app routing resides
*/
function Main(props) {
  const { cleanErrors } = props;

  const user = useSelector(selectUser);
  const team = useSelector(selectTeam);
  const teams = useSelector(selectTeams);
  const feedbackModal = useSelector(selectFeedbackModalOpen);
  const aiModalOpen = useSelector(selectAiModalOpen);
  const teamsRef = useRef(null);
  const oauthReturnRef = useRef(null);

  const { isDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { pathname } = useLocation();

  useEffect(() => {
    if (isDark) {
      document.body.classList.add("dark");
      document.body.classList.remove("light");
    } else {
      document.body.classList.add("light");
      document.body.classList.remove("dark");
    }
  }, [isDark]);

  useEffect(() => {
    cleanErrors();
    if (!location.pathname.match(/\/chart\/\d+\/embedded/g)) {
      dispatch(relog())
        .then((data) => {
          if (data.payload?.id) {
            return dispatch(getTeams());
          }

          if (authenticatePage()) {
            window.location.pathname = "/login";
          }

          return null;
        })
        .then(() => {
          // return dispatch(getProjects({ team_id: data.payload?.[0]?.id }));
        });

      dispatch(areThereAnyUsers())
        .then((anyUsers) => {
          if (!anyUsers?.payload?.areThereAnyUsers && (pathname === "/login" || pathname === "/")) {
            navigate("/signup");
          }
        });
    }

    // Keyboard shortcut for AI modal (Cmd+K on Mac, Ctrl+K on Windows)
    const handleKeyDown = (event) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        // Prevent default browser behavior (usually search)
        event.preventDefault();
        dispatch(toggleAiModal());
      }
    };

    // Add event listener
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup event listener
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (teams && teams.length > 0 && !teamsRef.current) {
      teamsRef.current = true;

      const storageActiveTeam = window.localStorage.getItem("__cb_active_team");
      let selectedTeam = teams.find((t) => t.TeamRoles.find((tr) => tr.role === "teamOwner" && tr.user_id === user.id));
      if (storageActiveTeam) {
        const storageTeam = teams.find((t) => `${t.id}` === `${storageActiveTeam}`);
        if (storageTeam) selectedTeam = storageTeam;
      }

      if (selectedTeam) {
        dispatch(saveActiveTeam(selectedTeam));
        if (shouldResumeOnboarding(selectedTeam, user.id) && location.pathname !== "/start" && location.pathname !== "/oauth/consent"
          && !new URLSearchParams(location.search).has("oauthRequest")
          && !new URLSearchParams(location.search).has("aiConversationId")) {
          navigate(`/start?team=${selectedTeam.id}`, { replace: true });
          return;
        }
        dispatch(getTeamConnections({ team_id: selectedTeam.id }));
        dispatch(getDatasets({ team_id: selectedTeam.id }));
      }
    }
  }, [teams]);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const conversationId = query.get("aiConversationId");
    const returnTeam = teams?.find((item) => String(item.id) === query.get("aiTeamId"));
    if (!conversationId || !returnTeam || !user?.id) return;
    const returnKey = `${user.id}:${location.pathname}${location.search}`;
    if (oauthReturnRef.current === returnKey) return;
    oauthReturnRef.current = returnKey;
    if (String(team?.id) !== String(returnTeam.id)) {
      dispatch(saveActiveTeam(returnTeam));
    }
    dispatch(hideAiModal());
    dispatch(setActiveAiConversation({
      id: conversationId, key: conversationId, userId: user.id,
      teamId: returnTeam.id, title: "Continue conversation",
    }));
    query.delete("aiConversationId");
    query.delete("aiTeamId");
    navigate({ pathname: location.pathname, search: query.toString() }, { replace: true });
  }, [dispatch, location.pathname, location.search, team?.id, teams, user?.id]);

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
        <div>
          <Suspense fallback={<SuspenseLoader />}>
            <Routes>
              <Route path="/" element={<UserDashboard />}>
                <Route index element={<Home />} />
                <Route path="dashboards" element={<DashboardList />} />
                <Route path="activity" element={<Activity />} />
                <Route path="activity/:observationId" element={<ObservationDetail />} />
                <Route path="connections" element={<ConnectionList />} />
                <Route path="connections/:connectionId" element={<ConnectionWizard />} />
                <Route path="connections/:connectionId/templates" element={<ConnectionTemplates />} />
                <Route path="datasets" element={<DatasetList />} />
                <Route path="datasets/:datasetId" element={<Dataset />} />
                {canAccess("teamAdmin", user.id, team?.TeamRoles) ? (
                  <>
                    <Route path="integrations" element={<Integrations />} />
                    <Route path="integrations/auth/:integrationType" element={<Auth />} />
                    <Route path="integrations/auth/slack/callback" element={<SlackCallback />} />
                    <Route path="integrations/:integrationId" element={<Integration />} />
                  </>
                ) : (
                  <>
                    <Route path="integrations" element={<NoAccessPage />} />
                    <Route path="integrations/auth/:integrationType" element={<NoAccessPage />} />
                    <Route path="integrations/auth/slack/callback" element={<NoAccessPage />} />
                    <Route path="integrations/:integrationId" element={<NoAccessPage />} />
                  </>
                )}
                <Route path="settings/*" element={<ManageTeam />} />
                <Route path="dashboard" element={<ProjectBoard />}>
                  <Route path=":projectId" element={<ProjectDashboard />} />
                  <Route path=":projectId/chart" element={<AddChart />} />
                  <Route path=":projectId/chart/:chartId/edit" element={<AddChart />} />
                  <Route path=":projectId/settings" element={<ProjectSettings />} />
                </Route>
              </Route>
              <Route exact path="/b/:brewName" element={<PublicDashboard />} />
              <Route path="/report/:brewName" element={<Report />} />
              <Route path="/report/:brewName/edit" element={<Report editMode />} />
              <Route
                exact
                path="/feedback"
                element={(
                  <div className={"flex flex-col h-[90vh] justify-center items-center"}>
                    <FeedbackForm />
                  </div>
                )}
              />
              <Route exact path="/signup" element={<Signup />} />
              <Route exact path="/start" element={<Onboarding />} />
              <Route exact path="/google-auth" element={<GoogleAuth />} />
              <Route exact path="/login" element={<Login />} />
              <Route path="/oauth/consent" element={<McpConsent />} />
              <Route path="/previews/:chartId" element={<ChartPreviewPage />} />
              <Route exact path="/user" element={<UserDashboard />} />
              <Route
                exact
                path="/user/profile"
                element={<Navigate replace to={`/settings/profile${location.search}`} />}
              />
              <Route
                exact
                path="/edit"
                element={<Navigate replace to={`/settings/profile${location.search}`} />}
              />
              <Route exact path="/passwordReset" element={<PasswordReset />} />
              <Route
                exact
                path="/project/:projectId"
                element={<ProjectRedirect />}
              />

              <Route
                exact
                path="/chart/:chartId/embedded"
                element={<EmbeddedChart />}
              />
              <Route
                exact
                path="/chart/:share_string/share"
                element={<SharedChart />}
              />

              <Route exact path="/invite" element={<UserInvite />} />
            </Routes>
          </Suspense>
        </div>
      </div>

      <Modal.Backdrop
        isOpen={feedbackModal}
        onOpenChange={(isOpen) => {
          if (!isOpen) dispatch(hideFeedbackModal());
        }}
      >
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Body className="p-1">
              <FeedbackForm />
            </Modal.Body>
            <Modal.Footer>
              <Button
                onPress={() => dispatch(hideFeedbackModal())}
                variant="tertiary"
              >
                Cancel
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {team?.id && pathname !== "/oauth/consent" && (
        <AiModal key={`${user?.id}:${team.id}`} isOpen={aiModalOpen} onClose={() => dispatch(hideAiModal())} />
      )}
      {pathname !== "/oauth/consent" ? <ActiveConversationBar /> : null}

      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 2500,
          style: {
            borderRadius: "8px",
            background: isDark ? "#333" : "#fff",
            color: isDark ? "#fff" : "#000",
          },
        }}
      />
    </IconContext.Provider>
  );
}

const styles = {
  container: {
    flex: 1,
  },
};

Main.propTypes = {
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = () => {
  return {
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Main);
