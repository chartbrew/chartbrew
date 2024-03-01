import React, { useState } from "react";

import { Checkbox, Chip, Link, Divider, Input } from "@nextui-org/react";
import { LuImagePlus } from "react-icons/lu";
import AceEditor from "react-ace";
// import { useDropzone } from "react-dropzone";
import Row from "../../../components/Row";
import Text from "../../../components/Text";

function ReportSettings() {
  const [newChanges, setNewChanges] = useState({
    backgroundColor: "#FFFFFF",
    titleColor: "#000000",
  });

  return (
    <div>
      <h4 className="mt-1 px-5 text-lg font-semibold">
        Report setting
        <Divider className="mt-2 w-40 " />
      </h4>
      <div className="mt-5">
        <h4 className="px-5 text-md font-semibold">
          Change Logo
        </h4>
        <div className="px-5 flex items-start justify-start mt-2 ">
          <Link className="text-foreground cursor-pointer">
            <div className="max-w-sm p-3 bg-content2 border-dashed border-2 border-gray-300 rounded-lg text-center">
              <div className="flex justify-center">
                {/* <div {...getRootProps()}>
                  <input {...getInputProps()} />
                </div> */}
                <LuImagePlus size={30} />
              </div>
              <div>
                <p className="mt-2 text-sm">Upload your</p>
                <p className="text-sm">logo</p>
              </div>
            </div>
          </Link>
        </div>
        <div className="px-5 mt-5">
          <h4 className="text-md font-semibold">
            Dashboard Title
          </h4>
          <div className="mt-2">
            <Input
              size="sm"
              radius="md"
              placeholder="Enter your dashboard title"
              value={newChanges.dashboardTitle}
              // onChange={(e) => {
              //   setNewChanges({
              //     ...newChanges,
              //     dashboardTitle: e.target.value,
              //   });
              // }}
              variant="bordered"
              fullWidth
            />
          </div>
        </div>
        <div className="px-5 mt-5">
          <h4 className="text-md font-semibold">
            Dashboard description
          </h4>
          <div className="mt-2">
            <Input
              size="sm"
              radius="md"
              placeholder="Enter a short description"
              value={newChanges.description}
              onChange={(e) => {
                setNewChanges({
                  ...newChanges,
                  description: e.target.value,
                });
              }}
              variant="bordered"
              fullWidth
            />
          </div>
        </div>
        <div className="px-5 mt-5">
          <div className="flex flex-row gap-4">
            <h4 className="text-md font-semibold">
              Company website URL
            </h4>
            <Checkbox defaultSelected>Button</Checkbox>
          </div>
          <div className="mt-2">
            <Input
              size="sm"
              radius="md"
              placeholder="https://example.com"
              value={newChanges.logoLink}
              onChange={(e) => {
                setNewChanges({
                  ...newChanges,
                  logoLink: e.target.value,
                });
              }}
              variant="bordered"
              fullWidth
            />
          </div>
        </div>
        <div className="px-5 mt-5">
          <h4 className="text-md font-semibold">Custom Css</h4>
          <Text size={"sm"}>Some of the main classes on the page:</Text>
          <Row wrap="wrap" className={"gap-1 mt-2"}>
            <Chip>.main-container</Chip>
            <Chip>.title-container</Chip>
            <Chip>.dashboard-title</Chip>
            <Chip>.chart-grid</Chip>
            <Chip>.chart-container</Chip>
            <Chip>.chart-card</Chip>
            <Chip>.dashboard-sub-title</Chip>
          </Row>
          <Row>
            <div style={{ width: "100%" }} className="mt-5">
              <AceEditor
                mode="css"
                // theme={isDark ? "one_dark" : "tomorrow"}
                height="200px"
                width="none"
                value={newChanges.headerCode}
                style={{ borderRadius: 10 }}
                onChange={(value) => {
                  setNewChanges({ ...newChanges, headerCode: value });
                }}
                name="queryEditor"
                editorProps={{ $blockScrolling: true }}
                className="rounded-md border-1 border-solid border-content3"
              />
            </div>
          </Row>
        </div>
      </div>
    </div>
  );
}

export default ReportSettings;
