import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useParams } from "react-router";
import {
  Avatar, Button, Dropdown, Modal, ProgressCircle,
} from "@heroui/react";
import {
  LuBook, LuBookOpenText, LuContrast, LuFileCode2, LuGithub, LuHeartHandshake, LuSquareKanban, LuLogOut,
  LuMoon, LuSettings, LuSmile, LuSun, LuUser, LuWallpaper,
  LuBrainCircuit,
} from "react-icons/lu";
import { TbBrandDiscord } from "react-icons/tb";

import { logout, selectUser } from "../slices/user";
import FeedbackForm from "./FeedbackForm";
import cbLogo from "../assets/logo_blue.png";
import cbLogoInverted from "../assets/logo_inverted.png";
import canAccess from "../config/canAccess";
import { selectTeam, selectTeams } from "../slices/team";
import { selectAiModalOpen, hideAiModal, toggleAiModal } from "../slices/ui";
import { useTheme } from "../modules/ThemeContext";
import cbFullLogoLight from "../assets/cb_logo_light.svg";
import cbFullLogoDark from "../assets/cb_logo_dark.svg";
import AiModal from "../containers/Ai/AiModal";

/*
  The navbar component used throughout the app
*/
function NavbarContainer() {
  const [changelogPadding, setChangelogPadding] = useState(true);
  const [feedbackModal, setFeedbackModal] = useState();
  const [teamOwned, setTeamOwned] = useState({});
  const [showAppearance, setShowAppearance] = useState(false);

  const team = useSelector(selectTeam);
  const teams = useSelector(selectTeams);
  const project = useSelector((state) => state.project.active);
  const user = useSelector(selectUser);
  const aiModalOpen = useSelector(selectAiModalOpen);

  const { theme, setTheme, isDark } = useTheme();
  const userInitials = user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    setTimeout(() => {
      try {
        Headway.init(HW_config);
        setChangelogPadding(false);
      } catch (e) {
        // ---
      }
    }, 1000);
  }, []);

  useEffect(() => {
    if (teams.length > 0) {
      teams.map((t) => {
        t.TeamRoles.map((tr) => {
          if (tr.user_id === user.id && tr.role === "teamOwner") {
            setTeamOwned(t);
          }
          return tr;
        });
        return t;
      });
    }
  }, [teams]);

  // Keyboard shortcut for AI modal (Cmd+K on Mac, Ctrl+K on Windows)
  useEffect(() => {
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
  }, [dispatch]);

  const _canAccess = (role, teamData) => {
    if (teamData) {
      return canAccess(role, user.id, teamData.TeamRoles);
    }
    return canAccess(role, user.id, team.TeamRoles);
  };

  const _onDropdownAction = (key) => {
    switch (key) {
      case "discord": {
        window.open("https://discord.gg/KwGEbFk", "_blank");
        break;  
      }
      case "tutorials": {
        window.open("https://chartbrew.com/blog/tag/tutorial/", "_blank");
        break;
      }
      case "documentation": {
        window.open("https://docs.chartbrew.com", "_blank");
        break;
      }
      case "github": {
        window.open("https://github.com/chartbrew/chartbrew/discussions", "_blank");
        break;
      }
      case "feedback": {
        setFeedbackModal(true);
        break;
      }
      case "profile": {
        navigate("/user/profile");
        break;
      }
      case "account": {
        navigate(`/manage/${team.id || teamOwned.id}/settings`);
        break;
      }
      case "theme": {
        setShowAppearance(true);
        break;
      }
      case "roadmap": {
        window.open("https://chartbrew.com/roadmap", "_blank");
        break;
      }
      case "api": {
        window.open("https://docs.chartbrew.com/api-reference/introduction", "_blank");
        break;
      }
      default: {
        break;
      }
    }
  }

  if (!team?.id && !teams) {
    return (
      <Modal.Backdrop isOpen variant="blur" isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[320px]">
            <Modal.Body>
              <div className="flex justify-center py-6">
                <ProgressCircle aria-label="Loading" isIndeterminate size="lg">
                  <ProgressCircle.Track>
                    <ProgressCircle.TrackCircle />
                    <ProgressCircle.FillCircle />
                  </ProgressCircle.Track>
                </ProgressCircle>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    );
  }
  return (
    <>
      <header className="sticky top-0 z-[999] flex h-12 items-center justify-between border-b border-divider bg-surface px-4">
        <div className="flex items-center">
          {params.teamId && (
            <Link to="/">
              <img src={isDark ? cbLogoInverted : cbLogo} alt="Chartbrew Logo" width={30}  />
            </Link>
          )}
          {!params.teamId && (
            <>
              <Link to="/" className="hidden sm:block">
                <img src={isDark ? cbFullLogoDark : cbFullLogoLight} alt="Chartbrew Logo" width={120}  />
              </Link>
              <Link to="/" className="block sm:hidden">
                <img src={isDark ? cbLogoInverted : cbLogo} alt="Chartbrew Logo" width={30} />
              </Link>
            </>
          )}
          {params.teamId && (
            <div className="ml-4 hidden items-center gap-2 sm:flex">
              <button type="button" className="text-sm text-foreground" onClick={() => navigate("/")}>
                {team.name}
              </button>
              {params.projectId && (
                <>
                  <span className="text-sm text-foreground/50">/</span>
                  <button
                    type="button"
                    className="text-sm text-foreground"
                    onClick={() => navigate(`/${params.teamId}/${params.projectId}/dashboard`)}
                  >
                    {project.name}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
            <div
              className="changelog-trigger flex flex-row items-center text-foreground cursor-pointer"
              title="Changelog"
            >
              <span className="changelog-badge text-accent-500">
                {changelogPadding && <span style={{ paddingLeft: 16, paddingRight: 16 }} />}
              </span>
              <div className={"hidden sm:block text-sm"}>Updates</div>
            </div>
          <Dropdown>
              <Dropdown.Trigger>
                <Button
                  variant="tertiary"
                  className="px-2"
                >
                  <LuHeartHandshake size={18} />
                  Resources
                </Button>
              </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu onAction={(key) => _onDropdownAction(key)}>
                <Dropdown.Item id="discord" textValue="Join our Discord">
                  <div className="flex flex-row items-center gap-2">
                    <TbBrandDiscord />
                    <span>Join our Discord</span>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="roadmap" textValue="Roadmap">
                  <div className="flex flex-row items-center gap-2">
                    <LuSquareKanban size={18} />
                    <span>Roadmap</span>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="tutorials" textValue="Blog tutorials">
                  <div className="flex flex-row items-center gap-2">
                    <LuBook size={18} />
                    <span>Blog tutorials</span>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="documentation" textValue="Documentation">
                  <div className="flex flex-row items-center gap-2">
                    <LuBookOpenText size={18} />
                    <span>Documentation</span>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="api" textValue="API Reference">
                  <div className="flex flex-row items-center gap-2">
                    <LuFileCode2 size={18} />
                    <span>API Reference</span>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="github" textValue="GitHub">
                  <div className="flex flex-row items-center gap-2">
                    <LuGithub size={18} />
                    <span>GitHub</span>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="feedback" textValue="Feedback">
                  <div className="flex flex-row items-center gap-2">
                    <LuSmile size={18} />
                    <span>Feedback</span>
                  </div>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          
          {_canAccess("teamAdmin", team) && (
              <Button
                variant="primary"
                onPress={() => dispatch(toggleAiModal())}
                size="sm"
                className="from-primary-300 via-violet-200 to-secondary-300 dark:from-primary-500 dark:via-violet-500 dark:to-secondary-500 bg-gradient-to-tr hover:bg-gradient-to-br transition-all duration-300 shadow-md"
              >
                <LuBrainCircuit size={18} />
                Ask Chartbrew AI
              </Button>
          )}

          <Dropdown>
              <Dropdown.Trigger>
                <div className="cursor-pointer">
                  <Avatar size="sm">
                    <Avatar.Fallback>{userInitials || <LuUser />}</Avatar.Fallback>
                  </Avatar>
                </div>
              </Dropdown.Trigger>
            <Dropdown.Popover>
            <Dropdown.Menu
              onAction={(key) => {
                if (key === "logout") {
                  dispatch(logout());
                  return;
                }

                _onDropdownAction(key);
              }}
            >
              <Dropdown.Item id="profile" textValue="Profile">
                <div className="flex flex-row items-center gap-2">
                  <LuUser size={18} />
                  <span>Profile</span>
                </div>
              </Dropdown.Item>
              {_canAccess("teamAdmin", teamOwned) && (
                <Dropdown.Item id="account" textValue="Team settings">
                  <div className="flex flex-row items-center gap-2">
                    <LuSettings size={18} />
                    <span>Team settings</span>
                  </div>
                </Dropdown.Item>
              )}

              <Dropdown.Item id="theme" textValue="UI Theme">
                <div className="flex flex-row items-center gap-2">
                  <LuWallpaper size={18} />
                  <span>UI Theme</span>
                </div>
              </Dropdown.Item>

              <Dropdown.Item id="logout" textValue="Sign out" variant="danger">
                <div className="flex flex-row items-center gap-2">
                  <LuLogOut size={18} />
                  <span>Sign out</span>
                </div>
              </Dropdown.Item>
            </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </header>

      <Modal.Backdrop isOpen={feedbackModal} onOpenChange={setFeedbackModal}>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Body>
            <FeedbackForm />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => setFeedbackModal(false)}>
              Cancel
            </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop isOpen={showAppearance} onOpenChange={setShowAppearance}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[500px]">
            <Modal.Header>
              <Modal.Heading>Chartbrew UI Appearance</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
            <div className="flex flex-row justify-between gap-2">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex min-w-[100px] flex-1 flex-col rounded-large border-2 border-solid px-4 py-4 text-left ${theme === "light" ? "border-secondary" : "border-content3"} bg-white`}
              >
                <LuSun size={24} color="black" />
                <div className="mt-2 text-black">Light</div>
              </button>

              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex min-w-[100px] flex-1 flex-col rounded-large border-2 border-solid px-4 py-4 text-left ${theme === "dark" ? "border-secondary" : "border-content3"} bg-black`}
              >
                <LuMoon size={24} color="white" />
                <div className="mt-2 text-white">Dark</div>
              </button>

              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`flex min-w-[100px] flex-1 flex-col rounded-large border-2 border-solid px-4 py-4 text-left ${theme === "system" ? "border-secondary" : "border-content3"} bg-content3`}
              >
                <LuContrast size={24} color={isDark ? "white" : "black"} />
                <div className={isDark ? "mt-2 text-white" : "mt-2 text-black"}>System</div>
              </button>
            </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline" onPress={() => setShowAppearance(false)}>
                Close
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {_canAccess("teamAdmin", team) && (
        <AiModal isOpen={aiModalOpen} onClose={() => dispatch(hideAiModal())} />
      )}
    </>
  );
}

export default NavbarContainer;
