import { Avatar, Button, Chip, Dropdown, Modal } from "@heroui/react"
import React, { useEffect, useState } from "react"
import { LuBook, LuBookOpenText, LuChevronRight, LuConstruction, LuContrast, LuFileCode2, LuGithub, LuHeartHandshake, LuLogOut, LuMoon, LuSettings, LuSmile, LuSquareKanban, LuSun, LuUser, LuWallpaper } from "react-icons/lu"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate } from "react-router"
import { TbBrandDiscord } from "react-icons/tb"

import { logout, selectUser } from "../slices/user"
import { selectTeam, selectTeams } from "../slices/team"
import canAccess from "../config/canAccess"
import FeedbackForm from "./FeedbackForm"
import { useTheme } from "../modules/ThemeContext"

function AccountNav() {
  const [teamOwned, setTeamOwned] = useState({});
  const [showAppearance, setShowAppearance] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(false);
  const [changelogPadding, setChangelogPadding] = useState(true);

  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const team = useSelector(selectTeam);
  const teams = useSelector(selectTeams);
  const { theme, setTheme, isDark } = useTheme();
  const userInitials = user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";

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
  
  return (
    <div className="flex flex-col items-start w-full">
      <div className="flex w-full flex-col gap-1">
        <Dropdown>
          <Dropdown.Trigger className="w-full rounded-lg">
            <div className="flex flex-row items-center justify-between rounded-lg px-2 py-2 hover:bg-content2">
              <div className="flex flex-row items-center gap-2">
                <LuHeartHandshake size={18} />
                <div className="text-sm text-foreground">Resources</div>
              </div>
              <LuChevronRight size={18} />
            </div>
          </Dropdown.Trigger>
          <Dropdown.Popover placement="right end">
            <Dropdown.Menu onAction={(key) => _onDropdownAction(key)}>
              <Dropdown.Item id="discord" textValue="Join our Discord">
                <div className="flex flex-row items-center gap-2">
                  <TbBrandDiscord />
                  <span>Join our Discord</span>
                </div>
              </Dropdown.Item>
              <Dropdown.Item id="roadmap" textValue="Roadmap">
                <div className="flex w-full flex-row items-center justify-between gap-2">
                  <div className="flex flex-row items-center gap-2">
                    <LuSquareKanban size={18} />
                    <span>Roadmap</span>
                  </div>
                  <Chip size="sm" variant="secondary" radius="sm">New</Chip>
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

        <div className="changelog-trigger flex max-h-8 w-full flex-row items-center justify-between rounded-lg px-2 py-2 hover:bg-content2">
          <div className="flex flex-row items-center gap-2">
            <LuConstruction size={18} />
            <div className="hidden sm:block text-sm">Updates</div>
          </div>
          <span className={`changelog-badge ${changelogPadding ? "p-4" : "p-0 w-6"}`} />
        </div>
      </div>

      <Dropdown className="justify-start">
        <Dropdown.Trigger className="flex w-full flex-row justify-start rounded-lg">
          <div className="flex w-full flex-row items-center justify-between rounded-lg p-2 hover:bg-content2">
            <div className="flex flex-row items-center gap-3">
              <Avatar size="sm">
                <Avatar.Fallback>{userInitials || <LuUser />}</Avatar.Fallback>
              </Avatar>
              <div className="text-sm text-foreground">{user.name}</div>
            </div>
            <div className="text-sm text-foreground">
              <LuChevronRight size={18} />
            </div>
          </div>
        </Dropdown.Trigger>
        <Dropdown.Popover placement="right end">
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
    </div>
  )
}

export default AccountNav
