import React, { useEffect, useRef, useState } from "react";
import { LuArrowLeft, LuBrainCircuit, LuChartArea, LuClipboard, LuClipboardCheck, LuCompass, LuLayoutDashboard, LuPartyPopper, LuSearch } from "react-icons/lu";
import { Button, Card, Chip, Separator, Input, Modal, Tooltip } from "@heroui/react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import { Link, useSearchParams } from "react-router";

import Segment from "../../components/Segment";
import availableConnections from "../../modules/availableConnections";
import connectionImages from "../../config/connectionImages";
import { useTheme } from "../../modules/ThemeContext";
import ApiConnectionForm from "./components/ApiConnectionForm";
import MongoConnectionForm from "./components/MongoConnectionForm";
import PostgresConnectionForm from "./components/PostgresConnectionForm";
import MysqlConnectionForm from "./components/MysqlConnectionForm";
import FirestoreConnectionForm from "./Firestore/FirestoreConnectionForm";
import RealtimeDbConnectionForm from "./RealtimeDb/RealtimeDbConnectionForm";
import GaConnectionForm from "./GoogleAnalytics/GaConnectionForm";
import StrapiConnectionForm from "./Strapi/StrapiConnectionForm";
import CustomerioConnectionForm from "./Customerio/CustomerioConnectionForm";
import ClickHouseConnectionForm from "./ClickHouse/ClickHouseConnectionForm";
import { addConnection, addFilesToConnection, getConnection, getTeamConnections, saveConnection, selectConnections } from "../../slices/connection";
import HelpBanner from "../../components/HelpBanner";
import { generateInviteUrl, selectTeam } from "../../slices/team";
import { showAiModal } from "../../slices/ui";
import canAccess from "../../config/canAccess";
import { selectUser } from "../../slices/user";

