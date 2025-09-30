import { Button, Card, CardBody, Chip, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Listbox, ListboxItem, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, User } from "@heroui/react"
import React, { useEffect, useState } from "react"
import { LuBook, LuBookOpenText, LuChevronRight, LuConstruction, LuContrast, LuFileCode2, LuGithub, LuHeartHandshake, LuLogOut, LuMoon, LuSettings, LuSmile, LuSquareKanban, LuSun, LuUser, LuWallpaper } from "react-icons/lu"
import { useDispatch, useSelector } from "react-redux"
import { Link, useNavigate } from "react-router"
import { TbBrandDiscord } from "react-icons/tb"

import { logout, selectUser } from "../slices/user"
import { selectTeam, selectTeams } from "../slices/team"
import canAccess from "../config/canAccess"
import Row from "./Row"
import Text from "./Text"
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
      <Listbox aria-label="Account actions" variant="flat">
        <ListboxItem
          startContent={<LuHeartHandshake size={18} />}
          onPress={() => _onDropdownAction("resources")}
          fullWidth
        >
          <Dropdown aria-label="Select a help option" placement="right-end">
            <DropdownTrigger>
              <div className="flex flex-row justify-start w-full">Resources</div>
            </DropdownTrigger>
            <DropdownMenu variant="faded" onAction={(key) => _onDropdownAction(key)}>
              <DropdownItem startContent={<TbBrandDiscord />} key="discord" textValue="Join our Discord">
                Join our Discord
              </DropdownItem>
              <DropdownItem startContent={<LuSquareKanban />} key="roadmap" textValue="Roadmap" endContent={<Chip variant="flat" color="secondary" size="sm" radius="sm">New</Chip>}>
                Roadmap
              </DropdownItem>
              <DropdownItem startContent={<LuBook />} key="tutorials" textValue="Blog tutorials">
                Blog tutorials
              </DropdownItem>
              <DropdownItem startContent={<LuBookOpenText />} key="documentation" textValue="Documentation">
                Documentation
              </DropdownItem>
              <DropdownItem startContent={<LuFileCode2 />} key="api" textValue="API Reference">
                API Reference
              </DropdownItem>
              <DropdownItem startContent={<LuGithub />} key="github" textValue="GitHub">
                GitHub
              </DropdownItem>
              <DropdownItem startContent={<LuSmile />} key="feedback" textValue="Feedback">
                Feedback
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </ListboxItem>
        <ListboxItem
          className="changelog-trigger max-h-8"
          startContent={<LuConstruction size={18} />}
          endContent={
            <span className={`changelog-badge ${changelogPadding ? "p-4" : "p-0 w-6"}`} />
          }
          fullWidth
        >
          <div className={"hidden sm:block text-sm"}>Updates</div>
        </ListboxItem>
      </Listbox>
      <Dropdown aria-label="Select a user option" placement="right-end" className="justify-start">
        <DropdownTrigger className="flex flex-row justify-start">
          <div className="flex flex-row justify-between items-center cursor-pointer hover:bg-content2 rounded-lg w-full p-2">
            <User
              avatarProps={{
                name: user.name,
                showFallback: <LuUser />,
                size: "sm",
              }}
              name={user.name}
              className="justify-start"
            />
            <div className="text-sm text-foreground">
              <LuChevronRight size={18} />
            </div>
          </div>
        </DropdownTrigger>
        <DropdownMenu variant="faded">
          <DropdownItem startContent={<LuUser />} key="profile" textValue="Profile">
            <Link to="/user/profile">
              <div className="w-full text-foreground">
                Profile
              </div>
            </Link>
          </DropdownItem>
          {_canAccess("teamAdmin", teamOwned) && (
            <DropdownItem startContent={<LuSettings />} key="account" textValue="Team settings">
              <Link to={`/manage/${team?.id || teamOwned.id}/settings`}>
                <div className="w-full text-foreground">
                  Team settings
                </div>
              </Link>
            </DropdownItem>
          )}

          <DropdownItem
            startContent={<LuWallpaper />}
            showDivider
            key="theme"
            onPress={() => setShowAppearance(true)}
            textValue="UI Theme"
          >
            <div className="w-full text-foreground">
              UI Theme
            </div>
          </DropdownItem>

          <DropdownItem startContent={<LuLogOut />} onPress={() => dispatch(logout())} textValue="Sign out">
            Sign out
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>

      <Modal
        isOpen={feedbackModal}
        onClose={() => setFeedbackModal(false)}
      >
        <ModalContent>
          <ModalBody>
            <FeedbackForm />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" color="warning" onPress={() => setFeedbackModal(false)} auto>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={showAppearance} onClose={() => setShowAppearance(false)} width="500px">
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Chartbrew UI Appearance</Text>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-row justify-between gap-2">
              <Card
                isPressable
                borderWeight={theme === "light" ? "extrabold" : "normal"}
                onPress={() => setTheme("light")}
                className={`bg-white ${theme === "light" ? "border-secondary" : "border-content3"} border-2 border-solid min-w-[100px]`}
                variant={"bordered"}
              >
                <CardBody>
                  <LuSun size={24} color="black" />
                  <Row align={"center"} className={"gap-2"}>
                    <Text className={"text-black!"}>Light</Text>
                  </Row>
                </CardBody>
              </Card>

              <Card
                isPressable
                className={`bg-black ${theme === "dark" ? "border-secondary" : "border-content3"} border-2 border-solid min-w-[100px]`}
                borderWeight={theme === "dark" ? "extrabold" : "normal"}
                onPress={() => setTheme("dark")}
                variant={"bordered"}
              >
                <CardBody>
                  <LuMoon size={24} color="white" />
                  <Row align={"center"} className={"gap-2"}>
                    <Text className="text-[#FFFFFF]!">Dark</Text>
                  </Row>
                </CardBody>
              </Card>

              <Card
                isPressable
                variant={"bordered"}
                onPress={() => setTheme("system")}
                borderWeight={theme === "system" ? "extrabold" : "normal"}
                className={`bg-content3 ${theme === "system" ? "border-secondary" : "border-content3"} border-2 border-solid min-w-[100px]`}
              >
                <CardBody>
                  <LuContrast size={24} color={isDark ? "white" : "black"} />
                  <Row align={"center"} className={"gap-2"}>
                    <Text h5 className={isDark ? "text-white" : "text-black"}>System</Text>
                  </Row>
                </CardBody>
              </Card>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setShowAppearance(false)}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

export default AccountNav
