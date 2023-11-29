import React, { useEffect, useRef, useState } from "react";
import { LuAreaChart, LuCheckCircle, LuClipboard, LuCompass, LuLayoutDashboard, LuSearch } from "react-icons/lu";
import { Button, Card, CardBody, CardFooter, CardHeader, Image, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spacer } from "@nextui-org/react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router";

import Segment from "../../components/Segment";
import availableConnections from "../../modules/availableConnections";
import connectionImages from "../../config/connectionImages";
import useThemeDetector from "../../modules/useThemeDetector";
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
import TimescaleConnectionForm from "./Timescale/TimescaleConnectionForm";
import { addConnection, saveConnection } from "../../slices/connection";
import HelpBanner from "../../components/HelpBanner";

function ConnectionWizard() {
  const [connectionSearch, setConnectionSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [completionModal, setCompletionModal] = useState(false);

  const isDark = useThemeDetector();
  const bottomRef = useRef(null);
  const asideRef = useRef(null);
  const dispatch = useDispatch();
  const params = useParams();
  const navigate = useNavigate();

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

  const _filteredConnections = availableConnections.filter((conn) => {
    if (connectionSearch) {
      return conn.name.toLowerCase().includes(connectionSearch.toLowerCase());
    }
    return true;
  });

  const _onAddNewConnection = (data) => {
    if (params.connectionId !== "new") {
      return dispatch(saveConnection({ team_id: params.teamId, connection: data }))
        .then(() => {
          setSelectedType("");
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
      .then(() => {
        setCompletionModal(true);
        setSelectedType("");
        return true;
      })
      .catch(() => {
        return false;
      });
  };

  return (
    <div>
      <Navbar hideTeam transparent />
      <div>
        <div className="p-4 sm:mr-96">
          <Spacer y={2} />
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
                <div key={conn.name} className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-2">
                  <Card
                    shadow="none"
                    isPressable
                    className={`w-full ${selectedType === conn.type ? "border-3 border-primary" : "border-3 border-content3"}`}
                    onClick={() => setSelectedType(conn.type)}
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
                    <CardFooter className="justify-center">
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
          <Spacer y={4} />

          {selectedType === "api" && (
            <ApiConnectionForm
              onComplete={_onAddNewConnection}
            />
          )}
          {selectedType === "mongodb" && (
            <MongoConnectionForm
              onComplete={_onAddNewConnection}
            />
          )}
          {selectedType === "postgres" && (
            <PostgresConnectionForm
              onComplete={_onAddNewConnection}
            />
          )}
          {selectedType === "mysql" && (
            <MysqlConnectionForm
              onComplete={_onAddNewConnection}
            />
          )}
          {selectedType === "firestore" && (
            <FirestoreConnectionForm
              onComplete={_onAddNewConnection}
            />
          )}
          {selectedType === "realtimedb" && (
            <RealtimeDbConnectionForm
              onComplete={_onAddNewConnection}
            />
          )}
          {selectedType === "googleAnalytics" && (
            <GaConnectionForm
              onComplete={_onAddNewConnection}
            />
          )}
          {selectedType === "strapi" && (
            <StrapiConnectionForm
              onComplete={_onAddNewConnection}
            />
          )}
          {selectedType === "customerio" && (
            <CustomerioConnectionForm
              onComplete={_onAddNewConnection}
            />
          )}
          {selectedType === "timescaledb" && (
            <TimescaleConnectionForm
              onComplete={_onAddNewConnection}
            />
          )}

          <div ref={bottomRef} />
        </div>
        <aside className="hidden sm:block fixed top-0 right-0 z-40 w-96 h-screen" aria-label="Sidebar">
          <div className="h-full px-3 py-4 overflow-y-auto bg-gray-50 dark:bg-gray-800">
            <div className="flex flex-col gap-4 p-2">
              <Spacer y={10} />

              <Card>
                <CardHeader className="flex flex-col items-start">
                  <p className="font-semibold">Missing the data source credentials?</p>
                </CardHeader>
                <CardBody>
                  <p className="text-sm text-gray-500">
                    {"Someone like your CTO or a senior engineer can help you with this."}
                  </p>
                  <Spacer y={2} />
                  <p className="text-sm text-gray-500">
                    Ask them to join your team with this link
                  </p>
                  <Spacer y={1} />
                  <Input
                    readOnly
                    labelPlacement="outside"
                    value={"https://app.chartbrew.com/invite/123456"}
                  />
                </CardBody>
                <CardFooter>
                  <Button
                    size="sm"
                    color="primary"
                    fullWidth
                    endContent={<LuClipboard />}
                  >
                    Copy invite link
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
        onClose={() => setCompletionModal(false)}
        size="lg"
      >
        <ModalContent>
          <ModalHeader className="flex flex-row items-center gap-2">
            <LuCheckCircle className="text-success" />
            <span className="font-semibold">Your connection was saved!</span>
          </ModalHeader>
          <ModalBody>
            What would you like to do next?
          </ModalBody>
          <ModalFooter>
            <Button
              color="secondary"
              fullWidth
              onClick={() => navigate("/user")}
              startContent={<LuLayoutDashboard />}
            >
              Return to dashboard
            </Button>
            <Button
              color="primary"
              fullWidth
              onClick={() => navigate(`/${params.teamId}/dataset/new`)}
              startContent={<LuAreaChart />}
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
