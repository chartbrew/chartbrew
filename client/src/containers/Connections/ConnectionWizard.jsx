import React, { useEffect, useRef, useState } from "react";
import { LuBrainCircuit, LuChartArea, LuCircleArrowLeft, LuClipboard, LuClipboardCheck, LuCompass, LuLayoutDashboard, LuPartyPopper, LuSearch } from "react-icons/lu";
import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Image, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spacer, Tooltip } from "@heroui/react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import { Link, useSearchParams } from "react-router-dom";

import Segment from "../../components/Segment";
import availableConnections from "../../modules/availableConnections";
import connectionImages from "../../config/connectionImages";
import { useTheme } from "../../modules/ThemeContext";
import Navbar from "../../components/Navbar";
import ApiConnectionForm from "./components/ApiConnectionForm";
import MongoConnectionForm from "./components/MongoConnectionForm";
import PostgresConnectionForm from "./components/PostgresConnectionForm";
import MysqlConnectionForm from "./components/MysqlConnectionForm";
import FirestoreConnectionForm from "./Firestore/FirestoreConnectionForm";
import RealtimeDbConnectionForm from "./RealtimeDb/RealtimeDbConnectionForm";
import GaConnectionForm from "./GoogleAnalytics/GaConnectionForm";
import StrapiConnectionForm from "./Strapi/StrapiConnectionForm";
import CustomerioConnectionForm from "./Customerio/CustomerioConnectionForm";
import { addConnection, addFilesToConnection, getConnection, getTeamConnections, saveConnection, selectConnections } from "../../slices/connection";
import HelpBanner from "../../components/HelpBanner";
import { generateInviteUrl } from "../../slices/team";

