import React from "react";
import PropTypes from "prop-types";
import Tour from "reactour";
import { Button } from "semantic-ui-react";

import { secondary } from "../../../config/colors";
import showTutorial from "../../../config/tutorials";

function Walkthrough(props) {
  const {
    tourActive, closeTour, userTutorials,
  } = props;

  const isActive = (type) => {
    return showTutorial(type, userTutorials);
  };

  return (
    <>
      {tourActive === "addchart" && (
        <Tour
          accentColor={secondary}
          steps={addchartSteps}
          isOpen={isActive("addchart")}
          onRequestClose={closeTour}
          closeWithMask={false}
          disableKeyboardNavigation={["esc"]}
        />
      )}

      {tourActive === "dataset" && (
        <Tour
          accentColor={secondary}
          steps={datasetSteps}
          isOpen={isActive("dataset")}
          onRequestClose={closeTour}
          closeWithMask={false}
          disableDotsNavigation={["esc"]}
        />
      )}
      {tourActive === "apibuilder" && (
        <Tour
          accentColor={secondary}
          steps={apibuilderSteps}
          isOpen={isActive("apibuilder")}
          onRequestClose={closeTour}
          closeWithMask={false}
          disableDotsNavigation={["esc"]}
        />
      )}
      {tourActive === "mongobuilder" && (
        <Tour
          accentColor={secondary}
          steps={mongobuilderSteps}
          isOpen={isActive("mongobuilder")}
          onRequestClose={closeTour}
          closeWithMask={false}
          disableDotsNavigation={["esc"]}
        />
      )}
    </>
  );
}

const addchartSteps = [
  {
    selector: ".chart-name-tut",
    content: () => (
      <p>{"You can change the summary of the chart at any time by clicking on the text."}</p>
    ),
  },
  {
    selector: ".chart-actions-tut",
    content: () => (
      <>
        <p>{"The chart saves automatically and the button will be green when everything was synced."}</p>
        <p>{" You have the option to manually save from here and to change the draft status of the chart at any time."}</p>
      </>
    ),
  },
  {
    selector: ".chart-type-tut",
    content: () => (
      <>
        <p>{"When you know how you'd like the chart to look like, you can choose a chart type from here."}</p>
        <p>{"You can always query for some data first and choose a type later. And speaking about queries..."}</p>
      </>
    ),
  },
  {
    selector: ".add-dataset-tut",
    content: ({ close }) => ( // eslint-disable-line
      <>
        <p>{"Here is the place where you prepare the data for brewing. You can create different datasets, connect them to data sources and get the data flowing."}</p>
        <p>{"You will need at least one dataset to generate a chart. Create one now and get acquainted with how it works 👩‍💻"}</p>
        <Button
          content="Brewing time!"
          icon="flask"
          labelPosition="right"
          positive
          onClick={close}
        />
      </>
    ),
  },
];

const datasetSteps = [
  {
    selector: ".dataset-manage-tut",
    content: () => (
      <>
        <p>{"Here you can change your dataset name at any time. The name will appear in the chart legend as well."}</p>
        <p>{"Most importantly, you can select which connection should the dataset get the data from by using the dropdown field."}</p>
        <p>{"You can always create new connection by clicking the 'Manage connection button'."}</p>
      </>
    ),
  },
  {
    selector: ".dataset-colors-tut",
    content: () => (
      <>
        <p>{"After you get some data, it will be time to give your chart some color"}</p>
        <p>{"You can choose any color for your dataset, including the line and fill color."}</p>
      </>
    ),
  },
  {
    selector: ".dataset-actions-tut",
    content: () => (
      <>
        <p>{"The dataset settings are saved automatically, but you can always save manually from here."}</p>
        <p>{"If you no longer need one of the datasets, the delete button is also here for you."}</p>
      </>
    ),
  }
];

const apibuilderSteps = [
  {
    selector: ".apibuilder-route-tut",
    content: () => (
      <>
        <p>{"The host address was already set when you created the connection."}</p>
        <p>{"Here, you will have to enter the route and and query parameters that you need for your API request."}</p>
      </>
    ),
  },
  {
    selector: ".apibuilder-menu-tut",
    content: () => (
      <>
        <p>{"You can further configure your requests by adding headers, a body of data and you can also paginate requests if the API allows it."}</p>
      </>
    ),
  },
  {
    selector: ".apibuilder-headers-tut",
    content: () => (
      <>
        <p>{"The global headers are enabled by default. These are set in the Connections page and it's best used for headers that need to be included often, such as the 'Authorization' header."}</p>
      </>
    ),
  },
  {
    selector: ".apibuilder-type-tut",
    content: () => (
      <>
        <p>{"You can select what type of API request you want to send from here."}</p>
      </>
    ),
  },
  {
    selector: ".apibuilder-request-tut",
    content: () => (
      <>
        <p>{"Once your have everything ready, send the request away and get the data."}</p>
      </>
    ),
  },
  {
    selector: ".apibuilder-result-tut",
    content: () => (
      <>
        <p>{"If the request is successful you will see the JSON data in this section."}</p>
        <p>{"If the API suports it, you will also get the error message here in case the request is not successful. On the right, you will also see the HTTP error code in red."}</p>
      </>
    ),
  },
];

const mongobuilderSteps = [
  {
    selector: ".mongobuilder-query-tut",
    content: () => (
      <>
        <p>
          {"Here you can enter your MongoDB query to get data from your database. You can have a look at "}
          <a
            href="https://docs.mongodb.com/manual/tutorial/query-documents/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {"MongoDB's docummentation on how to query documents."}
          </a>
        </p>
        <p>
          {"Note that you should always start the query with: "}
          <pre>connection.collection...</pre>
        </p>
      </>
    ),
  },
  {
    selector: ".mongobuilder-buttons-tut",
    content: () => (
      <>
        <p>{"Once you write the query, you can run it from here."}</p>
        <p>{"To make things easier later on, you can also save the query and use it for other charts."}</p>
      </>
    ),
  },
  {
    selector: ".mongobuilder-saved-tut",
    content: () => (
      <>
        <p>{"Once you save some queries they will appear in this section. You can update and delete them from here as well."}</p>
      </>
    ),
  },
  {
    selector: ".mongobuilder-result-tut",
    content: () => (
      <>
        <p>{"The JSON-formatted data will appear here when you run a successful query."}</p>
      </>
    ),
  },
];

Walkthrough.defaultProps = {
  userTutorials: {},
};

Walkthrough.propTypes = {
  tourActive: PropTypes.string.isRequired,
  closeTour: PropTypes.func.isRequired,
  userTutorials: PropTypes.object,
};

export default Walkthrough;
