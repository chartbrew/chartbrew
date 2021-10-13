import React from "react";
import PropTypes from "prop-types";
import Tour from "reactour";
import { Button, Icon } from "semantic-ui-react";

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
      {tourActive && (
        <Tour
          accentColor={secondary}
          steps={steps[tourActive]}
          isOpen={isActive(tourActive)}
          onRequestClose={closeTour}
          closeWithMask={false}
        />
      )}
    </>
  );
}

const steps = {
  addchart: [
    {
      selector: ".chart-name-tut",
      content: () => (
        <>
          <p>{"You can change the summary of the chart at any time by clicking on the text."}</p>
          <p>{"This will be displayed above your chart in the dashboard."}</p>
        </>
      ),
    },
    {
      selector: ".chart-actions-tut",
      content: () => (
        <>
          <p>{"The chart saves automatically and the button will be green when everything is synced."}</p>
          <p>{" You have the option to manually save from here and to change the draft status of the chart at any time."}</p>
        </>
      ),
    },
    {
      selector: ".chart-type-tut",
      content: () => (
        <>
          <p>{"When you have the data set up, your chart will appear here. You can also query for new data or refresh the style at any time."}</p>
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
  ],
  dataset: [
    {
      selector: ".dataset-manage-tut",
      content: () => (
        <>
          <p>{"Each dataset will need to be connected to one of your data sources. Chartbrew will then know where to fetch the data from."}</p>
          <p>
            {"You can always create new connections by clicking the "}
            <Icon name="plug" />
            {" button."}
          </p>
          <p>{"Select one of your connections from the dropdown list to get started."}</p>
        </>
      ),
    },
    {
      selector: ".dataset-actions-tut",
      content: ({ close }) => ( // eslint-disable-line
        <>
          <p>{"The dataset settings are saved automatically, but you can always save manually from here."}</p>
          <p>{"If you no longer need one of the datasets, the delete button is also here for you."}</p>
          <Button
            content="Time to connect"
            icon="plug"
            labelPosition="right"
            positive
            onClick={close}
          />
        </>
      ),
    }
  ],
  apibuilder: [
    {
      selector: ".apibuilder-route-tut",
      content: () => (
        <>
          <p>{"Here, you will have to enter the route and query parameters that you need for your API request."}</p>
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
          <p>{"Once you have everything ready, send the request away and get the data."}</p>
        </>
      ),
    },
    {
      selector: ".apibuilder-result-tut",
      content: ({ close }) => ( // eslint-disable-line
        <>
          <p>{"If the request is successful you will see the JSON data in this section."}</p>
          <p>{"If the API supports it, you will also get the error message in case the request is not successful."}</p>
          <Button
            content="Start configuring"
            icon="cog"
            labelPosition="right"
            positive
            onClick={close}
          />
        </>
      ),
    },
  ],
  mongobuilder: [
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
              {"MongoDB's documentation on how to query documents."}
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
          <p>{"To make things easier later on you can also save the query and use it for other charts."}</p>
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
      content: ({ close }) => ( // eslint-disable-line
        <>
          <p>{"The JSON-formatted data will appear here when you run a successful query."}</p>
          <Button
            content="Write a query"
            icon="pencil"
            labelPosition="right"
            positive
            onClick={close}
          />
        </>
      ),
    },
  ],
  sqlbuilder: [
    {
      selector: ".sqlbuilder-query-tut",
      content: () => (
        <>
          <p>
            {"Here you can enter your SQL query to get data from your database."}
          </p>
          <p>
            {"As an example, it should look like this: "}
            <pre>{"SELECT * from users WHERE age > 43;"}</pre>
          </p>
        </>
      ),
    },
    {
      selector: ".sqlbuilder-buttons-tut",
      content: () => (
        <>
          <p>{"Once you write the query, you can run it from here."}</p>
          <p>{"To make things easier later on you can also save the query and use it for other charts."}</p>
        </>
      ),
    },
    {
      selector: ".sqlbuilder-saved-tut",
      content: () => (
        <>
          <p>{"Once you save some queries they will appear in this section. You can update and delete them from here as well."}</p>
        </>
      ),
    },
    {
      selector: ".sqlbuilder-result-tut",
      content: ({ close }) => ( // eslint-disable-line
        <>
          <p>{"The JSON-formatted data will appear here when you run a successful query."}</p>
          <Button
            content="Write a query"
            icon="pencil"
            labelPosition="right"
            positive
            onClick={close}
          />
        </>
      ),
    },
  ],
  firestoreBuilder: [
    {
      selector: ".firestorebuilder-collections-tut",
      content: () => (
        <>
          <p>
            {"You Firestore collections will appear here."}
          </p>
          <p>
            {"In case you can't see them or you added a new collection just now, press the refresh link to get the latest data."}
          </p>
          <p>
            {"Once you see the collection you want to use, just click on it to select it."}
          </p>
        </>
      ),
    },
    {
      selector: ".firestorebuilder-request-tut",
      content: () => (
        <>
          <p>{"Once you select a collection, click here to get data from your Firestore database."}</p>
        </>
      ),
    },
    {
      selector: ".firestorebuilder-result-tut",
      content: () => (
        <>
          <p>{"You can see the results of your query in JSON format over here."}</p>
        </>
      ),
    },
    {
      selector: ".firestorebuilder-query-tut",
      content: ({ close }) => ( // eslint-disable-line
        <>
          <p>{"One last thing!"}</p>
          <p>{"You can query the data from your Firestore database using the built-in query editor here."}</p>
          <p>{"You will have to select which field you want to query on, the operation, and value(s)."}</p>
          <p>{"Chartbrew supports all Firestore operations, but more custom query options will be added soon."}</p>
          <Button
            content="Awesome!"
            icon="checkmark"
            labelPosition="right"
            positive
            onClick={close}
          />
        </>
      ),
    },
  ],
  requestmodal: [
    {
      selector: ".requestmodal-fields-tut",
      content: ({ close }) => ( // eslint-disable-line
        <>
          <p>{"Great! You have some data now."}</p>
          <p>{"You can explore your data and press 'Done' to continue configuring your chart."}</p>
          <Button
            content="Gotcha"
            icon="checkmark"
            labelPosition="right"
            positive
            onClick={close}
          />
        </>
      ),
    },
  ],
  datasetdata: [
    {
      selector: ".datasetdata-axes-tut",
      content: () => (
        <>
          <p>{"This is the place where you can configure what data appears on the chart axes. You will notice that the chart preview will update automatically when you change these."}</p>
          <p>{"You can also apply an operation on the Y axis, like count, sum and average."}</p>
        </>
      )
    },
    {
      selector: ".datasetdata-filters-tut",
      content: () => (
        <>
          <p>{"To give you more flexibility, Chartbrew also supports a wide range of filters."}</p>
          <p>{"You can select any field from your dataset and filter based on the given values and operations."}</p>
        </>
      )
    },
    {
      selector: ".datasetdata-date-tut",
      content: ({ close }) => ( // eslint-disable-line
        <>
          <p>{"To simplify the date filtering across datasets, Chartbrew allows you to select date ranges to filter your data."}</p>
          <p>
            {"If this is your use-case, select a date field here and then you can use the"}
            <strong>{" global date settings "}</strong>
            {"on the right to filter your data."}
          </p>
          <Button
            content="All done"
            icon="checkmark"
            labelPosition="right"
            positive
            onClick={close}
          />
        </>
      )
    }
  ]
};

Walkthrough.defaultProps = {
  userTutorials: {},
};

Walkthrough.propTypes = {
  tourActive: PropTypes.string.isRequired,
  closeTour: PropTypes.func.isRequired,
  userTutorials: PropTypes.object,
};

export default Walkthrough;