function ConnectionWizard() {
  const [connectionSearch, setConnectionSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [completionModal, setCompletionModal] = useState(false);
  const [newConnection, setNewConnection] = useState(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [connectionToEdit, setConnectionToEdit] = useState(null);

  const { isDark } = useTheme();
  const bottomRef = useRef(null);
  const asideRef = useRef(null);
  const paramsInitRef = useRef(null);
  const fetchConnectionRef = useRef(null);
  const dispatch = useDispatch();
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const connections = useSelector(selectConnections)

  useEffect(() => {
    dispatch(getTeamConnections({ team_id: params.teamId }));
    dispatch(generateInviteUrl({
      team_id: params.teamId,
      projects: [],
      canExport: true,
      role: "teamAdmin",
    }))
      .then((data) => {
        setInviteUrl(data.payload);
      }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedType) {
      bottomRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
        inline: "nearest",
      });

      setTimeout(() => {
        asideRef.current.scrollIntoView({
          behavior: "smooth",
          block: "end",
          inline: "nearest",
        });
      }, 500);
    }
  }, [selectedType]);

  useEffect(() => {
    if (params.connectionId && params.connectionId !== "new" && !paramsInitRef.current) {
      paramsInitRef.current = true;
      dispatch(getConnection({ team_id: params.teamId, connection_id: params.connectionId }))
        .then((res) => {
          if (res?.payload) {
            setConnectionToEdit(res.payload);
          }
        });
    }
  }, [params]);

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
      return dispatch(saveConnection({ team_id: params.teamId, connection: data }))
        .then(async () => {
          if (files) {
            await dispatch(addFilesToConnection({ team_id: params.teamId, connection_id: params.connectionId, files }));
          }

          toast.success("Connection saved successfully");
          return true;
        })
        .catch(() => {
          return false;
        });
    }

    return dispatch(addConnection({
        team_id: params.teamId,
        connection: { ...data, team_id: params.teamId }
      }))
      .then((newConnection) => {
        if (newConnection.error) {
          return false;
        }

        if (files) {
          dispatch(addFilesToConnection({ team_id: params.teamId, connection_id: newConnection.payload.id, files }));
        }

        if (data.type === "googleAnalytics") {
          navigate(`/${params.teamId}/connection/${newConnection.payload.id}`);
          return true;
        }

        setCompletionModal(true);
        setSelectedType("");
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

  return (
    <div>
      <Navbar hideTeam transparent />
      <div>
        <div className="p-4 sm:mr-96">          
          <Spacer y={2} />

          {!newConnection && (
            <>
              <div className="flex flex-row items-center gap-2">
                <span className="text-xl text-secondary font-semibold">Step 1:</span>
                <span className="text-xl font-semibold">Select your datasource type</span>
              </div>
              <Spacer y={4} />
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
                <Spacer y={4} />
                <div className="grid grid-cols-12 gap-4">
                  {_filteredConnections.map((conn) => (
                    <div key={conn.name} className="col-span-12 sm:col-span-6 md:col-span-6 lg:col-span-3 xl:col-span-2">
                      <Card
                        shadow="none"
                        isPressable
                        className={`w-full h-full ${selectedType === conn.type ? "border-3 border-primary" : "border-3 border-content3"}`}
                        onPress={() => setSelectedType(conn.type)}
                      >
                        <CardBody className="overflow-visible p-0">
                          <Image
                            radius="lg"
                            width="100%"
                            alt={conn.name}
                            className="w-full object-cover h-[140px]"
                            src={connectionImages(isDark)[conn.type]}
                          />
                        </CardBody>
                        <CardFooter className="justify-center flex flex-col gap-1">
                          {conn.ai && (
                            <Tooltip content="You can use AI to ask questions about your data">
                              <Chip radius="sm" color="secondary" variant="flat" size="sm" startContent={<LuBrainCircuit />}>
                                {"AI-powered"}
                              </Chip>
                            </Tooltip>
                          )}
                          <span className="text-sm font-semibold">{conn.name}</span>
                        </CardFooter>
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

              <Spacer y={8} />
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
              <Link to="/connections" className="text-xl text-secondary font-semibold">
                <LuCircleArrowLeft size={24} />
              </Link>
              <span className="text-xl font-semibold">Edit your connection</span>
            </div>
          )}
          <Spacer y={4} />

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

          <div ref={bottomRef} />
        </div>
        <aside className="hidden sm:block fixed top-0 right-0 z-40 w-96 h-screen" aria-label="Sidebar">
          <div className="h-full px-3 py-4 overflow-y-auto bg-gray-50 dark:bg-gray-800">
            <div className="flex flex-col gap-2 p-2">
              <Spacer y={10} />

              <Card>
                <CardHeader className="flex flex-col items-start">
                  <p className="font-semibold">Missing the data source credentials?</p>
                </CardHeader>
                <CardBody>
                  <p className="text-sm text-gray-500">
                    {"Someone from your engineering team can help you with this."}
                  </p>
                  <Spacer y={2} />
                  <p className="text-sm text-gray-500">
                    Ask them to join your team with this link
                  </p>
                  <Spacer y={1} />
                  <Input
                    readOnly
                    labelPlacement="outside"
                    value={inviteUrl}
                  />
                </CardBody>
                <CardFooter>
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
                </CardFooter>
              </Card>

              <Spacer y={1} />

              <Card>
                <CardHeader className="flex flex-col items-start">
                  <p className="font-semibold">Check out our tutorials</p>
                </CardHeader>
                <CardBody>
                  <p className="text-sm text-gray-500">
                    {"We have a number of tutorials that can help you get started with Chartbrew and learn more about the platform."}
                  </p>
                </CardBody>
                <CardFooter>
                  <Button
                    size="sm"
                    color="primary"
                    fullWidth
                    endContent={<LuCompass />}
                  >
                    Open the tutorials
                  </Button>
                </CardFooter>
              </Card>

              <Spacer y={1} />

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

      <Modal
        isOpen={completionModal}
        backdrop="blur"
        onClose={() => setCompletionModal(false)}
        size="lg"
      >
        <ModalContent>
          <ModalHeader className="flex flex-row items-center gap-2">
            <LuPartyPopper className="text-success" size={24} />
            <span className="font-semibold">Your connection was saved!</span>
          </ModalHeader>
          <ModalBody>
            {connections.length > 1 && (
              <div>What would you like to do next?</div>
            )}
            {connections.length < 2 && (
              <div>Create your first dataset to start visualizing your data</div>
            )}
          </ModalBody>
          <ModalFooter>
            {connections.length > 1 && (
              <Button
                variant="bordered"
                fullWidth
                onClick={() => navigate("/")}
                startContent={<LuLayoutDashboard />}
              >
                Return to dashboard
              </Button>
            )}
            <Button
              color="primary"
              fullWidth
              onClick={() => navigate(`/${params.teamId}/dataset/new`)}
              startContent={<LuChartArea />}
            >
              Create dataset
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

export default ConnectionWizard
