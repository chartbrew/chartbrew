import { cloneDeep } from "lodash";
import {
  FETCHING_DATA_REQUEST,
  FETCH_DATA_REQUEST_FAIL,
  FETCH_CHART_DATA_REQUESTS,
  FETCH_DATA_REQUEST_SUCCESS,
  DATA_REQUEST_DELETED,
  FETCH_DATASET_REQUESTS,
} from "../actions/dataRequest";

export default function dataRequest(state = {
  loading: false,
  error: false,
  data: [],
  responses: [],
}, action) {
  switch (action.type) {
    case FETCHING_DATA_REQUEST:
      if (action.id) {
        // mark data request as loading
        const newData = cloneDeep(state.data);
        const indexFound = newData.findIndex(dr => dr.id === action.id);
        if (indexFound > -1) {
          newData[indexFound].loading = true;
        }
        return { ...state, loading: true, data: newData };
      }
      return { ...state, loading: true };
    case FETCH_CHART_DATA_REQUESTS:
      return { ...state, loading: false, data: [...action.dataRequests] };
    case FETCH_DATA_REQUEST_SUCCESS:
      // look for existing datasets in the data array and replace it if it exists
      let indexFound = -1;
      for (let i = 0; i < state.data.length; i++) {
        if (state.data[i].id === parseInt(action.dataRequest.id, 10)) {
          indexFound = i;
          break;
        }
      }
      const newData = [...state.data];
      if (indexFound > -1) {
        newData[indexFound] = action.dataRequest;
      } else {
        newData.push(action.dataRequest);
      }

      // if the request contains some response data (when running the request)
      if (action?.response?.data) {
        // look for existing datasets in the responses array and replace it if it exists
        let indexReq = -1;
        for (let i = 0; i < state.responses.length; i++) {
          if (state.responses[i].id === parseInt(action.dataRequest.id, 10)) {
            indexReq = i;
            break;
          }
        }
        const newResponses = [...state.responses];
        if (indexReq > -1) {
          newResponses[indexReq] = {
            id: action.dataRequest.id,
            data: action.response.data,
          };
        } else {
          newResponses.push({
            id: action.dataRequest.id,
            data: action.response.data,
          });
        }
        return {
          ...state, loading: false, data: newData, responses: newResponses
        };
      }
      return { ...state, loading: false, data: newData };
    case FETCH_DATASET_REQUESTS: {
      const newData = [...state.data];
      if (action.dataRequests) {
        action.dataRequests.forEach((dataRequest) => {
          let indexFound = -1;
          for (let i = 0; i < newData.length; i++) {
            if (newData[i].id === parseInt(dataRequest.id, 10)) {
              indexFound = i;
              break;
            }
          }
          if (indexFound > -1) {
            newData[indexFound] = dataRequest;
          } else {
            newData.push(dataRequest);
          }
        });
      }

      return { ...state, loading: false, data: newData };
    }
    case FETCH_DATA_REQUEST_FAIL: {
      if (action.id) {
        // mark data request as not loading
        const newData = cloneDeep(state.data);
        const dataIndex = newData.findIndex(dr => dr.id === action.id);
        if (dataIndex > -1) {
          newData[dataIndex].loading = false;
        }

        // mark data request as not loading and add error to response
        const newResponses = [...state.responses];
        const indexFound = newResponses.findIndex(dr => dr.id === action.id);
        if (indexFound > -1) {
          newResponses[indexFound].error = action.error;
        } else {
          newResponses.push({
            id: action.id,
            error: action.error,
          });
        }

        return {
          ...state, loading: false, error: true, data: newData, responses: newResponses,
        };
      }

      return { ...state, loading: false, error: true };
    }
    case DATA_REQUEST_DELETED:
      return {
        ...state,
        loading: false,
        data: state.data.filter((dataRequest) => dataRequest.id !== action.id),
      };
    default:
      return state;
  }
}