function ConnectionWizard() {
  const [connectionSearch, setConnectionSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [completionModal, setCompletionModal] = useState(false);
  const [newConnection, setNewConnection] = useState(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [connectionToEdit, setConnectionToEdit] = useState(null);

  const { isDark } = useTheme();
  const initRef = useRef(null);
  const bottomRef = useRef(null);
  const asideRef = useRef(null);
  const paramsInitRef = useRef(null);
  const fetchConnectionRef = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();

  const connections = useSelector(selectConnections);
  const user = useSelector(selectUser);
  const team = useSelector(selectTeam);

  useEffect(() => {
    if (team?.id && !initRef.current) {
      initRef.current = true;
      dispatch(getTeamConnections({ team_id: team.id }));
      dispatch(generateInviteUrl({
        team_id: team.id,
        projects: [],
        canExport: true,
        role: "teamAdmin",
      }))
        .then((data) => {
          setInviteUrl(data.payload);
        }).catch(() => {});
    }
  }, [team]);

  useEffect(() => {
    if (selectedType) {
      bottomRef?.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
        inline: "nearest",
      });

      setTimeout(() => {
        asideRef?.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
          inline: "nearest",
        });
      }, 500);
    }
  }, [selectedType]);

  useEffect(() => {
    if (params.connectionId && params.connectionId !== "new" && team?.id && !paramsInitRef.current) {
      paramsInitRef.current = true;
      dispatch(getConnection({ team_id: team.id, connection_id: params.connectionId }))
        .then((res) => {
          if (res?.payload) {
            setConnectionToEdit(res.payload);
          }
        });
    }
  }, [params, team]);

  useEffect(() => {
    if (searchParams.get("type")) {
      setSelectedType(searchParams.get("type"));
    }
  }, [searchParams]);

  useEffect(() => {
    if (connectionToEdit && !fetchConnectionRef.current) {
      fetchConnectionRef.current = true;
      setNewConnection({ ...connectionToEdit });
      setSelectedType(connectionToEdit.type);
    }
  }, [connectionToEdit]);

  const _filteredConnections = availableConnections.filter((conn) => {
    if (connectionSearch) {
      return conn.name.toLowerCase().includes(connectionSearch.toLowerCase());
    }
    return true;
  });

  const _onAddNewConnection = (data, files) => {
    if (params.connectionId !== "new") {
      return dispatch(saveConnection({ team_id: team.id, connection: data }))
        .then(async () => {
          if (files) {
            await dispatch(addFilesToConnection({ team_id: team.id, connection_id: params.connectionId, files }));
          }

          toast.success("Connection saved successfully");
          return true;
        })
        .catch(() => {
          return false;
        });
    }

    return dispatch(addConnection({
        team_id: team.id,
        connection: { ...data, team_id: team.id }
      }))
      .then(async (createdConnection) => {
        if (createdConnection.error) {
          return false;
        }

        if (files) {
          dispatch(addFilesToConnection({ team_id: team.id, connection_id: createdConnection.payload.id, files }));
        }

        if (data.type === "googleAnalytics") {
          navigate(`/connections/${createdConnection.payload.id}`);
          return true;
        }

        setCompletionModal(true);
        setSelectedType("");

        navigate(`/connections/${createdConnection.payload.id}`);
        const resp = await dispatch(getConnection({ team_id: team.id, connection_id: createdConnection.payload.id }));
        setConnectionToEdit(resp.payload);

        return true;
      })
      .catch(() => {
        return false;
      });
  };

  const _onCopyInviteUrl = () => {
    navigator.clipboard.writeText(inviteUrl);
    setInviteCopied(true);
    setTimeout(() => {
      setInviteCopied(false);
    }, 2000);
  };

  const _canAccess = (role, teamRoles) => {
    return canAccess(role, user.id, teamRoles);
  };

  const _onAskAi = async () => {
    setCompletionModal(false);
    setTimeout(() => {
      dispatch(showAiModal())
    }, 100);
  };

  if (!_canAccess("teamAdmin", team.TeamRoles)) {
    return (
      <div>
        <div className="flex flex-col items-center justify-center h-screen">
          <span className="text-xl text-secondary font-semibold">{"You don't have access to this page"}</span>
          <div className="h-4" />
          <Button
            color="primary"
            onPress={() => navigate("/")}
          >
            Return to dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col">
        <div className="sm:mr-96">          
          <div className="h-4" />

          {!newConnection && (
            <>
              <div className="flex flex-row items-center gap-2">
                <span className="text-xl text-secondary font-semibold">Step 1:</span>
                <span className="text-xl font-semibold">Select your datasource type</span>
              </div>
              <div className="h-8" />
              <Segment>
                <div className="flex flex-row justify-between items-center flex-wrap gap-2">
                  <Input
                    endContent={<LuSearch />}
                    placeholder="Search..."
                    variant="bordered"
                    labelPlacement="outside"
                    className="max-w-[300px]"
                    onChange={(e) => setConnectionSearch(e.target.value)}
                  />
                </div>
                <div className="h-8" />
                <div className="grid grid-cols-12 gap-4">
                  {_filteredConnections.map((conn) => (
                    <div key={conn.name} className="col-span-12 sm:col-span-6 lg:col-span-6 xl:col-span-3">
                      <Card
                        role="button"
                        tabIndex={0}
                        className={`w-full h-full cursor-pointer shadow-none transition-colors hover:bg-content2/40 ${selectedType === conn.type ? "border-3 border-primary" : "border-3 border-content3"}`}
                        onClick={() => setSelectedType(conn.type)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedType(conn.type);
                          }
                        }}
                      >
                        <Card.Content className="overflow-visible p-4 max-w-sm flex flex-row items-center justify-center">
                          <img
                            alt={conn.name}
                            className="h-[80px] rounded-lg object-contain"
                            src={connectionImages(isDark)[conn.type]}
                          />
                        </Card.Content>
                        <Card.Footer className="justify-center flex flex-col gap-1">
                          {conn.ai && (
                            <Tooltip content="You can use AI to ask questions about your data">
                              <Chip radius="sm" color="secondary" variant="flat" size="sm" startContent={<LuBrainCircuit size={14} />}>
                                {"AI-powered"}
                              </Chip>
                            </Tooltip>
                          )}
                          <span className="text-sm font-semibold">{conn.name}</span>
                        </Card.Footer>
                      </Card>
                    </div>
                  ))}
                  {_filteredConnections.length === 0 && (
                    <div className="col-span-12">
                      <p className="text-center text-gray-500">No connections found</p>
                    </div>
                  )}
                </div>
              </Segment>

              <div className="h-16" />
              {selectedType && (
                <div className="flex flex-row items-center gap-2">
                  <span className="text-xl text-secondary font-semibold">Step 2:</span>
                  <span className="text-xl font-semibold">Connect to your data source</span>
                </div>
              )}
            </>
          )}

          {newConnection && (
            <div className="flex flex-row items-center gap-2">
              <Link to="/connections" className="text-xl font-semibold">
                <LuArrowLeft size={24} className="text-foreground" />
              </Link>
              <span className="text-xl font-semibold">Edit your connection</span>
            </div>
          )}
          <div className="h-8" />

          {selectedType === "api" && (
            <ApiConnectionForm
              onComplete={_onAddNewConnection}
              editConnection={newConnection}
            />
          )}
          {selectedType === "mongodb" && (
            <MongoConnectionForm
              onComplete={_onAddNewConnection}
              editConnection={newConnection}
            />
          )}
          {selectedType === "postgres" && (
            <PostgresConnectionForm
              onComplete={_onAddNewConnection}
              editConnection={newConnection}
            />
          )}
          {selectedType === "mysql" && (
            <MysqlConnectionForm
              onComplete={_onAddNewConnection}
              editConnection={newConnection}
              subType="mysql"
            />
          )}
          {selectedType === "firestore" && (
            <FirestoreConnectionForm
              onComplete={_onAddNewConnection}
              editConnection={newConnection}
            />
          )}
          {selectedType === "realtimedb" && (
            <RealtimeDbConnectionForm
              onComplete={_onAddNewConnection}
              editConnection={newConnection}
            />
          )}
          {selectedType === "googleAnalytics" && (
            <GaConnectionForm
              onComplete={_onAddNewConnection}
              editConnection={newConnection}
            />
          )}
          {selectedType === "strapi" && (
            <StrapiConnectionForm
              onComplete={_onAddNewConnection}
              editConnection={newConnection}
            />
          )}
          {selectedType === "customerio" && (
            <CustomerioConnectionForm
              onComplete={_onAddNewConnection}
              editConnection={newConnection}
            />
          )}
          {selectedType === "timescaledb" && (
            <PostgresConnectionForm
              onComplete={_onAddNewConnection}
              editConnection={newConnection}
              subType="timescaledb"
            />
          )}
          {selectedType === "supabasedb" && (
            <PostgresConnectionForm
              onComplete={_onAddNewConnection}
              editConnection={newConnection}
              subType="supabasedb"
            />
          )}
          {selectedType === "rdsPostgres" && (
            <PostgresConnectionForm
              onComplete={_onAddNewConnection}
              editConnection={newConnection}
              subType="rdsPostgres"
            />
          )}
          {selectedType === "rdsMysql" && (
            <MysqlConnectionForm
              onComplete={_onAddNewConnection}
              editConnection={newConnection}
              subType="rdsMysql"
            />
          )}
          {selectedType === "clickhouse" && (
            <ClickHouseConnectionForm
              onComplete={_onAddNewConnection}
              editConnection={newConnection}
            />
          )}

          <div ref={bottomRef} />
        </div>
        <aside className="hidden sm:block fixed top-0 right-0 z-40 w-96 h-screen" aria-label="Sidebar">
          <div className="h-full px-3 py-4 overflow-y-auto bg-gray-50 dark:bg-gray-800">
            <div className="flex flex-col gap-2 p-2">
              <div className="h-20" />

              <Card>
                <Card.Header className="flex flex-col items-start">
                  <p className="font-semibold">Missing the data source credentials?</p>
                </Card.Header>
                <Card.Content>
                  <p className="text-sm text-gray-500">
                    {"Someone from your engineering team can help you with this."}
                  </p>
                  <div className="h-4" />
                  <p className="text-sm text-gray-500">
                    Ask them to join your team with this link
                  </p>
                  <div className="h-2" />
                  <Input
                    readOnly
                    labelPlacement="outside"
                    value={inviteUrl}
                  />
                </Card.Content>
                <Card.Footer>
                  <Button
                    size="sm"
                    color="primary"
                    variant={inviteCopied ? "flat" : "solid"}
                    fullWidth
                    endContent={inviteCopied ? <LuClipboardCheck /> : <LuClipboard />}
                    onClick={() => _onCopyInviteUrl()}
                  >
                    {inviteCopied ? "Copied to clipboard" : "Copy invite link"}
                  </Button>
                </Card.Footer>
              </Card>

              <div className="h-2" />

              <Card>
                <Card.Header className="flex flex-col items-start">
                  <p className="font-semibold">Check out our tutorials</p>
                </Card.Header>
                <Card.Content>
                  <p className="text-sm text-gray-500">
                    {"We have a number of tutorials that can help you get started with Chartbrew and learn more about the platform."}
                  </p>
                </Card.Content>
                <Card.Footer>
                  <Button
                    size="sm"
                    color="primary"
                    fullWidth
                    endContent={<LuCompass />}
                  >
                    Open the tutorials
                  </Button>
                </Card.Footer>
              </Card>

              <div className="h-2" />

              {selectedType && (
                <HelpBanner
                  type={selectedType}
                  imageUrl={connectionImages(isDark)[selectedType]}
                />
              )}
            </div>

            <div ref={asideRef} />
          </div>
        </aside>
      </div>

      <Modal>
        <Modal.Backdrop
          variant="blur"
          isOpen={completionModal}
          onOpenChange={(nextOpen) => { if (!nextOpen) setCompletionModal(false); }}
        >
          <Modal.Container size="lg">
            <Modal.Dialog>
              <Modal.Header className="flex flex-row items-center gap-2">
                <LuPartyPopper className="text-success" size={24} />
                <Modal.Heading className="font-semibold">
                  Your connection was saved!
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {connections.length > 1 && (
                  <div>What would you like to do next?</div>
                )}
                {connections.length < 2 && (
                  <div>Create your first dataset to start visualizing your data</div>
                )}
              </Modal.Body>
              <Modal.Footer className="flex flex-col gap-2">
                <div className="flex w-full flex-row gap-2">
                  {connections.length > 1 && (
                    <Button
                      className="w-full"
                      variant="tertiary"
                      onPress={() => navigate("/")}
                    >
                      <LuLayoutDashboard />
                      Return to dashboard
                    </Button>
                  )}
                  <Button
                    className="w-full"
                    variant="primary"
                    onPress={() => navigate("/datasets/new")}
                  >
                    <LuChartArea />
                    Create dataset
                  </Button>
                </div>
                {_canAccess("teamAdmin", team?.TeamRoles) && (
                  <>
                    <div className="flex w-full flex-row gap-2 py-2">
                      <Separator />
                    </div>
                    <Button
                      className="w-full"
                      variant="tertiary"
                      onPress={() => _onAskAi()}
                    >
                      <LuBrainCircuit />
                      Create with Chartbrew AI
                    </Button>
                  </>
                )}
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  )
}

export default ConnectionWizard
