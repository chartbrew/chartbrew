import {
  FETCHING_DATA_REQUEST,
  FETCH_DATA_REQUEST_FAIL,
  FETCH_CHART_DATA_REQUESTS,
  FETCH_DATA_REQUEST_SUCCESS,
} from "../actions/dataRequest";

export default function dataset(state = {
  loading: false,
  error: false,
  data: [],
  requests: [],
}, action) {
  switch (action.type) {
    case FETCHING_DATA_REQUEST:
      return { ...state, loading: true };
    case FETCH_CHART_DATA_REQUESTS:
      return { ...state, loading: false, data: action.dataRequests };
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
      return { ...state, loading: false, data: newData };
    case FETCH_DATA_REQUEST_FAIL:
      return { ...state, loading: false, error: true };
    default:
      return state;
  }
}
