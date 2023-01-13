import {
  FETCHING_INTEGRATION,
  FETCH_INTEGRATION_FAIL,
  FETCH_CHART_INTEGRATIONS,
  FETCH_INTEGRATION_SUCCESS,
  REMOVE_INTEGRATION,
  CLEAR_INTEGRATIONS,
} from "../actions/integration";

const initialState = {
  loading: false,
  error: false,
  data: [],
};

export default function integration(state = initialState, action) {
  switch (action.type) {
    case FETCHING_INTEGRATION:
      return { ...state, loading: true };
    case FETCH_CHART_INTEGRATIONS:
      return { ...state, loading: false, data: action.integrations };
    case FETCH_INTEGRATION_SUCCESS:
      // look for existing INTEGRATIONS in the data array and replace it if it exists
      let indexFound = -1;
      for (let i = 0; i < state.data.length; i++) {
        if (state.data[i].id === action.integration.id) {
          indexFound = i;
          break;
        }
      }
      const newData = [...state.data];
      if (indexFound > -1) {
        newData[indexFound] = action.integration;
      } else {
        newData.push(action.integration);
      }
      return { ...state, loading: false, data: newData };
    case FETCH_INTEGRATION_FAIL:
      return { ...state, loading: false, error: true };
    case REMOVE_INTEGRATION:
      // look for existing integrations in the data array and remove it if it exists
      let removeIndex = -1;
      for (let i = 0; i < state.data.length; i++) {
        if (state.data[i].id === action.integrationId) {
          removeIndex = i;
          break;
        }
      }
      const tempData = [...state.data];
      if (removeIndex > -1) {
        tempData.splice(removeIndex, 1);
      }
      return { ...state, loading: false, data: tempData };
    case CLEAR_INTEGRATIONS:
      return initialState;
    default:
      return state;
  }
}
