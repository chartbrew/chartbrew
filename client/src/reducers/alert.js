import {
  FETCHING_ALERT,
  FETCH_ALERT_FAIL,
  FETCH_CHART_ALERTS,
  FETCH_ALERT_SUCCESS,
  REMOVE_ALERT,
  CLEAR_ALERTS,
} from "../actions/alert";

const initialState = {
  loading: false,
  error: false,
  data: [],
  requests: [],
};

export default function alert(state = initialState, action) {
  switch (action.type) {
    case FETCHING_ALERT:
      return { ...state, loading: true };
    case FETCH_CHART_ALERTS:
      return { ...state, loading: false, data: action.alerts };
    case FETCH_ALERT_SUCCESS:
      // look for existing ALERTS in the data array and replace it if it exists
      let indexFound = -1;
      for (let i = 0; i < state.data.length; i++) {
        if (state.data[i].id === action.alert.id) {
          indexFound = i;
          break;
        }
      }
      const newData = [...state.data];
      if (indexFound > -1) {
        newData[indexFound] = action.alert;
      } else {
        newData.push(action.alert);
      }
      return { ...state, loading: false, data: newData };
    case FETCH_ALERT_FAIL:
      return { ...state, loading: false, error: true };
    case REMOVE_ALERT:
      // look for existing alerts in the data array and remove it if it exists
      let removeIndex = -1;
      for (let i = 0; i < state.data.length; i++) {
        if (state.data[i].id === action.alertId) {
          removeIndex = i;
          break;
        }
      }
      const tempData = [...state.data];
      if (removeIndex > -1) {
        tempData.splice(removeIndex, 1);
      }
      return { ...state, loading: false, data: tempData };
    case CLEAR_ALERTS:
      return initialState;
    default:
      return state;
  }
}
