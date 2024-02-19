import React from "react";
import { Divider, Link, Button } from "@nextui-org/react";
import { LuCheckCircle } from "react-icons/lu";

// const defaultColors = [
//   "#FFFFFF",
//   "#000000",
//   "#D9E3F0",
//   "#F47373",
//   "#697689",
//   "#37D67A",
//   primary,
//   secondary,
//   blue,
//   "#2CCCE4",
//   "#555555",
//   "#dce775",
//   "#ff8a65",
//   "#ba68c8",
// ];

function ThemeSettingsAside() {
  const listGradients = [
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
  ];
  const listPlain = [
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
    {
      background: "bg-content2",
    },
  ];

  return (
    <div className="">
      <h4 className=" mt-1 px-5 text-lg font-semibold text-gray-800 dark:text-white">
        Themes setting
        <Divider className="mt-2" />
      </h4>
      <div className="px-5 mt-5 flex flex-row gap-4">
        <div className="">
          <Link className="text-foreground cursor-pointer">
            <div className="px-9 py-9 border-2 bg-content2 border-gray-200 rounded-lg text-center">
              <div className="flex justify-center"></div>
            </div>
          </Link>
          <div className="mt-1 text-center">
            <p className="font-medium text-sm ">Theme1</p>
          </div>
        </div>
        <div className="">
          <Link className="text-foreground cursor-pointer">
            <div className="px-9 py-9 p-3 bg-content2  border-2 border-gray-200 rounded-lg text-center">
              <div className="flex justify-center"></div>
            </div>
          </Link>
          <div className="mt-1 text-center">
            <p className="font-medium text-sm">Theme2</p>
          </div>
        </div>
        <div className="">
          <Link className="text-foreground cursor-pointer">
            <div className="px-9 py-9 p-3 bg-content2  border-2 border-gray-200 rounded-lg text-center">
              <div className="flex justify-center"></div>
            </div>
          </Link>
          <div className="mt-1 text-center">
            <p className="font-medium text-sm">Theme3</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-5">
        <Divider className="mt-2" />
        <h4 className="mt-5 text-md font-medium">Background Gradients</h4>
        <div className="grid grid-cols-6 ">
          {listGradients.map((item, index) => (
            <Link key={index} className="text-foreground cursor-pointer">
              <div
                className={`mt-2 px-4 py-4 p-3 ${item.background} border-2 border-gray-200 rounded-lg`}
              />
            </Link>
          ))}
        </div>
      </div>
      <div className="px-5 mt-5">
        <h4 className="text-md font-medium">Background Plain</h4>
        <div className="grid grid-cols-6 ">
          {listPlain.map((item, index) => (
            <Link key={index} className="text-foreground cursor-pointer">
              <div
                className={`mt-2 px-4 py-4 p-3 ${item.background} border-2 border-gray-200 rounded-lg`}
              />
            </Link>
          ))}
        </div>
        {/* <div className="grid grid-cols-5 gap-2">
          <div>
            <TwitterPicker
              // color={newChanges.backgroundColor}
              // onChangeComplete={(color) => {
              //   setNewChanges({
              //     ...newChanges,
              //     backgroundColor: color.hex.toUpperCase(),
              //   });
              // }}
              colors={defaultColors}
              triangle="hide"
              styles={{
                default: { card: { boxShadow: "none" } },
              }}
            />
          </div>
        </div> */}
      </div>
      <div className="px-5 mt-5">
        <Divider />
        <div className="mt-5 flex flex-row space-x-6">
          <div className="">
            <h4 className="text-md font-medium">Button color</h4>
            <Link className="cursor-pointer">
              <div className="mt-2 px-4 py-4  border-2 border-gray-200 rounded-full"></div>
            </Link>
          </div>
          <div className="">
            <h4 className="text-md font-medium">Button text color</h4>
            <Link className="cursor-pointer">
              <div className="mt-2 px-4 py-4  border-2 border-gray-200 rounded-full"></div>
            </Link>
          </div>
        </div>
      </div>
      <div className="px-5 mt-2">
        <div className="flex flex-row space-x-10">
          <div>
            <h4 className="text-md font-medium">Title color</h4>
            <Link className="cursor-pointer">
              <div className="mt-2 px-4 py-4  border-2 border-gray-200 rounded-full"></div>
            </Link>
          </div>
          <div className="">
            <h4 className="text-md font-medium">Description color </h4>
            <Link className="cursor-pointer">
              <div className="mt-2 px-4 py-4  border-2 border-gray-200 rounded-full"></div>
            </Link>
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <div className="hidden sm:block pr-5">
          <Button
            size="md"
            color="success"
            variant="flat"
            endContent={<LuCheckCircle />}
            // isLoading={saveLoading}
            // onClick={_onSaveChanges}
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ThemeSettingsAside;
