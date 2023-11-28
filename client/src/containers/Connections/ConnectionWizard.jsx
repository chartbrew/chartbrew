import React, { useEffect, useRef, useState } from "react";
import { LuClipboard, LuCompass, LuSearch } from "react-icons/lu";
import { Button, Card, CardBody, CardFooter, CardHeader, Image, Input, Spacer } from "@nextui-org/react";
import { useDispatch } from "react-redux";
import { TbBrandDiscord } from "react-icons/tb";
import { useParams } from "react-router";

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
import { saveConnection } from "../../slices/connection";

function ConnectionWizard() {
  const [connectionSearch, setConnectionSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");

  const isDark = useThemeDetector();
  const bottomRef = useRef(null);
  const dispatch = useDispatch();
  const params = useParams();

  useEffect(() => {
    if (selectedType) {
      bottomRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
        inline: "nearest",
      });
    }
  }, [selectedType]);

  const _filteredConnections = availableConnections.filter((conn) => {
    if (connectionSearch) {
      return conn.name.toLowerCase().includes(connectionSearch.toLowerCase());
    }
    return true;
  });

  const _onAddNewConnection = (data) => {
    return dispatch(saveConnection({ team_id: params.teamId, connection: data }))
      .then(() => {
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
            />
          )}
          {selectedType === "postgres" && (
            <PostgresConnectionForm
            />
          )}
          {selectedType === "mysql" && (
            <MysqlConnectionForm
            />
          )}
          {selectedType === "firestore" && (
            <FirestoreConnectionForm
            />
          )}
          {selectedType === "realtimedb" && (
            <RealtimeDbConnectionForm
            />
          )}
          {selectedType === "googleAnalytics" && (
            <GaConnectionForm
            />
          )}
          {selectedType === "strapi" && (
            <StrapiConnectionForm
            />
          )}
          {selectedType === "customerio" && (
            <CustomerioConnectionForm
            />
          )}
          {selectedType === "timescaledb" && (
            <TimescaleConnectionForm
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
                  <p className="font-semibold">Need help with anything?</p>
                </CardHeader>
                <CardBody>
                  <p className="text-sm text-gray-500">
                    {"If you're having issues with the connection, need new integrations or anything else, we're here to help."}
                  </p>
                </CardBody>
                <CardFooter>
                  <Button
                    size="sm"
                    color="primary"
                    fullWidth
                    endContent={<TbBrandDiscord />}
                  >
                    Join our Discord
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
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default ConnectionWizard
