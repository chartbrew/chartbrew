import { createSlice } from "@reduxjs/toolkit";

// Load initial sidebar state from localStorage
const getInitialSidebarState = () => {
  try {
    const stored = window.localStorage.getItem("_cb_sidebar_state");
    if (stored !== null) {
      return stored === "true";
    }
  } catch (error) {
    console.error("Error reading sidebar state from localStorage:", error);
  }
  return false; // Default to expanded (not collapsed)
};

const initialState = {
  aiModalOpen: false,
  feedbackModalOpen: false,
  sidebarCollapsed: getInitialSidebarState(),
};

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    showAiModal: (state) => {
      state.aiModalOpen = true;
    },
    hideAiModal: (state) => {
      state.aiModalOpen = false;
    },
    toggleAiModal: (state) => {
      state.aiModalOpen = !state.aiModalOpen;
    },
    showFeedbackModal: (state) => {
      state.feedbackModalOpen = true;
    },
    hideFeedbackModal: (state) => {
      state.feedbackModalOpen = false;
    },
    toggleFeedbackModal: (state) => {
      state.feedbackModalOpen = !state.feedbackModalOpen;
    },
    setSidebarCollapsed: (state, action) => {
      state.sidebarCollapsed = action.payload;
      try {
        window.localStorage.setItem("_cb_sidebar_state", String(action.payload));
      } catch (error) {
        console.error("Error saving sidebar state to localStorage:", error);
      }
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      try {
        window.localStorage.setItem("_cb_sidebar_state", String(state.sidebarCollapsed));
      } catch (error) {
        console.error("Error saving sidebar state to localStorage:", error);
      }
    },
  },
});

export const { showAiModal, hideAiModal, toggleAiModal, showFeedbackModal, hideFeedbackModal, toggleFeedbackModal, setSidebarCollapsed, toggleSidebar } = uiSlice.actions;

export const selectAiModalOpen = (state) => state.ui.aiModalOpen;
export const selectFeedbackModalOpen = (state) => state.ui.feedbackModalOpen;
export const selectSidebarCollapsed = (state) => state.ui.sidebarCollapsed;

export default uiSlice.reducer;
